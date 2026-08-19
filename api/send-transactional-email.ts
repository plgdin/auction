import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';
import {
  sendEmail,
  getBidConfirmationTemplate,
  getOutbidAlertTemplate,
  getEmdReceiptTemplate,
} from './utils/email.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

type EmailType = 'bid_confirmation' | 'outbid_alert' | 'emd_receipt';

interface BidConfirmationPayload {
  bidder_id: string;
  auction_id: string;
  amount: number;
}

interface OutbidAlertPayload {
  bidder_id: string;
  auction_id: string;
}

interface EmdReceiptPayload {
  user_id: string;
  amount: number;
  reference_id: string;
}

/**
 * Internal-only endpoint called by pg_net database triggers.
 * NOT for client use — authenticates via INTERNAL_API_SECRET.
 *
 * POST /api/send-transactional-email
 * Body: { type: EmailType, payload: {...} }
 */
export default async function handler(req: any, res: any) {
  // No CORS headers — this endpoint is internal-only (called by pg_net from Supabase)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  // Parse request body if not pre-parsed
  if (!req.body) {
    try {
      req.body = await new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch {
            resolve({});
          }
        });
        req.on('error', (err: any) => { reject(err); });
      });
    } catch {
      req.body = {};
    }
  }

  // Rate Limiting: 50 requests/min per IP (higher for DB triggers)
  const ip = getClientIp(req);
  if (isRateLimited(ip, 50, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  // Authenticate via shared secret (not JWT — this is machine-to-machine)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!INTERNAL_API_SECRET || token !== INTERNAL_API_SECRET) {
    console.error('[send-transactional-email] Unauthorized: Invalid or missing INTERNAL_API_SECRET');
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const { type, payload } = req.body as { type: EmailType; payload: any };

    if (!type || !payload) {
      res.status(400).json({ success: false, error: 'Missing type or payload' });
      return;
    }

    switch (type) {
      case 'bid_confirmation':
        await handleBidConfirmation(payload);
        break;
      case 'outbid_alert':
        await handleOutbidAlert(payload);
        break;
      case 'emd_receipt':
        await handleEmdReceipt(payload);
        break;
      default:
        res.status(400).json({ success: false, error: `Unknown email type: ${type}` });
        return;
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[send-transactional-email] Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getUserProfile(userId: string): Promise<{ email: string; first_name: string } | null> {
  // Get email from auth.users
  const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !user?.email) {
    console.error(`[send-transactional-email] Failed to fetch user ${userId}:`, authError);
    return null;
  }

  // Get first_name from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', userId)
    .single();

  return {
    email: user.email,
    first_name: profile?.first_name || user.user_metadata?.first_name || '',
  };
}

async function getAuctionDetails(auctionId: string): Promise<{ title: string } | null> {
  const { data, error } = await supabase
    .from('auctions')
    .select('title')
    .eq('id', auctionId)
    .single();

  if (error || !data) {
    console.error(`[send-transactional-email] Failed to fetch auction ${auctionId}:`, error);
    return null;
  }

  return data;
}

async function handleBidConfirmation(payload: BidConfirmationPayload): Promise<void> {
  const { bidder_id, auction_id, amount } = payload;

  if (!bidder_id || !auction_id || !amount) {
    console.error('[send-transactional-email] bid_confirmation: missing fields');
    return;
  }

  const [user, auction] = await Promise.all([
    getUserProfile(bidder_id),
    getAuctionDetails(auction_id),
  ]);

  if (!user || !auction) return;

  const auctionUrl = `https://lelam.co/auctions/${auction_id}`;
  const html = getBidConfirmationTemplate(user.first_name, auction.title, amount, auctionUrl);

  await sendEmail({
    to: user.email,
    subject: `Bid Confirmed: ${auction.title}`,
    html,
  });
}

async function handleOutbidAlert(payload: OutbidAlertPayload): Promise<void> {
  const { bidder_id, auction_id } = payload;

  if (!bidder_id || !auction_id) {
    console.error('[send-transactional-email] outbid_alert: missing fields');
    return;
  }

  const [user, auction] = await Promise.all([
    getUserProfile(bidder_id),
    getAuctionDetails(auction_id),
  ]);

  if (!user || !auction) return;

  const auctionUrl = `https://lelam.co/auctions/${auction_id}`;
  const html = getOutbidAlertTemplate(user.first_name, auction.title, auctionUrl);

  await sendEmail({
    to: user.email,
    subject: `⚠️ Outbid: ${auction.title}`,
    html,
  });
}

async function handleEmdReceipt(payload: EmdReceiptPayload): Promise<void> {
  const { user_id, amount, reference_id } = payload;

  if (!user_id || !amount || !reference_id) {
    console.error('[send-transactional-email] emd_receipt: missing fields');
    return;
  }

  const user = await getUserProfile(user_id);
  if (!user) return;

  const html = getEmdReceiptTemplate(user.first_name, amount, reference_id);

  await sendEmail({
    to: user.email,
    subject: `Deposit Receipt: ₹${amount.toLocaleString('en-IN')}`,
    html,
  });
}
