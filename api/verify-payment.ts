import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';
import { sendEmail, getPaymentConfirmationTemplate } from './utils/email.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const keyId = (process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_GATEWAY_KEYS',
        message: 'Razorpay API Key ID or Key Secret is missing in environment.'
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

    const { order_id, payment_id, signature } = req.body;
    if (!order_id || !payment_id || !signature) {
      res.status(400).json({ success: false, error: 'Bad Request: Missing required parameters' });
      return;
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      res.status(400).json({ success: false, error: 'Payment signature verification failed' });
      return;
    }

    // 1. Fetch order details from Razorpay to get the pricing and plan name metadata
    const order = await razorpay.orders.fetch(order_id);
    const planId = String(order.notes?.planId || 'premium');
    const billingCycle = String(order.notes?.billingCycle || 'monthly');
    const amountInRs = Number(order.amount) / 100;

    let planName = 'Explorer';
    if (planId === 'go' || planId === 'go-subscription') planName = 'Individual';
    else if (planId === 'pro' || planId === 'premium') planName = 'Business';

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

    // 3. Fetch user name details from profiles if not available in auth metadata
    let firstName = user.user_metadata?.first_name || '';
    if (!firstName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .single();
      firstName = profile?.first_name || '';
    }

    // 3. Dispatch the payment invoice email
    const emailHtml = getPaymentConfirmationTemplate(
      firstName,
      planName,
      amountInRs,
      payment_id,
      billingCycle
    );

    sendEmail({
      to: user.email || '',
      subject: `Payment Receipt: Your subscription is active!`,
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
      res.status(500).json({
        success: false,
        error: {
          code: 'GATEWAY_UNAVAILABLE',
          message: 'Payment gateway verification is currently unavailable. Please try again later or contact support.'
        }
      });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
