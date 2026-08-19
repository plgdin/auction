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

  // Rate Limiting: 5 requests per minute per IP
  const ip = getClientIp(req);
  if (isRateLimited(ip, 5, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
    return;
  }

  try {
    // 1. Authenticate — require valid Supabase JWT or INTERNAL_API_SECRET
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
      return;
    }

    const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
    let user: any = null;
    let isInternalCall = false;

    if (INTERNAL_API_SECRET && token === INTERNAL_API_SECRET) {
      isInternalCall = true;
      // Authenticated via machine-to-machine trigger secret
      const { user_id, email: bodyEmail, first_name: bodyFirstName } = req.body;
      if (!user_id) {
        res.status(400).json({ success: false, error: 'Missing user_id parameter.' });
        return;
      }
      
      if (bodyEmail) {
        user = {
          id: user_id,
          email: bodyEmail,
          user_metadata: { first_name: bodyFirstName || '' }
        };
      } else {
        const { data: adminUser, error: authError } = await supabase.auth.admin.getUserById(user_id);
        if (authError || !adminUser?.user) {
          res.status(400).json({ success: false, error: 'User not found.' });
          return;
        }
        user = adminUser.user;
      }
    } else {
      // Authenticated via client user session token
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authUser) {
        res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
        return;
      }
      user = authUser;
    }

    // 2. Pull email from the verified user record
    const email = user.email;
    if (!email) {
      res.status(400).json({ success: false, error: 'User has no email address.' });
      return;
    }

    // 3. Check idempotency flag
    let welcomeEmailAlreadySent = false;
    let firstName = '';

    if (isInternalCall) {
      // Trigger function has already checked and set the flag atomically in DB transaction
      welcomeEmailAlreadySent = false;
      firstName = user.user_metadata?.first_name || '';
    } else {
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

      welcomeEmailAlreadySent = !!profile?.welcome_email_sent;
      firstName = profile?.first_name || user.user_metadata?.first_name || '';
    }

    if (welcomeEmailAlreadySent) {
      res.status(200).json({ success: true, message: 'Welcome email already sent.' });
      return;
    }

    // 4. Send the welcome email
    const html = getSignupWelcomeTemplate(firstName);
    const success = await sendEmail({
      to: email,
      subject: 'Welcome to Lelam Company!',
      html
    });

    if (success) {
      // 5. Mark as sent atomically (only if not already done by DB trigger)
      if (!isInternalCall) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ welcome_email_sent: true })
          .eq('id', user.id)
          .eq('welcome_email_sent', false);

        if (updateError) {
          console.error('[send-signup-email] Failed to set welcome_email_sent flag:', updateError);
        }
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
