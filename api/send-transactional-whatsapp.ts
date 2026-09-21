import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './_utils/rateLimiter.js';
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
  type WhatsAppSendResult,
} from './_utils/whatsapp.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const APP_BASE_URL = process.env.VITE_APP_URL || 'https://lelam.co';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export type WhatsAppNotificationType =
  | 'bid_confirmation'
  | 'outbid_alert'
  | 'auction_ending_soon'
  | 'emd_receipt'
  | 'new_auction_alert'
  | 'test_notification';

interface BidConfirmationPayload {
  bidder_id: string;
  auction_id: string;
  amount: number;
}

interface OutbidAlertPayload {
  bidder_id: string;
  auction_id: string;
  new_amount?: number;
}

interface AuctionEndingSoonPayload {
  user_id: string;
  auction_id: string;
  time_remaining?: string;
}

interface EmdReceiptPayload {
  user_id: string;
  amount: number;
  reference_id: string;
}

interface NewAuctionAlertPayload {
  user_id: string;
  category_name: string;
  auction_title: string;
  auction_id: string;
  location?: string;
}

interface TestNotificationPayload {
  user_id: string;
  phone?: string;
}

export default async function handler(req: any, res: any) {
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

  const ip = getClientIp(req);
  if (isRateLimited(ip, 60, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  // Authenticate: either INTERNAL_API_SECRET or valid Supabase JWT
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  let isAuthorized = false;
  let authenticatedUserId: string | null = null;

  if (INTERNAL_API_SECRET && token === INTERNAL_API_SECRET) {
    isAuthorized = true;
  } else if (token) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        isAuthorized = true;
        authenticatedUserId = user.id;
      }
    } catch {
      // invalid token
    }
  }

  if (!isAuthorized) {
    console.error('[send-transactional-whatsapp] Unauthorized: Invalid or missing token');
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const { type, payload } = req.body as {
      type: WhatsAppNotificationType;
      payload: any;
    };

    if (!type || !payload) {
      res.status(400).json({ success: false, error: 'Missing type or payload' });
      return;
    }

    // If authorized by user token, ensure they can only send notifications for themselves
    if (authenticatedUserId && payload.user_id && payload.user_id !== authenticatedUserId) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    let result: WhatsAppSendResult = { success: false };

    switch (type) {
      case 'bid_confirmation':
        result = await handleBidConfirmation(payload);
        break;
      case 'outbid_alert':
        result = await handleOutbidAlert(payload);
        break;
      case 'auction_ending_soon':
        result = await handleAuctionEndingSoon(payload);
        break;
      case 'emd_receipt':
        result = await handleEmdReceipt(payload);
        break;
      case 'new_auction_alert':
        result = await handleNewAuctionAlert(payload);
        break;
      case 'test_notification':
        result = await handleTestNotification(payload);
        break;
      default:
        res.status(400).json({ success: false, error: `Unknown notification type: ${type}` });
        return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[send-transactional-whatsapp] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUserWhatsAppProfile(userId: string): Promise<{
  phone: string;
  firstName: string;
  preferences: {
    whatsapp_bids: boolean;
    whatsapp_reminders: boolean;
    whatsapp_marketing: boolean;
  };
} | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, first_name')
    .eq('id', userId)
    .single();

  if (!profile || !profile.phone) {
    return null;
  }

  const { data: prefs } = await supabase
    .from('user_notification_preferences')
    .select('whatsapp_bids, whatsapp_reminders, whatsapp_marketing')
    .eq('user_id', userId)
    .single();

  return {
    phone: profile.phone,
    firstName: profile.first_name || 'Valued Bidder',
    preferences: {
      whatsapp_bids: prefs?.whatsapp_bids ?? true,
      whatsapp_reminders: prefs?.whatsapp_reminders ?? true,
      whatsapp_marketing: prefs?.whatsapp_marketing ?? false,
    },
  };
}

async function getAuctionDetails(auctionId: string): Promise<{ title: string; id: string } | null> {
  const { data: auction } = await supabase
    .from('auctions')
    .select('id, title')
    .eq('id', auctionId)
    .single();

  if (auction) return auction;

  // Check MSTC auctions if not found in core auctions
  const { data: mstc } = await supabase
    .from('mstc_auctions')
    .select('id, title')
    .eq('id', auctionId)
    .single();

  return mstc || null;
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

async function handleBidConfirmation(payload: BidConfirmationPayload): Promise<WhatsAppSendResult> {
  const user = await getUserWhatsAppProfile(payload.bidder_id);
  if (!user || !user.preferences.whatsapp_bids) {
    return { success: false, error: 'User opted out or missing phone number' };
  }

  const auction = await getAuctionDetails(payload.auction_id);
  const auctionTitle = auction?.title || 'Selected Auction';
  const auctionUrl = `${APP_BASE_URL}/auctions/${payload.auction_id}`;
  const formattedAmount = Number(payload.amount).toLocaleString('en-IN');

  const textMessage = `🔨 *Bid Placed Successfully!*

Hello ${user.firstName}, your bid of *₹${formattedAmount}* has been confirmed for:
"${auctionTitle}"

Track your auction and live bids here:
${auctionUrl}

_Lelam Auction Platform_`;

  // Try official pre-approved template first; fallback to text message
  const templateResult = await sendWhatsAppTemplate(
    user.phone,
    'bid_confirmation',
    'en',
    [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: user.firstName },
          { type: 'text', text: `₹${formattedAmount}` },
          { type: 'text', text: auctionTitle },
          { type: 'text', text: auctionUrl },
        ],
      },
    ],
    payload.bidder_id
  );

  if (!templateResult.success && templateResult.error?.includes('Meta API error')) {
    // If template not registered yet in Meta dashboard, send direct text message
    return sendWhatsAppText(user.phone, textMessage, true, payload.bidder_id);
  }

  return templateResult;
}

