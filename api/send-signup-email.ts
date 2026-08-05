import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';
import { sendEmail, getSignupWelcomeTemplate } from './utils/email.js';
import { handleCorsPreflightIfNeeded, setCorsHeaders } from './utils/cors.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export default async function handler(req: any, res: any) {
  // CORS — restricted to allowed origins (not wildcard)
  if (handleCorsPreflightIfNeeded(req, res)) return;
  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  // Rate Limiting: 5 requests per minute per IP
  const ip = getClientIp(req);
  if (isRateLimited(ip, 5, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
    return;
  }

  try {
    // 1. Authenticate — require valid Supabase JWT
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
      return;
    }

    // 2. Pull email from the verified user record — never trust req.body.email
    const email = user.email;
    if (!email) {
      res.status(400).json({ success: false, error: 'User has no email address.' });
      return;
    }

    // 3. Check idempotency flag — prevent duplicate sends
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, welcome_email_sent')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[send-signup-email] Error fetching profile:', profileError);
      res.status(500).json({ success: false, error: 'Failed to fetch user profile.' });
      return;
    }

    if (profile?.welcome_email_sent) {
      // Already sent — idempotent success, no re-send
      res.status(200).json({ success: true, message: 'Welcome email already sent.' });
      return;
    }

    // 4. Send the welcome email
    const firstName = profile?.first_name || user.user_metadata?.first_name || '';
    const html = getSignupWelcomeTemplate(firstName);
    const success = await sendEmail({
      to: email,
      subject: 'Welcome to Lelam Company!',
      html
    });

    if (success) {
      // 5. Mark as sent atomically
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ welcome_email_sent: true })
        .eq('id', user.id)
        .eq('welcome_email_sent', false); // Atomic: only update if still false

      if (updateError) {
        console.error('[send-signup-email] Failed to set welcome_email_sent flag:', updateError);
        // Email was sent but flag update failed — still return success
        // (next call will be a no-op due to the flag check, and worst case
        // a duplicate email is better than a confusing error)
      }

      res.status(200).json({ success: true, message: 'Signup confirmation email sent successfully.' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to dispatch email.' });
    }
  } catch (error: any) {
    console.error('[send-signup-email] Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
