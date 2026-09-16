import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
  type TemplateComponent,
} from './utils/whatsapp.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface BroadcastRequestBody {
  templateName?: string;
  languageCode?: string;
  components?: TemplateComponent[];
  customMessage?: string;
  categoryFilter?: string;
  stateFilter?: string;
  dryRun?: boolean;
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
  if (isRateLimited(ip, 20, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  // Auth: machine secret or admin JWT
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  let isAdmin = false;
  if (INTERNAL_API_SECRET && token === INTERNAL_API_SECRET) {
    isAdmin = true;
  } else if (token) {
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

  const {
    templateName,
    languageCode = 'en',
    components = [],
    customMessage,
    dryRun = false,
  } = req.body as BroadcastRequestBody;

  if (!templateName && !customMessage) {
    res.status(400).json({ success: false, error: 'Either templateName or customMessage must be provided' });
    return;
  }

  try {
    // 1. Fetch eligible users who opted-in to WhatsApp marketing and have a valid phone number
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

    // Filter recipients with active marketing preference or where preference row is default
    const eligibleRecipients = (profiles || []).filter((p: any) => {
      if (!p.phone || p.phone.trim().length < 8) return false;
      const prefs = p.user_notification_preferences;
      // If user specifically has preference set, honor it
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

    // 2. Execute broadcast dispatch with rate limiting
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

        // Small 50ms throttle between dispatches
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
      errors: errors.slice(0, 10), // truncate errors list in response
    });
  } catch (error: any) {
    console.error('[whatsapp-broadcast] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
