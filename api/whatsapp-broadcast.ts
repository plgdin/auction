import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './_utils/rateLimiter.js';
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
  type TemplateComponent,
} from './_utils/whatsapp.js';
import { generateZomatoCopy, ZOMATO_HOOK_TEMPLATES } from './_utils/zomatoCopyEngine.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const APP_BASE_URL = process.env.VITE_APP_URL || 'https://lelam.co';

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface BroadcastRequestBody {
  templateName?: string;
  languageCode?: string;
  components?: TemplateComponent[];
  customMessage?: string;
  categoryFilter?: string;
  stateFilter?: string;
  dryRun?: boolean;
  // Campaign-specific fields
  styleId?: string;
  auctionId?: string;
  testPhone?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // GET: Preview available campaign styles and sample generated copy
  if (req.method === 'GET') {
    const sampleCopy = generateZomatoCopy(
      {
        id: 'sample-101',
        title: 'MSTC Heavy Copper Scrap & Transformer Lot',
        price: 350000,
        location: 'Mumbai, Maharashtra',
      },
      undefined,
      APP_BASE_URL
    );

    res.status(200).json({
      success: true,
      message: 'WhatsApp Broadcast & Campaign Engine Ready',
      availableStyles: ZOMATO_HOOK_TEMPLATES.map(t => ({ id: t.id, style: t.style })),
      sampleGeneratedNotification: sampleCopy,
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  // Parse body
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
  if (isRateLimited(ip, 30, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  // Auth: machine secret or admin JWT
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  let isAdmin = false;
  if (INTERNAL_API_SECRET && token === INTERNAL_API_SECRET) {
    isAdmin = true;
  } else if (token && supabase) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role === 'admin') {
        isAdmin = true;
      }
    }
  }

  if (!isAdmin) {
    res.status(401).json({ success: false, error: 'Unauthorized. Admin credentials required.' });
    return;
  }

  const body = req.body as BroadcastRequestBody;

  // Route 1: Dynamic Zomato / Outreach Campaign Mode
  if (body.styleId || body.testPhone || req.url?.includes('whatsapp-campaign')) {
    return handleCampaignDispatch(body, res);
  }

  // Route 2: Standard Template / Custom Message Broadcast Mode
  return handleStandardBroadcast(body, res);
}

async function handleCampaignDispatch(body: BroadcastRequestBody, res: any) {
  const { styleId, auctionId, testPhone, dryRun = false } = body;

  try {
    let auctionData: any = null;

    if (supabase) {
      if (auctionId) {
        const { data } = await supabase
          .from('auctions')
          .select('id, title, starting_price, location')
          .eq('id', auctionId)
          .maybeSingle();
        auctionData = data;

        if (!auctionData) {
          const { data: mstc } = await supabase
            .from('mstc_auctions')
            .select('id, title, reserve_price, location')
            .eq('id', auctionId)
            .maybeSingle();
          if (mstc) {
            auctionData = {
              id: mstc.id,
              title: mstc.title,
              starting_price: mstc.reserve_price,
              location: mstc.location,
            };
          }
        }
      } else {
        const { data } = await supabase
          .from('auctions')
          .select('id, title, starting_price, location')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        auctionData = data;
      }
    }

    const context = {
      id: auctionData?.id || 'live',
      title: auctionData?.title || 'Heavy Industrial Copper & Machinery Scrap',
      price: auctionData?.starting_price || 240000,
      location: auctionData?.location || 'State Industrial Zone',
    };

    const generatedCopy = generateZomatoCopy(context, styleId, APP_BASE_URL);

    if (testPhone) {
      const sendResult = await sendWhatsAppText(testPhone, generatedCopy.fullMessage, true);
      res.status(200).json({
        success: true,
        mode: 'test_phone',
        targetPhone: testPhone,
        copyStyle: generatedCopy.style,
        message: generatedCopy.fullMessage,
        deliveryResult: sendResult,
      });
      return;
    }

    if (!supabase) {
      res.status(200).json({
        success: true,
        dryRun: true,
        notice: 'Database client not initialized. Generated copy below.',
        generatedCopy,
      });
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select(`
        id,
        phone,
        first_name,
        user_notification_preferences (
          whatsapp_marketing
        )
      `)
      .not('phone', 'is', null);

    const eligible = (profiles || []).filter((p: any) => {
      if (!p.phone || p.phone.trim().length < 8) return false;
      const prefs = p.user_notification_preferences;
      if (Array.isArray(prefs) && prefs.length > 0) {
        return prefs[0].whatsapp_marketing !== false;
      }
      return true;
    });

    if (dryRun) {
      res.status(200).json({
        success: true,
        dryRun: true,
        eligibleRecipientsCount: eligible.length,
        generatedCopy,
      });
      return;
    }

    let sent = 0;
    let failed = 0;

    for (const recipient of eligible) {
      try {
        const result = await sendWhatsAppText(recipient.phone, generatedCopy.fullMessage, true, recipient.id);
        if (result.success) sent++;
        else failed++;
        await sleep(50);
      } catch {
        failed++;
      }
    }

    res.status(200).json({
      success: true,
      totalRecipients: eligible.length,
      sent,
      failed,
      copyStyle: generatedCopy.style,
      preview: generatedCopy.fullMessage,
    });
  } catch (error: any) {
    console.error('[whatsapp-broadcast:campaign] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

async function handleStandardBroadcast(body: BroadcastRequestBody, res: any) {
  const {
    templateName,
    languageCode = 'en',
    components = [],
    customMessage,
    dryRun = false,
  } = body;

  if (!templateName && !customMessage) {
    res.status(400).json({ success: false, error: 'Either templateName or customMessage must be provided' });
    return;
  }

  try {
    if (!supabase) {
      res.status(500).json({ success: false, error: 'Supabase client not initialized' });
      return;
    }

    const { data: profiles, error: queryError } = await supabase
      .from('profiles')
      .select(`
        id,
        phone,
        first_name,
        user_notification_preferences (
          whatsapp_marketing
        )
      `)
      .not('phone', 'is', null);

    if (queryError) {
      throw queryError;
    }

    const eligibleRecipients = (profiles || []).filter((p: any) => {
      if (!p.phone || p.phone.trim().length < 8) return false;
      const prefs = p.user_notification_preferences;
      if (Array.isArray(prefs) && prefs.length > 0) {
        return prefs[0].whatsapp_marketing !== false;
      }
      return true;
    });

    if (dryRun) {
      res.status(200).json({
        success: true,
        dryRun: true,
        recipientCount: eligibleRecipients.length,
        sampleRecipients: eligibleRecipients.slice(0, 5).map(r => ({
          name: r.first_name,
          phone: r.phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2'),
        })),
      });
      return;
    }

    let sentCount = 0;
    let failCount = 0;
    const errors: Array<{ phone: string; error: string }> = [];

    for (const recipient of eligibleRecipients) {
      try {
        let sendResult;
        if (templateName) {
          sendResult = await sendWhatsAppTemplate(
            recipient.phone,
            templateName,
            languageCode,
            components,
            recipient.id
          );
        } else {
          sendResult = await sendWhatsAppText(
            recipient.phone,
            customMessage!,
            true,
            recipient.id
          );
        }

        if (sendResult.success) {
          sentCount++;
        } else {
          failCount++;
          errors.push({ phone: recipient.phone, error: sendResult.error || 'Unknown error' });
        }

        await sleep(50);
      } catch (err: any) {
        failCount++;
        errors.push({ phone: recipient.phone, error: err.message || 'Dispatch error' });
      }
    }

    res.status(200).json({
      success: true,
      totalRecipients: eligibleRecipients.length,
      sentCount,
      failCount,
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error('[whatsapp-broadcast] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
