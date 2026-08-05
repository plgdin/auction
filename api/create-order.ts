import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

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

  console.log('[create-order] Method:', req.method);

  if (req.method !== 'POST') {
    console.log('[create-order] REJECTED: method is not POST, it is:', req.method);
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

  try {
    // Authenticate User
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      console.log('[create-order] No auth token provided');
      res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.log('[create-order] Auth failed:', authError?.message);
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
      return;
    }

    const { amount, currency, receipt, planId, billingCycle, extraSeats } = req.body;
    console.log('[create-order] Creating order — amount:', amount, 'currency:', currency || 'INR');

    if (!amount || typeof amount !== 'number' || amount < 100) {
      console.log('[create-order] Invalid amount:', amount);
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
      }
    });

    console.log('[create-order] SUCCESS — order_id:', order.id);

    res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      }
    });
  } catch (error: any) {
    console.error('[create-order] RAZORPAY ERROR:', JSON.stringify(error, null, 2));
    const errMessage = error.error?.description || error.error?.message || error.message || 'Failed to create Razorpay order.';
    res.status(400).json({
      success: false,
      error: {
        code: error.error?.code || 'RAZORPAY_ORDER_FAILED',
        message: errMessage
      }
    });
  }
}
