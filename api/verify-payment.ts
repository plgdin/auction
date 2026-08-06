import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';
import { sendEmail, getPaymentConfirmationTemplate } from './utils/email.js';
import { handleCorsPreflightIfNeeded, setCorsHeaders } from './utils/cors.js';
import { z } from 'zod';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});


const verifyPaymentSchema = z.object({
  order_id: z.string().min(1, "order_id is required"),
  payment_id: z.string().min(1, "payment_id is required"),
  signature: z.string().min(1, "signature is required"),
});

export default async function handler(req: any, res: any) {
  // CORS — restricted to allowed origins
  if (handleCorsPreflightIfNeeded(req, res)) return;
  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  // Re-read env on each request to pick up hot-reloaded .env changes
  dotenv.config({ path: '.env.local', override: true });
  dotenv.config({ override: true });

  const keyId = (process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_GATEWAY_KEYS',
        message: 'Payment gateway configuration issue. Please contact support.'
      }
    });
    return;
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  // Parse request body stream if not pre-parsed (Connect/Vite environment support)
  if (!req.body) {
    try {
      req.body = await new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            resolve({});
          }
        });
        req.on('error', (err: any) => { reject(err); });
      });
    } catch (e) {
      req.body = {};
    }
  }

  // Rate Limiting
  const ip = getClientIp(req);
  if (isRateLimited(ip, 20, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  try {
    // Authenticate User
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
      return;
    }

    // 1. Zod input parameters validation
    const validation = verifyPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Bad Request: Invalid parameters', details: validation.error.issues });
      return;
    }

    const { order_id, payment_id, signature } = validation.data;

    // 2. Verify signature using timingSafeEqual to block timing attacks
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    const signatureBuf = Buffer.from(signature);
    const generatedBuf = Buffer.from(generatedSignature);

    if (signatureBuf.length !== generatedBuf.length || !crypto.timingSafeEqual(signatureBuf, generatedBuf)) {
      res.status(400).json({ success: false, error: 'Payment signature verification failed' });
      return;
    }

    // 3. Fetch order details from database to prevent payment replay
    const { data: dbOrder, error: dbError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .maybeSingle();

    if (dbError || !dbOrder) {
      console.error('[verify-payment] Order not found in database:', dbError);
      res.status(403).json({ success: false, error: 'Forbidden: Transaction not found.' });
      return;
    }

    if (dbOrder.user_id !== user.id) {
      console.error(`[verify-payment] Security alert: User ${user.id} tried to redeem order created by ${dbOrder.user_id}`);
      res.status(403).json({ success: false, error: 'Forbidden: Order does not belong to this user.' });
      return;
    }

    if (dbOrder.status === 'verified') {
      // Idempotent success response
      res.status(200).json({
        success: true,
        message: 'Payment already verified successfully.'
      });
      return;
    }

    // Update order status atomically using status constraint to lock it
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ status: 'verified' })
      .eq('id', order_id)
      .eq('status', 'created');

    if (orderUpdateError) {
      console.error('Failed to mark order as verified:', orderUpdateError);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
      return;
    }

    // 4. Fetch order details from Razorpay to get the pricing and plan name metadata
    const order = await razorpay.orders.fetch(order_id);
    const planId = String(order.notes?.planId || 'premium');
    const billingCycle = String(order.notes?.billingCycle || 'monthly');
    const amountInRs = Number(order.amount) / 100;
    const extraSeatsNum = parseInt(String(order.notes?.extraSeats || '0')) || 0;
    const couponApplied = String(order.notes?.couponApplied || '');

    let planName = 'Explorer';
    if (planId === 'go' || planId === 'go-subscription') planName = 'Individual';
    else if (planId === 'pro' || planId === 'premium') planName = 'Business';

    // Reconstruct invoice breakdown from order total using same pricing formulas as client
    const isExplorerFree = planId === 'explorer' || planId === 'starter' || planId === 'free';
    let baseSubtotal = 0;
    if (!isExplorerFree) {
      if (planId === 'go' || planId === 'go-subscription') {
        baseSubtotal = billingCycle === 'annual' ? 8438 : 799;
      } else {
        baseSubtotal = billingCycle === 'annual' ? 15830 : 1499;
      }
    }
    const seatUnitPrice = billingCycle === 'annual' ? 4990 : 499;
    const extraSeatsCost = isExplorerFree ? 0 : extraSeatsNum * seatUnitPrice;
    const subtotalAfterDiscount = Math.round(amountInRs / 1.18);
    const subtotalBeforeDiscount = baseSubtotal + extraSeatsCost;
    const discountAmount = Math.max(0, subtotalBeforeDiscount - subtotalAfterDiscount);
    const gstTotal = amountInRs - subtotalAfterDiscount;
    const cgst = Math.round(gstTotal / 2);
    const sgst = Math.round(gstTotal / 2);

    const planToSet = (planId === 'pro' || planId === 'premium') ? 'pro' : (planId === 'go' || planId === 'go-subscription') ? 'go' : 'explorer';
    const durationDays = billingCycle === 'annual' ? 365 : 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        subscription_plan: planToSet,
        subscription_expires_at: expiresAt
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update subscription plan in user profile:', updateError);
    }

    // 5. Fetch user name details from profiles if not available in auth metadata
    let firstName = user.user_metadata?.first_name || '';
    if (!firstName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .single();
      firstName = profile?.first_name || '';
    }

    // 6. Dispatch the payment invoice email with full invoice breakdown
    const emailHtml = getPaymentConfirmationTemplate({
      firstName,
      planName,
      transactionId: payment_id,
      billingCycle,
      baseSubtotal,
      extraSeats: extraSeatsNum,
      extraSeatsCost,
      discountAmount,
      couponCode: couponApplied && couponApplied !== 'None' ? couponApplied : null,
      subtotal: subtotalAfterDiscount,
      cgst,
      sgst,
      total: amountInRs,
      userEmail: user.email || '',
    });

    sendEmail({
      to: user.email || '',
      subject: `Payment Receipt — Lelam ${planName} Plan`,
      html: emailHtml
    }).catch(err => {
      console.error('Failed to dispatch payment receipt email:', err);
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        order_id,
        payment_id
      }
    });
  } catch (error: any) {
    console.error('Error verifying payment signature:', error);
    if (error.statusCode === 401) {
      res.status(401).json({
        success: false,
        error: {
          code: 'GATEWAY_AUTHENTICATION_FAILED',
          message: 'Payment gateway authentication failed. Please verify your Razorpay API keys in your .env file.'
        }
      });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
