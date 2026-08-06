import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Lelam Company <no-reply@lelam.co>';

// Check if credentials exist for a real SMTP transport
const hasSmtpConfig = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = (!RESEND_API_KEY && hasSmtpConfig)
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  const vercelEnv = process.env.VERCEL_ENV || '';
  const isProduction = vercelEnv === 'production' || process.env.NODE_ENV === 'production';
  const isPreview = vercelEnv === 'preview';

  // Preview environments never send real emails — force console-log fallback
  // to prevent test signups on preview branches from spamming real inboxes
  if (isPreview) {
    logMockEmail(to, subject, html);
    return true;
  }

  // 1. Try Resend HTTP API if key is present
  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: SMTP_FROM,
          to,
          subject,
          html,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Email] Email sent to ${to} via Resend: "${subject}" (ID: ${resData.id})`);
        return true;
      } else {
        console.error('[Email] Resend API error:', resData);
      }
    } catch (error) {
      console.error('[Email] Failed to send email via Resend API:', error);
    }
  }

  // 2. Try SMTP as fallback
  if (transporter) {
    try {
      await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        html,
      });
      console.log(`[Email] Email sent to ${to} via SMTP: "${subject}"`);
      return true;
    } catch (error) {
      console.error('[Email] Failed to send email via SMTP:', error);
    }
  }

  // 3. No provider available
  if (isProduction) {
    // In production, a missing provider is a critical configuration error —
    // surface it as a visible failure instead of a silent no-op success
    console.error(`[Email] CRITICAL: No email provider configured. Email to ${to} ("${subject}") was NOT sent. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.`);
    return false;
  }

  // Development: console-log preview for convenience
  logMockEmail(to, subject, html);
  return true;
}

/** Console-log preview of an email for local dev / preview environments */
function logMockEmail(to: string, subject: string, html: string): void {
  console.log('\n' + '='.repeat(80));
  console.log(`[MOCK EMAIL LOG] TO: ${to}`);
  console.log(`[MOCK EMAIL LOG] SUBJECT: ${subject}`);
  console.log(`[MOCK EMAIL LOG] FROM: ${SMTP_FROM}`);
  console.log('-'.repeat(80));
  const plainText = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  console.log(plainText);
  console.log('='.repeat(80) + '\n');
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

// Helper wrapper for layout, branding and inline CSS styling to prevent email client stripping
function getEmailWrapperHTML(
  title: string,
  preheader: string,
  contentHtml: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  <div style="display: none; font-size: 1px; color: #ffffff; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${preheader}</div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <img src="https://www.lelam.co/png_lelam_1.webp" alt="Lelam.co" style="display: block; margin: 0 auto 12px auto; height: 32px; max-width: 100%; border: 0; outline: none; text-decoration: none;" />
              <div style="color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${title}</div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 24px; background-color: #ffffff;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #0f172a;">Lelam Company &bull; B2B eAuction intelligence</p>
              <p style="margin: 0 0 16px 0;">&copy; ${new Date().getFullYear()} Lelam Company. All rights reserved.</p>
              <p style="margin: 0; line-height: 1.5;">If you have any questions regarding this email, please contact our support team at <a href="mailto:support@lelam.co" style="color: #0284c7; text-decoration: underline;">support@lelam.co</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getSignupWelcomeTemplate(firstName: string): string {
  const name = firstName || 'there';
  const contentHtml = `
    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">Welcome to the future of bidding, ${name}!</div>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.6;">Your account has been successfully registered. You are now ready to explore and bid on official government catalogs, bank properties, and commercial asset liquidations.</p>
    
    <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #0f172a;">Here is what you can do with your new account:</p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155;">
          <span style="color: #0284c7; font-weight: bold; margin-right: 8px;">✓</span> Browse and search active auctions with state-of-the-art fuzzy logic filters
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155;">
          <span style="color: #0284c7; font-weight: bold; margin-right: 8px;">✓</span> Instantly view and download official MSTC PDF catalogs
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155;">
          <span style="color: #0284c7; font-weight: bold; margin-right: 8px;">✓</span> Save listings to your Watchlist for real-time closing alerts
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155;">
          <span style="color: #0284c7; font-weight: bold; margin-right: 8px;">✓</span> Access live scrap commodity indices and valuations
        </td>
      </tr>
    </table>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0 8px 0;">
      <tr>
        <td align="center">
          <a href="https://lelam.co/auctions" style="display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px;" target="_blank">Start Browsing Auctions</a>
        </td>
      </tr>
    </table>
  `;
  return getEmailWrapperHTML('Welcome to Lelam', 'Start exploring active B2B eAuctions', contentHtml);
}

export interface PaymentInvoiceData {
  firstName: string;
  planName: string;
  transactionId: string;
  billingCycle: string;
  baseSubtotal: number;
  extraSeats: number;
  extraSeatsCost: number;
  discountAmount: number;
  couponCode: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  userEmail: string;
}

export function getPaymentConfirmationTemplate(data: PaymentInvoiceData): string {
  const name = data.firstName || 'Valued Customer';
  const fmtPrice = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const receiptNo = `REC-${data.transactionId.slice(-8)}`;
  const totalSeats = 1 + data.extraSeats;

  const contentHtml = `
    <!-- Invoice Title -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
      <tr>
        <td>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Tax Invoice / Payment Receipt</div>
          <p style="margin: 0 0 4px 0; font-size: 14px; color: #334155;">Dear ${name},</p>
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">Thank you for your payment. Your subscription is now active and your account privileges have been updated immediately.</p>
        </td>
      </tr>
    </table>

    <!-- Receipt Meta Info -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
      <tr><td style="padding: 16px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0; width: 40%;">Receipt No:</td>
            <td style="font-size: 12px; font-weight: 700; color: #0f172a; text-align: right; padding: 4px 0; font-family: 'Courier New', Courier, monospace;">${receiptNo}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Date:</td>
            <td style="font-size: 12px; font-weight: 600; color: #334155; text-align: right; padding: 4px 0;">${dateStr}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Status:</td>
            <td style="font-size: 12px; font-weight: 800; color: #059669; text-align: right; padding: 4px 0; text-transform: uppercase;">&#10003; Paid (Successful)</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Payment ID:</td>
            <td style="font-size: 12px; font-weight: 700; color: #0f172a; text-align: right; padding: 4px 0; font-family: 'Courier New', Courier, monospace;">${data.transactionId}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Payment Gateway:</td>
            <td style="font-size: 12px; font-weight: 600; color: #334155; text-align: right; padding: 4px 0;">Razorpay Secure</td>
          </tr>
          ${data.userEmail ? `<tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Account Email:</td>
            <td style="font-size: 12px; font-weight: 600; color: #334155; text-align: right; padding: 4px 0;">${data.userEmail}</td>
          </tr>` : ''}
        </table>
      </td></tr>
    </table>

    <!-- Itemized Invoice Table -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 8px; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #ffffff; background-color: #0f172a; padding: 10px 12px; font-weight: 700;">#</th>
          <th style="text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #ffffff; background-color: #0f172a; padding: 10px 12px; font-weight: 700;">Description</th>
          <th style="text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #ffffff; background-color: #0f172a; padding: 10px 12px; font-weight: 700;">Cycle</th>
          <th style="text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #ffffff; background-color: #0f172a; padding: 10px 12px; font-weight: 700;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0; color: #94a3b8; font-weight: 700;">1</td>
          <td style="padding: 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">
            Lelam ${data.planName} Plan
            <div style="font-size: 11px; color: #64748b; font-weight: 400; margin-top: 2px;">Full platform access &bull; ${totalSeats} seat${totalSeats > 1 ? 's' : ''}</div>
          </td>
          <td style="padding: 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; text-transform: capitalize; color: #334155;">${data.billingCycle}</td>
          <td style="padding: 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #334155; font-family: 'Courier New', Courier, monospace;">${fmtPrice(data.baseSubtotal)}</td>
        </tr>
        ${data.extraSeats > 0 ? `
        <tr>
          <td style="padding: 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0; color: #94a3b8; font-weight: 700;">2</td>
          <td style="padding: 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">
            Additional Team Seats (${data.extraSeats})
            <div style="font-size: 11px; color: #64748b; font-weight: 400; margin-top: 2px;">${data.extraSeats} extra team member seat${data.extraSeats > 1 ? 's' : ''}</div>
          </td>
          <td style="padding: 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; text-transform: capitalize; color: #334155;">${data.billingCycle}</td>
          <td style="padding: 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #334155; font-family: 'Courier New', Courier, monospace;">${fmtPrice(data.extraSeatsCost)}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <!-- Totals -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td width="50%"></td>
        <td width="50%">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 6px 0; font-size: 12px; color: #64748b;">Subtotal</td>
              <td style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #334155; text-align: right; font-family: 'Courier New', Courier, monospace;">${fmtPrice(data.baseSubtotal + data.extraSeatsCost)}</td>
            </tr>
            ${data.discountAmount > 0 ? `
            <tr>
              <td style="padding: 6px 0; font-size: 12px; color: #059669; font-weight: 600;">Discount${data.couponCode ? ` (${data.couponCode})` : ''}</td>
              <td style="padding: 6px 0; font-size: 12px; font-weight: 700; color: #059669; text-align: right; font-family: 'Courier New', Courier, monospace;">- ${fmtPrice(data.discountAmount)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 6px 0; font-size: 12px; color: #64748b;">CGST (9%)</td>
              <td style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #334155; text-align: right; font-family: 'Courier New', Courier, monospace;">${fmtPrice(data.cgst)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 12px; color: #64748b;">SGST (9%)</td>
              <td style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #334155; text-align: right; font-family: 'Courier New', Courier, monospace;">${fmtPrice(data.sgst)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0 6px 0; font-size: 14px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a;">Total Amount Paid</td>
              <td style="padding: 12px 0 6px 0; font-size: 15px; font-weight: 800; color: #0284c7; text-align: right; font-family: 'Courier New', Courier, monospace; border-top: 2px solid #0f172a;">${fmtPrice(data.total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Terms -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border-top: 1px solid #e2e8f0;">
      <tr><td style="padding-top: 16px;">
        <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 6px;">Terms & Conditions:</div>
        <div style="font-size: 10px; color: #64748b; line-height: 1.6;">
          1. All subscription payments are final and subject to Lelam platform policies.<br>
          2. For complete Terms & Conditions: <a href="https://lelam.co/terms" style="color: #0284c7; font-weight: 600; text-decoration: underline;">https://lelam.co/terms</a><br>
          3. For billing inquiries: <a href="mailto:support@lelam.co" style="color: #0284c7; font-weight: 600; text-decoration: underline;">support@lelam.co</a>
        </div>
        <div style="font-size: 9px; color: #94a3b8; font-style: italic; margin-top: 8px;">This is an authorized computer-generated receipt. No signature required.</div>
      </td></tr>
    </table>

    <!-- CTA Buttons -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 8px 0;">
      <tr>
        <td align="center">
          <a href="https://lelam.co/checkout?status=success&txn=${encodeURIComponent(data.transactionId)}" style="display: inline-block; background-color: #0f172a; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px;" target="_blank">View & Download Invoice</a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 10px;">
          <a href="https://lelam.co/dashboard" style="display: inline-block; color: #0284c7; text-decoration: underline; font-size: 13px; font-weight: 500;" target="_blank">Go to Dashboard &rarr;</a>
        </td>
      </tr>
    </table>
  `;
  return getEmailWrapperHTML('Payment Receipt & Tax Invoice', `Subscription Receipt — ${data.planName} Plan (${fmtPrice(data.total)})`, contentHtml);
}

export function getBidConfirmationTemplate(
  firstName: string,
  auctionTitle: string,
  bidAmount: number,
  auctionUrl: string
): string {
  const name = firstName || 'Bidder';
  const formattedAmount = `₹${bidAmount.toLocaleString('en-IN')}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">Dear ${name},</p>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #334155; line-height: 1.6;">Your bid has been successfully recorded in our ledger.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <tr>
        <td align="center">
          <div style="font-size: 11px; color: #047857; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Auction</div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 4px 0 16px 0;">${auctionTitle}</div>
          <div style="font-size: 11px; color: #047857; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Your Bid Amount</div>
          <div style="font-size: 28px; font-weight: 800; color: #065f46; margin: 8px 0 0 0;">${formattedAmount}</div>
        </td>
      </tr>
    </table>

    <p style="margin: 20px 0; font-size: 14px; color: #64748b; text-align: center;">You will be notified immediately if you are outbid.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 8px 0;">
      <tr>
        <td align="center">
          <a href="${auctionUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px;" target="_blank">View Live Auction</a>
        </td>
      </tr>
    </table>
  `;
  return getEmailWrapperHTML('Bid Confirmed', `Bid confirmation for ${auctionTitle}`, contentHtml);
}

export function getOutbidAlertTemplate(
  firstName: string,
  auctionTitle: string,
  auctionUrl: string
): string {
  const name = firstName || 'Bidder';

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">Dear ${name},</p>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #334155; line-height: 1.6;">Another participant has placed a higher bid on an auction you are competing in.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <tr>
        <td style="font-weight: 700; color: #92400e; font-size: 15px; text-align: center;">
          ${auctionTitle}
        </td>
      </tr>
    </table>

    <p style="margin: 20px 0; font-size: 14px; color: #334155; line-height: 1.6; text-align: center;">The auction is still active. Return to the bidding room to place a counter-bid before time runs out.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 8px 0;">
      <tr>
        <td align="center">
          <a href="${auctionUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px;" target="_blank">Place Counter Bid</a>
        </td>
      </tr>
    </table>
  `;
  return getEmailWrapperHTML('You Have Been Outbid', `Outbid alert for ${auctionTitle}`, contentHtml);
}

export function getEmdReceiptTemplate(
  firstName: string,
  amount: number,
  referenceId: string
): string {
  const name = firstName || 'Valued Customer';
  const formattedAmount = `₹${amount.toLocaleString('en-IN')}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">Dear ${name},</p>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #334155; line-height: 1.6;">We have successfully processed your wallet deposit.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #f1f5f9; width: 45%;">Transaction Reference:</td>
        <td style="padding: 12px 0; font-size: 14px; font-weight: 600; color: #334155; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: monospace;">${referenceId}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Date:</td>
        <td style="padding: 12px 0; font-size: 14px; font-weight: 600; color: #334155; text-align: right; border-bottom: 1px solid #f1f5f9;">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
      </tr>
      <tr class="total">
        <td style="padding: 16px 0; font-size: 16px; font-weight: 700; color: #0f172a; border-top: 2px solid #e2e8f0;">Amount Deposited</td>
        <td style="padding: 16px 0; font-size: 18px; font-weight: 800; color: #10b981; text-align: right; border-top: 2px solid #e2e8f0;">${formattedAmount}</td>
      </tr>
    </table>

    <p style="margin: 24px 0; font-size: 14px; color: #334155; line-height: 1.6; text-align: center;">These funds are now available in your ledger to participate in active auctions.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 8px 0;">
      <tr>
        <td align="center">
          <a href="https://lelam.co/wallet" style="display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px;" target="_blank">View Wallet Balance</a>
        </td>
      </tr>
    </table>
  `;
  return getEmailWrapperHTML('Deposit Received', `Wallet deposit confirmation of ${formattedAmount}`, contentHtml);
}
