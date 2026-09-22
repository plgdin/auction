import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { handleCorsPreflightIfNeeded, setCorsHeaders } from './_utils/cors.js';
import { isRateLimited, getClientIp } from './_utils/rateLimiter.js';
import { z } from 'zod';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const validateCouponSchema = z.object({
  code: z.string()
    .min(3, "Coupon code must be at least 3 characters")
    .max(20, "Coupon code must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Coupon code format is invalid")
});

const createOrderSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().optional().default('INR'),
  receipt: z.string().optional(),
  planId: z.string().min(1, "planId is required"),
  billingCycle: z.enum(['monthly', 'annual']),
  couponCode: z.string().optional().nullable(),
  isTrial: z.boolean().optional().default(false),
});

/**
 * Universal Checkout & Order Endpoint
 *
 * GET  /api/validate-coupon: Validates coupon code and returns discount percentage
 * POST /api/validate-coupon: Alternative method to validate coupon code
 * POST /api/create-order: Creates a verified Razorpay order with server-side coupon computation
 */
export default async function handler(req: any, res: any) {
  if (handleCorsPreflightIfNeeded(req, res)) return;
  setCorsHeaders(req, res);

  // Route 1: Validate Coupon requests (GET, or POST to /api/validate-coupon, or explicit { code } query/body)
  const isCouponCheck = req.method === 'GET' || req.url?.includes('validate-coupon') || (req.method === 'POST' && req.body?.code && !req.body?.planId);
  if (isCouponCheck) {
    return handleValidateCoupon(req, res);
  }

  // Route 2: Create Order requests (POST)
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

  // Parse request body stream if not pre-parsed
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
  if (isRateLimited(ip, 10, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
    return;
  }

  // Authenticate user session
  const authHeader = req.headers?.authorization || '';
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

  // Validate parameters using Zod
  const parseResult = createOrderSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: parseResult.error.issues[0]?.message || 'Invalid parameters'
    });
    return;
  }

  const { amount: clientAmount, planId, billingCycle, couponCode, isTrial } = parseResult.data;

  try {
    const isExplorerFree = (planId === 'free' || planId === 'explorer');
    let baseSubtotal = 0;
    if (isTrial || isExplorerFree) {
      baseSubtotal = 0;
    } else {
      if (planId === 'go' || planId === 'go-subscription') {
        baseSubtotal = billingCycle === 'annual' ? 8438 : 799;
      } else {
        baseSubtotal = billingCycle === 'annual' ? 15830 : 1499;
      }
    }

    const subtotalBeforeDiscount = baseSubtotal;
    let appliedDiscount = 0;

    if (couponCode && typeof couponCode === 'string' && couponCode.trim() !== '') {
      const sanitizedCoupon = couponCode.trim().toUpperCase();
      const { data: promo, error: promoErr } = await supabase
        .from('promo_codes')
        .select('discount_percent, is_active, expires_at')
        .eq('code', sanitizedCoupon)
        .maybeSingle();

      if (!promoErr && promo && promo.is_active) {
        const isNotExpired = !promo.expires_at || new Date(promo.expires_at) >= new Date();
        if (isNotExpired) {
          appliedDiscount = (promo.discount_percent || 0) / 100;
        }
      }
    }

    const discountAmount = Math.round(subtotalBeforeDiscount * appliedDiscount);
    const subtotal = subtotalBeforeDiscount - discountAmount;
    const calculatedTotal = subtotal;
    const amount = calculatedTotal * 100; // in paise

    if (clientAmount && Math.abs(clientAmount - amount) > 200) {
      res.status(400).json({ 
        success: false, 
        error: 'Security alert: Submitted amount does not match server calculation.' 
      });
      return;
    }

    if (amount < 100 && !isTrial && !isExplorerFree) {
      res.status(400).json({ success: false, error: 'Bad Request: Amount must be >= 100 paise' });
      return;
    }

    const planMapping: Record<string, Record<string, string>> = {
      'pro': {
        'monthly': 'plan_TSlNkTzPUEMs8y',
        'annual': 'plan_TSlWF58hGyT8OH'
      },
      'premium': {
        'monthly': 'plan_TSlNkTzPUEMs8y',
        'annual': 'plan_TSlWF58hGyT8OH'
      },
      'go': {
        'monthly': 'plan_TSlDazI9xe35m5',
        'annual': 'plan_TSlWowCfMg1nUc'
      },
      'go-subscription': {
        'monthly': 'plan_TSlDazI9xe35m5',
        'annual': 'plan_TSlWowCfMg1nUc'
      }
    };

    const rzpPlanId = planMapping[planId]?.[billingCycle];
    if (!rzpPlanId) {
      res.status(400).json({ success: false, error: 'Invalid plan or billing cycle selection.' });
      return;
    }

    const startAt = isTrial ? Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) : undefined;
    const subscription = await razorpay.subscriptions.create({
      plan_id: rzpPlanId,
      customer_notify: 1,
      total_count: billingCycle === 'annual' ? 10 : 120,
      start_at: startAt,
      notes: {
        planId: planId || '',
        billingCycle: billingCycle || '',
        couponApplied: appliedDiscount > 0 ? String(couponCode).toUpperCase() : 'None',
        isTrial: isTrial ? 'true' : 'false'
      }
    });

    const { error: dbError } = await supabase
      .from('orders')
      .insert({
        id: subscription.id,
        user_id: user.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        amount: calculatedTotal,
        status: 'created'
      });

    if (dbError) {
      console.error('[create-order] Failed to save subscription in database:', dbError);
      res.status(500).json({ success: false, error: 'Database error creating transaction.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        order_id: subscription.id,
        amount: calculatedTotal * 100,
        currency: 'INR',
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

export async function handleValidateCoupon(req: any, res: any) {
  if (typeof res?.setHeader === 'function') {
    if (handleCorsPreflightIfNeeded(req, res)) return;
    setCorsHeaders(req, res);
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip, 10, 60 * 1000)) {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.'
      }
    });
    return;
  }

  // Parse POST body if needed
  if (req.method === 'POST' && !req.body) {
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

  const rawCode = req.method === 'GET' ? req.query?.code : req.body?.code;
  if (rawCode === undefined || rawCode === null || String(rawCode).trim() === '') {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Coupon code parameter is required.'
      }
    });
    return;
  }

  const parseResult = validateCouponSchema.safeParse({ code: rawCode });
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: parseResult.error.issues[0]?.message || 'Invalid parameters'
      }
    });
    return;
  }

  const code = parseResult.data.code.trim().toUpperCase();

  try {
    const { data: promoCode, error: queryError } = await supabase
      .from('promo_codes')
      .select('discount_percent, is_active, expires_at')
      .eq('code', code)
      .maybeSingle();

    if (queryError) {
      console.error('Error fetching promo code:', queryError);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while validating the coupon.'
        }
      });
      return;
    }

    if (!promoCode) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_COUPON',
          message: 'Invalid coupon code.'
        }
      });
      return;
    }

    if (!promoCode.is_active) {
      res.status(400).json({
        success: false,
        error: {
          code: 'COUPON_INACTIVE',
          message: 'This coupon code is no longer active.'
        }
      });
      return;
    }

    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'COUPON_EXPIRED',
          message: 'This coupon code has expired.'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        code,
        discount_percent: promoCode.discount_percent
      }
    });
  } catch (error: any) {
    console.error('Unexpected error validating coupon:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.'
      }
    });
  }
}

export { handleValidateCoupon as validateCouponHandler };
