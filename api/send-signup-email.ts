import { isRateLimited, getClientIp } from './utils/rateLimiter.js';
import { sendEmail, getSignupWelcomeTemplate } from './utils/email.js';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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

  // 1. Rate Limiting (5 requests per minute per IP for email triggers)
  const ip = getClientIp(req);
  if (isRateLimited(ip, 5, 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
    return;
  }

  try {
    const { email, firstName } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'Missing email address.' });
      return;
    }

    const html = getSignupWelcomeTemplate(firstName || '');
    const success = await sendEmail({
      to: email,
      subject: 'Welcome to Lelam Company!',
      html
    });

    if (success) {
      res.status(200).json({ success: true, message: 'Signup confirmation email sent successfully.' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to dispatch email.' });
    }
  } catch (error: any) {
    console.error('Error sending signup email:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
