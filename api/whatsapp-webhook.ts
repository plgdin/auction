import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  sendWhatsAppText,
  sendWhatsAppInteractiveButtons,
  markWhatsAppMessageAsRead,
  normalizePhoneNumber,
} from './utils/whatsapp.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'lelam_whatsapp_verify_secret';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APP_BASE_URL = process.env.VITE_APP_URL || 'https://lelam.co';

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

/**
 * Meta WhatsApp Cloud API Webhook
 * GET: Webhook verification challenge
 * POST: Inbound messages and status delivery receipts
 */
export default async function handler(req: any, res: any) {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. GET Request: Meta Webhook Challenge Verification
  // ─────────────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'] || getQueryParam(req.url, 'hub.mode');
    const token = req.query?.['hub.verify_token'] || getQueryParam(req.url, 'hub.verify_token');
    const challenge = req.query?.['hub.challenge'] || getQueryParam(req.url, 'hub.challenge');

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('[WhatsApp Webhook] Verification successful!');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
      return;
    }

    console.warn('[WhatsApp Webhook] Verification failed: Invalid token or mode');
    res.status(403).json({ error: 'Verification token mismatch' });
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. POST Request: Inbound Events (Messages, Delivery Statuses)
  // ─────────────────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    // Parse body if not pre-parsed
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

    // Acknowledge Meta immediately with 200 OK so it doesn't trigger retries
    res.status(200).json({ status: 'ok' });

    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0]?.value;

      if (!change) return;

      // Handle delivery status updates (sent, delivered, read, failed)
      if (change.statuses && change.statuses.length > 0) {
        await handleStatusUpdate(change.statuses[0]);
      }

      // Handle incoming messages from users
      if (change.messages && change.messages.length > 0) {
        for (const message of change.messages) {
          await processInboundMessage(message, change.contacts?.[0]);
        }
      }
    } catch (err: any) {
      console.error('[WhatsApp Webhook] Error processing event:', err.message || err);
    }
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Updates
// ─────────────────────────────────────────────────────────────────────────────
async function handleStatusUpdate(statusObj: any) {
  if (!supabase || !statusObj?.id) return;
  const status = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
  const messageId = statusObj.id;

  try {
    await supabase
      .from('whatsapp_messages')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(statusObj.errors ? { error_message: JSON.stringify(statusObj.errors) } : {}),
      })
      .eq('whatsapp_message_id', messageId);
  } catch (err: any) {
    console.warn('[WhatsApp] Failed to update delivery status:', err.message || err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Inbound Bot Logic
// ─────────────────────────────────────────────────────────────────────────────
async function processInboundMessage(message: any, contact: any) {
  const from = message.from; // Sender's normalized phone number
  const messageId = message.id;
  const senderName = contact?.profile?.name || 'there';

  // Mark message as read
  await markWhatsAppMessageAsRead(messageId);

  // Extract message content
  let userText = '';
  let buttonPayload = '';

  if (message.type === 'text') {
    userText = message.text?.body?.trim() || '';
  } else if (message.type === 'interactive') {
    if (message.interactive?.type === 'button_reply') {
      buttonPayload = message.interactive.button_reply?.id || '';
      userText = message.interactive.button_reply?.title || '';
    }
  }

  // Find linked user profile if exists
  let linkedUserId: string | null = null;
  if (supabase) {
    const normalizedDigits = normalizePhoneNumber(from);
    const last10Digits = normalizedDigits.slice(-10);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name')
      .or(`phone.eq.${normalizedDigits},phone.eq.+${normalizedDigits},phone.ilike.%${last10Digits}`)
      .limit(1)
      .maybeSingle();

    if (profile) {
      linkedUserId = profile.id;
    }

    // Log inbound message
    await supabase.from('whatsapp_messages').insert({
      user_id: linkedUserId,
      phone: from,
      direction: 'inbound',
      type: message.type || 'text',
      content: userText || buttonPayload,
      payload: message,
      status: 'delivered',
      whatsapp_message_id: messageId,
    });
  }

  // Bot Intent Resolution
  const lower = userText.toLowerCase();

  // 1. Menu / Greeting / Start
  if (
    buttonPayload === 'btn_menu' ||
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower === 'start' ||
    lower === 'menu' ||
    lower === 'help'
  ) {
    await sendBotMenu(from, senderName, linkedUserId);
    return;
  }

  // 2. Search Auctions
  if (buttonPayload === 'btn_search' || lower.startsWith('search') || lower.startsWith('find')) {
    const query = lower.replace(/^(search|find)\s*/i, '').trim();
    if (!query || query === 'auctions') {
      await sendWhatsAppText(
        from,
        `🔍 *Search Lelam Auctions*\n\nReply with what you are looking for, for example:\n• *search copper*\n• *search iron scrap*\n• *search vehicles*\n• *search transformers*`,
        false,
        linkedUserId || undefined
      );
    } else {
      await executeAuctionSearch(from, query, linkedUserId);
    }
    return;
  }

  // 3. Check Active Bids
  if (buttonPayload === 'btn_bids' || lower === 'bids' || lower === 'my bids' || lower === 'status') {
    await handleUserBidsQuery(from, linkedUserId);
    return;
  }

  // 4. Customer Support
  if (buttonPayload === 'btn_support' || lower === 'support' || lower.startsWith('helpdesk') || lower === 'agent') {
    await handleCustomerSupportQuery(from, senderName, userText, linkedUserId);
    return;
  }

  // If user typed a search term without 'search' prefix (e.g. 'copper', 'iron', 'steel', 'scrap')
  const commonAuctionKeywords = ['scrap', 'copper', 'iron', 'steel', 'aluminum', 'battery', 'vehicle', 'car', 'transformer', 'cable', 'pipe', 'plastic'];
  if (commonAuctionKeywords.some(k => lower.includes(k))) {
    await executeAuctionSearch(from, userText, linkedUserId);
    return;
  }

  // Default Fallback
  await sendWhatsAppText(
    from,
    `Hello ${senderName}! 👋\n\nI couldn't quite understand that. Here is what I can do:\n\n• Type *search <term>* (e.g., _search copper_) to discover live scrap lots\n• Type *bids* to review your active bids\n• Type *support* to speak with our support team\n• Type *menu* to see all options`,
    false,
    linkedUserId || undefined
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot Actions
// ─────────────────────────────────────────────────────────────────────────────

async function sendBotMenu(phone: string, name: string, userId: string | null) {
  const bodyText = `Welcome to *Lelam Auctions*, ${name}! 🏛️\n\nYour 24/7 assistant for government, PSU, and bank e-auctions.\n\nChoose an option below or type a search keyword directly:`;

  const buttons = [
    { id: 'btn_search', title: '🔍 Search Lots' },
    { id: 'btn_bids', title: '📋 My Bids' },
    { id: 'btn_support', title: '💬 Support' },
  ];

  await sendWhatsAppInteractiveButtons(
    phone,
    bodyText,
    buttons,
    'Lelam Auction Assistant',
    'Reply with any query or search term',
    userId || undefined
  );
}

async function executeAuctionSearch(phone: string, query: string, userId: string | null) {
  if (!supabase) {
    await sendWhatsAppText(phone, `Searching is currently unavailable. Please visit ${APP_BASE_URL}/auctions`, false, userId || undefined);
    return;
  }

  // Query auctions from public.auctions or public.mstc_auctions
  const { data: auctions } = await supabase
    .from('auctions')
    .select('id, title, starting_price, location, closing_date')
    .ilike('title', `%${query}%`)
    .limit(3);

  let results = auctions || [];

  if (results.length === 0) {
    const { data: mstc } = await supabase
      .from('mstc_auctions')
      .select('id, title, reserve_price, location, close_date')
      .ilike('title', `%${query}%`)
      .limit(3);

    if (mstc && mstc.length > 0) {
      results = mstc.map(m => ({
        id: m.id,
        title: m.title,
        starting_price: m.reserve_price,
        location: m.location,
        closing_date: m.close_date,
      }));
    }
  }

  if (results.length === 0) {
    await sendWhatsAppText(
      phone,
      `🔎 No active auctions found matching "*${query}*".\n\nTry browsing popular scrap categories:\n• Ferrous Scrap\n• Copper & Non-Ferrous\n• Heavy Machinery\n\nView all live auctions here: ${APP_BASE_URL}/auctions`,
      true,
      userId || undefined
    );
    return;
  }

  let reply = `🎯 *Found ${results.length} Auctions matching "${query}":*\n\n`;

  results.forEach((item, idx) => {
    const price = item.starting_price ? `₹${Number(item.starting_price).toLocaleString('en-IN')}` : 'Price on Request';
    reply += `*${idx + 1}. ${item.title}*\n`;
    reply += `💰 Price/EMD: ${price}\n`;
    if (item.location) reply += `📍 Location: ${item.location}\n`;
    reply += `🔗 View: ${APP_BASE_URL}/auctions/${item.id}\n\n`;
  });

  reply += `_For the complete catalog, visit ${APP_BASE_URL}/auctions_`;

  await sendWhatsAppText(phone, reply, true, userId || undefined);
}

async function handleUserBidsQuery(phone: string, userId: string | null) {
  if (!supabase || !userId) {
    await sendWhatsAppText(
      phone,
      `📋 We could not find an account linked to this WhatsApp number (+${phone}).\n\nPlease register or add your phone number in your profile settings at:\n${APP_BASE_URL}/dashboard/profile`,
      true,
      userId || undefined
    );
    return;
  }

  const { data: bids } = await supabase
    .from('bids')
    .select('id, amount, status, created_at, auction:auctions(id, title)')
    .eq('bidder_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!bids || bids.length === 0) {
    await sendWhatsAppText(
      phone,
      `You currently have no active bids on Lelam.\n\nExplore live auctions and start bidding: ${APP_BASE_URL}/auctions`,
      true,
      userId
    );
    return;
  }

  let reply = `📋 *Your Latest Bids:*\n\n`;
  bids.forEach((bid: any, idx) => {
    const auctionTitle = bid.auction?.title || 'Auction Lot';
    const statusEmoji = bid.status === 'winning' || bid.status === 'active' ? '🟢' : '🔴';
    reply += `${statusEmoji} *${idx + 1}. ${auctionTitle}*\n`;
    reply += `• Your Bid: ₹${Number(bid.amount).toLocaleString('en-IN')}\n`;
    reply += `• Status: *${bid.status.toUpperCase()}*\n`;
    reply += `• Link: ${APP_BASE_URL}/auctions/${bid.auction?.id || ''}\n\n`;
  });

  await sendWhatsAppText(phone, reply, true, userId);
}

async function handleCustomerSupportQuery(
  phone: string,
  name: string,
  userText: string,
  userId: string | null
) {
  if (supabase) {
    await supabase.from('contact_messages').insert({
      name: name || 'WhatsApp User',
      email: `${phone}@whatsapp.user`,
      subject: 'Inquiry via WhatsApp Bot',
      message: userText || 'Customer requested assistance via WhatsApp',
      status: 'pending',
    });
  }

  const reply = `💬 *Support Ticket Created*\n\nThank you ${name}! Our customer support team has been notified of your inquiry.\n\nAn agent will assist you shortly, or you can call our priority helpdesk directly at *+91 99999 99999*.\n\nOffice Hours: Mon - Sat, 9:00 AM - 7:00 PM IST.`;

  await sendWhatsAppText(phone, reply, false, userId || undefined);
}

function getQueryParam(url: string, param: string): string | null {
  if (!url) return null;
  const match = url.match(new RegExp(`[?&]${param}=([^&]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
