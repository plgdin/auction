import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';
import { handleCorsPreflightIfNeeded, setCorsHeaders } from './utils/cors.js';
import { z } from 'zod';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const validateCouponSchema = z.object({
  code: z.string({
    required_error: "Coupon code parameter is required.",
    invalid_type_error: "Coupon code parameter is required."
  })
    .min(3, "Coupon code must be at least 3 characters")
    .max(20, "Coupon code must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Coupon code format is invalid")
});

export default async function handler(req: any, res: any) {
  // CORS — restricted to allowed origins
  if (handleCorsPreflightIfNeeded(req, res)) return;
  setCorsHeaders(req, res);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  // 1. Rate Limiting & Abuse Protection (Strict: 10 requests/min per IP to prevent brute-forcing)
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

  // Parse request body stream if POST and not pre-parsed
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
    // 2. Query promo code from Supabase
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

    // 3. Validate status & expiration
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

    // 4. Return successful match
    res.status(200).json({
      success: true,
      data: {
        code,
        discount_percent: promoCode.discount_percent
      }
    });

  } catch (error) {
    console.error('Coupon validation handler error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.'
      }
    });
  }
}