async function handleOutbidAlert(payload: OutbidAlertPayload): Promise<WhatsAppSendResult> {
  const user = await getUserWhatsAppProfile(payload.bidder_id);
  if (!user || !user.preferences.whatsapp_bids) {
    return { success: false, error: 'User opted out or missing phone number' };
  }

  const auction = await getAuctionDetails(payload.auction_id);
  const auctionTitle = auction?.title || 'Selected Auction';
  const auctionUrl = `${APP_BASE_URL}/auctions/${payload.auction_id}`;

  const textMessage = `⚠️ *You Have Been Outbid!*

Hello ${user.firstName}, another bidder has placed a higher bid on:
"${auctionTitle}"

Don't let it slip away! Place your counter-bid now:
${auctionUrl}

_Lelam Auction Platform_`;

  const templateResult = await sendWhatsAppTemplate(
    user.phone,
    'outbid_alert',
    'en',
    [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: user.firstName },
          { type: 'text', text: auctionTitle },
          { type: 'text', text: auctionUrl },
        ],
      },
    ],
    payload.bidder_id
  );

  if (!templateResult.success && templateResult.error?.includes('Meta API error')) {
    return sendWhatsAppText(user.phone, textMessage, true, payload.bidder_id);
  }

  return templateResult;
}

async function handleAuctionEndingSoon(payload: AuctionEndingSoonPayload): Promise<WhatsAppSendResult> {
  const user = await getUserWhatsAppProfile(payload.user_id);
  if (!user || !user.preferences.whatsapp_reminders) {
    return { success: false, error: 'User opted out or missing phone number' };
  }

  const auction = await getAuctionDetails(payload.auction_id);
  const auctionTitle = auction?.title || 'Auction';
  const auctionUrl = `${APP_BASE_URL}/auctions/${payload.auction_id}`;
  const timeLeft = payload.time_remaining || '1 hour';

  const textMessage = `⏰ *Auction Ending Soon!*

Hello ${user.firstName}, the auction for "${auctionTitle}" is closing in *${timeLeft}*!

Check final bidding and verify your participation:
${auctionUrl}

_Lelam Auction Platform_`;

  return sendWhatsAppText(user.phone, textMessage, true, payload.user_id);
}

async function handleEmdReceipt(payload: EmdReceiptPayload): Promise<WhatsAppSendResult> {
  const user = await getUserWhatsAppProfile(payload.user_id);
  if (!user) {
    return { success: false, error: 'User not found or missing phone number' };
  }

  const formattedAmount = Number(payload.amount).toLocaleString('en-IN');
  const textMessage = `✅ *EMD Deposit Confirmed*

Hello ${user.firstName}, we have received your Earnest Money Deposit (EMD) of *₹${formattedAmount}*.
Ref ID: *${payload.reference_id}*

You are now eligible to place bids on this lot.

_Lelam Auction Platform_`;

  return sendWhatsAppText(user.phone, textMessage, false, payload.user_id);
}

async function handleNewAuctionAlert(payload: NewAuctionAlertPayload): Promise<WhatsAppSendResult> {
  const user = await getUserWhatsAppProfile(payload.user_id);
  if (!user || !user.preferences.whatsapp_marketing) {
    return { success: false, error: 'User opted out of marketing updates' };
  }

  const auctionUrl = `${APP_BASE_URL}/auctions/${payload.auction_id}`;
  const textMessage = `🔔 *New Auction Matching Your Interests!*

Hello ${user.firstName}, a new auction was listed in *${payload.category_name}*:
"${payload.auction_title}"${payload.location ? `\n📍 Location: ${payload.location}` : ''}

View details & participate:
${auctionUrl}

_Lelam Auction Platform_`;

  return sendWhatsAppText(user.phone, textMessage, true, payload.user_id);
}

async function handleTestNotification(payload: TestNotificationPayload): Promise<WhatsAppSendResult> {
  let targetPhone = payload.phone;
  let userName = 'Valued User';

  if (payload.user_id) {
    const user = await getUserWhatsAppProfile(payload.user_id);
    if (user?.phone) {
      targetPhone = user.phone;
      userName = user.firstName;
    }
  }

  if (!targetPhone) {
    return { success: false, error: 'No phone number provided or found on profile' };
  }

  const message = `🎉 *Lelam WhatsApp Automation Connected!*

Hello ${userName}, this is a verification message confirming that your WhatsApp notification channel is active.

You will receive real-time alerts for:
• Bid Confirmations & Outbid Warnings
• Auction Closing Reminders
• EMD Receipts & Winning Notices

Thank you for choosing Lelam!`;

  return sendWhatsAppText(targetPhone, message, false, payload.user_id);
}
