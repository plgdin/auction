import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { handleCorsPreflightIfNeeded, setCorsHeaders } from './utils/cors.js';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';
import { z } from 'zod';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

const createOrderSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional().default('INR'),
  receipt: z.string().optional(),
  planId: z.string().min(1, "planId is required"),
  billingCycle: z.enum(['monthly', 'annual']),
  extraSeats: z.coerce.number().int().nonnegative().optional().default(0),
  couponCode: z.string().optional().nullable(),
});

export default async function handler(req: any, res: any) {
  // CORS — restricted to allowed origins
  if (handleCorsPreflightIfNeeded(req, res)) return;
  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

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

  // 1. IP-based Rate Limiting (10 requests/minute)
  const ip = getClientIp(req);
  if (isRateLimited(ip, 10, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
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

    // 2. User-based Rate Limiting (5 requests/minute) to prevent spamming payment creations
    if (isRateLimited(`order:${user.id}`, 5, 60 * 1000)) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded for creating orders. Please try again later.' });
      return;
    }

    // 3. Schema validation using Zod
    const validation = createOrderSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Bad Request: Invalid parameters', details: validation.error.issues });
      return;
    }

    const { amount: clientAmount, currency, receipt, planId, billingCycle, extraSeats, couponCode } = validation.data;

    // Calculate subtotal & total dynamically on server to ensure pricing integrity
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
    const extraSeatsNum = Math.max(0, Number(extraSeats) || 0);
    const extraSeatsCost = isExplorerFree ? 0 : extraSeatsNum * seatUnitPrice;
    const subtotalBeforeDiscount = baseSubtotal + extraSeatsCost;

    let appliedDiscount = 0;
    if (couponCode && couponCode.trim()) {
      const code = couponCode.trim().toUpperCase();
      const { data: promo, error: promoError } = await supabase
        .from('promo_codes')
        .select('discount_percent, is_active, expires_at')
        .eq('code', code)
        .maybeSingle();

      if (promoError) {
        console.error('Error validating coupon in create-order:', promoError);
      } else if (promo && promo.is_active) {
        const isNotExpired = !promo.expires_at || new Date(promo.expires_at) > new Date();
        if (isNotExpired) {
          appliedDiscount = promo.discount_percent / 100;
        }
      }
    }

    const discountAmount = Math.round(subtotalBeforeDiscount * appliedDiscount);
    const subtotal = subtotalBeforeDiscount - discountAmount;
    const gst = Math.round(subtotal * 0.18);
    const calculatedTotal = subtotal + gst;
    const amount = calculatedTotal * 100; // in paise

    // Verify client-sent amount aligns with calculated amount (within 200 paise / 2 INR margin for rounding)
    if (clientAmount && Math.abs(clientAmount - amount) > 200) {
      res.status(400).json({ 
        success: false, 
        error: 'Security alert: Submitted amount does not match server calculation.' 
      });
      return;
    }

    if (amount < 100) {
      res.status(400).json({ success: false, error: 'Bad Request: Amount must be >= 100 paise' });
      return;
    }

    // Call Razorpay API to create order
    const order = await razorpay.orders.create({
      amount,
      currency: currency || 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: {
        planId: planId || '',
        billingCycle: billingCycle || '',
        extraSeats: String(extraSeats || '0'),
        couponApplied: appliedDiscount > 0 ? String(couponCode).toUpperCase() : 'None',
      }
    });

    // 4. Save order to the database to associate it with the user and block payment replay
    const { error: dbError } = await supabase
      .from('orders')
      .insert({
        id: order.id,
        user_id: user.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        amount: calculatedTotal,
        status: 'created'
      });

    if (dbError) {
      console.error('[create-order] Failed to save order in database:', dbError);
      res.status(500).json({ success: false, error: 'Database error creating transaction.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      }
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
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
