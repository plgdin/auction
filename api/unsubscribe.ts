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
  const emailParam = req.query?.email || req.body?.email || '';
  const email = String(emailParam).trim().toLowerCase();

  if (email && supabase) {
    try {
      // 1. Add to unsubscribes table if table exists
      await supabase.from('email_unsubscribes').upsert(
        { email, reason: 'user_clicked_unsubscribe', unsubscribed_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

      // 2. Update any pending campaign queue entries
      await supabase
        .from('email_campaign_queue')
        .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
        .eq('recipient_email', email)
        .eq('status', 'pending');
    } catch (e) {
      console.warn('[Unsubscribe] Failed to record in Supabase:', e);
    }
  }

  // Return clean, branded HTML response
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
      padding: 40px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    .brand {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin-bottom: 24px;
      display: inline-block;
      text-decoration: none;
    }
    .brand span { color: #0284c7; }
    .icon {
      width: 56px;
      height: 56px;
      background: #ecfdf5;
      color: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 24px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 12px;
      color: #0f172a;
    }
    p {
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 24px;
    }
    .email-badge {
      display: inline-block;
      background: #f1f5f9;
      padding: 4px 12px;
      border-radius: 6px;
      font-family: monospace;
      color: #334155;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      background: #0284c7;
      color: #ffffff;
      text-decoration: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <a href="https://lelam.co" class="brand">lelam<span>.co</span></a>
    <div class="icon">&#10003;</div>
    <h1>You have been unsubscribed</h1>
    ${email ? `<div class="email-badge">${email}</div>` : ''}
    <p>You will no longer receive procurement updates or campaign emails from Lelam.</p>
    <a href="https://lelam.co" class="btn">Return to Lelam.co</a>
  </div>
</body>
</html>`);
}
