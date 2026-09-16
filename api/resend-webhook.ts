import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  // Parse request body stream if not parsed
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        let str = '';
        req.on('data', (chunk: any) => { str += chunk; });
        req.on('end', () => resolve(str));
        req.on('error', reject);
      });
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
  }

  const eventType = body?.type;
  const eventData = body?.data;
  const recipient = (eventData?.to?.[0] || '').toLowerCase().trim();
  const resendId = eventData?.email_id || eventData?.id;

  console.log(`[Resend Webhook] Event: ${eventType}, Email: ${recipient}, ID: ${resendId}`);

  if (supabase && recipient) {
    try {
      if (eventType === 'email.bounced') {
        // Add to unsubscribes
        await supabase.from('email_unsubscribes').upsert({
          email: recipient,
          reason: 'bounced',
          unsubscribed_at: new Date().toISOString()
        }, { onConflict: 'email' });

        // Update queue
        await supabase.from('email_campaign_queue')
          .update({ status: 'bounced', last_error: JSON.stringify(eventData?.bounce || 'bounced'), updated_at: new Date().toISOString() })
          .eq('recipient_email', recipient);

      } else if (eventType === 'email.complained') {
        // Spam complaint
        await supabase.from('email_unsubscribes').upsert({
          email: recipient,
          reason: 'spam_complaint',
          unsubscribed_at: new Date().toISOString()
        }, { onConflict: 'email' });

        await supabase.from('email_campaign_queue')
          .update({ status: 'complained', updated_at: new Date().toISOString() })
          .eq('recipient_email', recipient);

      } else if (eventType === 'email.delivered') {
        await supabase.from('email_campaign_queue')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('recipient_email', recipient);
      }
    } catch (dbErr) {
      console.warn('[Resend Webhook] DB update failed:', dbErr);
    }
  }

  res.status(200).json({ received: true });
}
