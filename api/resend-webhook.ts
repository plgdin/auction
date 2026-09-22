import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

/**
 * Universal Resend Webhook & Unsubscribe Handler
 *
 * GET  /api/unsubscribe: Renders branded unsubscribe page and marks user unsubscribed
 * POST /api/unsubscribe: API unsubscribe endpoint
 * POST /api/resend-webhook: Ingests bounce, spam complaints, delivery events from Resend
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Handle Unsubscribe via GET (link in emails) or explicit unsubscribe POST
  const isUnsubscribeRequest = req.method === 'GET' || req.url?.includes('unsubscribe') || (req.method === 'POST' && req.body?.email && !req.body?.type);

  if (isUnsubscribeRequest) {
    return handleUnsubscribe(req, res);
  }

  // Handle Resend Webhook POST events
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
        await supabase.from('email_unsubscribes').upsert({
          email: recipient,
          reason: 'bounced',
          unsubscribed_at: new Date().toISOString()
        }, { onConflict: 'email' });

        await supabase.from('email_campaign_queue')
          .update({ status: 'bounced', last_error: JSON.stringify(eventData?.bounce || 'bounced'), updated_at: new Date().toISOString() })
          .eq('recipient_email', recipient);

      } else if (eventType === 'email.complained') {
        await supabase.from('email_unsubscribes').upsert({
          email: recipient,
          reason: 'spam_complaint',
          unsubscribed_at: new Date().toISOString()
        }, { onConflict: 'email' });

        await supabase.from('email_campaign_queue')
          .update({ status: 'unsubscribed', last_error: 'spam_complaint', updated_at: new Date().toISOString() })
          .eq('recipient_email', recipient);

      } else if (eventType === 'email.delivered') {
        await supabase.from('email_campaign_queue')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('resend_id', resendId);
      }
    } catch (err) {
      console.error('[Resend Webhook] Database update error:', err);
    }
  }

  res.status(200).json({ received: true });
}

async function handleUnsubscribe(req: any, res: any) {
  const emailParam = req.query?.email || req.body?.email || '';
  const email = String(emailParam).trim().toLowerCase();

  if (email && supabase) {
    try {
      await supabase.from('email_unsubscribes').upsert(
        { email, reason: 'user_clicked_unsubscribe', unsubscribed_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

      await supabase
        .from('email_campaign_queue')
        .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
        .eq('recipient_email', email)
        .eq('status', 'pending');
    } catch (e) {
      console.warn('[Unsubscribe] Failed to record in Supabase:', e);
    }
  }

  if (req.method === 'POST' && req.headers?.['content-type']?.includes('application/json')) {
    res.status(200).json({ success: true, unsubscribed: email });
    return;
  }

  // Return clean, branded HTML confirmation response
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed — Lelam</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #0f172a;
    }
    .card {
      background: #ffffff;
      max-width: 480px;
      width: 90%;
      padding: 40px 32px;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .icon {
      width: 48px;
      height: 48px;
      background-color: #f1f5f9;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 12px;
      color: #0f172a;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #64748b;
      margin: 0 0 24px;
    }
    .email-tag {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      padding: 4px 12px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #1e293b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✉️</div>
    <h1>You're Unsubscribed</h1>
    ${email ? `<div class="email-tag">${email}</div>` : ''}
    <p>You have been removed from our outreach and marketing emails. You won't hear from us again.</p>
    <a href="https://lelam.co" class="btn">Go to Lelam Home</a>
  </div>
</body>
</html>`);
}
