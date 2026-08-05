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

export function getSignupWelcomeTemplate(firstName: string): string {
  const name = firstName || 'there';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Lelam Company</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .content {
      padding: 32px;
    }
    .welcome-text {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 16px;
    }
    .features-list {
      margin: 24px 0;
      padding-left: 0;
      list-style: none;
    }
    .features-list li {
      position: relative;
      padding-left: 28px;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .features-list li::before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #0284c7;
      font-weight: bold;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 16px 0;
    }
    .btn {
      display: inline-block;
      background-color: #0ea5e9;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      font-weight: 600;
      font-size: 14px;
      border-radius: 9999px;
      transition: background-color 0.2s;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Lelam Company</h1>
    </div>
    <div class="content">
      <div class="welcome-text">Welcome to the future of bidding, ${name}!</div>
      <p>Your account has been successfully registered. You are now ready to explore and bid on official government catalogs, bank properties, and commercial asset liquidations.</p>
      
      <p>Here is what you can do with your new account:</p>
      <ul class="features-list">
        <li>Browse and search active auctions with state-of-the-art fuzzy logic filters</li>
        <li>Instantly view and download official MSTC PDF catalogs</li>
        <li>Save listings to your Watchlist for real-time closing alerts</li>
        <li>Access live scrap commodity indices and valuations</li>
      </ul>

      <div class="btn-container">
        <a href="https://lelam.co/auctions" class="btn" target="_blank">Start Browsing Auctions</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Lelam Company. All rights reserved.</p>
      <p>You received this email because you registered on our platform. If this wasn't you, please contact support.</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getPaymentConfirmationTemplate(
  firstName: string,
  planName: string,
  amountInRs: number,
  transactionId: string,
  billingCycle: string
): string {
  const name = firstName || 'Valued Customer';
  const priceStr = `₹${amountInRs.toLocaleString('en-IN')}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - Lelam Company</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
    }
    .header {
      background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
    }
    .content {
      padding: 32px;
    }
    .receipt-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 24px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 12px;
    }
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .invoice-table th {
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      color: #64748b;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .invoice-table td {
      padding: 12px 0;
      font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .invoice-table .total-row td {
      font-weight: 700;
      font-size: 16px;
      color: #0f172a;
      border-top: 2px solid #e2e8f0;
      border-bottom: none;
      padding-top: 16px;
    }
    .details-box {
      background-color: #f8fafc;
      border-radius: 12px;
      padding: 16px;
      margin: 24px 0;
      border: 1px solid #e2e8f0;
    }
    .details-box table {
      width: 100%;
    }
    .details-box td {
      font-size: 13px;
      padding: 4px 0;
    }
    .details-box .label {
      color: #64748b;
      width: 40%;
    }
    .details-box .value {
      font-weight: 600;
      color: #334155;
      text-align: right;
    }
    .btn-container {
      text-align: center;
      margin: 24px 0 8px 0;
    }
    .btn {
      display: inline-block;
      background-color: #0284c7;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      font-weight: 600;
      font-size: 14px;
      border-radius: 9999px;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Payment Successful</h1>
    </div>
    <div class="content">
      <div class="receipt-title">Subscription Receipt</div>
      <p>Dear ${name},</p>
      <p>Thank you for your payment. Your subscription is active, and your account privileges have been updated immediately.</p>
      
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: right;">Billing Cycle</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lelam ${planName} Subscription Plan</td>
            <td style="text-align: right; text-transform: capitalize;">${billingCycle}</td>
            <td style="text-align: right;">${priceStr}</td>
          </tr>
          <tr class="total-row">
            <td>Total Paid</td>
            <td></td>
            <td style="text-align: right;">${priceStr}</td>
          </tr>
        </tbody>
      </table>

      <div class="details-box">
        <table>
          <tr>
            <td class="label">Transaction Reference:</td>
            <td class="value">${transactionId}</td>
          </tr>
          <tr>
            <td class="label">Payment Provider:</td>
            <td class="value">Razorpay</td>
          </tr>
          <tr>
            <td class="label">Receipt Date:</td>
            <td class="value">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>

      <div class="btn-container">
        <a href="https://lelam.co/dashboard" class="btn" target="_blank">Go to Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Lelam Company. All rights reserved.</p>
      <p>If you have any questions regarding this payment, please reach out to support@lelam.co.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// ─── TRANSACTIONAL EMAIL TEMPLATES ──────────────────────────────────────────

export function getBidConfirmationTemplate(
  firstName: string,
  auctionTitle: string,
  bidAmount: number,
  auctionUrl: string
): string {
  const name = firstName || 'Bidder';
  const formattedAmount = `₹${bidAmount.toLocaleString('en-IN')}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bid Confirmation - Lelam Company</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
    }
    .header {
      background: linear-gradient(135deg, #065f46 0%, #10b981 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
    }
    .content {
      padding: 32px;
    }
    .bid-card {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    .bid-amount {
      font-size: 28px;
      font-weight: 800;
      color: #065f46;
      margin: 8px 0;
    }
    .btn-container {
      text-align: center;
      margin: 24px 0 8px 0;
    }
    .btn {
      display: inline-block;
      background-color: #10b981;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      font-weight: 600;
      font-size: 14px;
      border-radius: 9999px;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Bid Confirmed ✓</h1>
    </div>
    <div class="content">
      <p>Dear ${name},</p>
      <p>Your bid has been successfully recorded in our ledger.</p>

      <div class="bid-card">
        <div style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Auction</div>
        <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 4px 0 12px 0;">${auctionTitle}</div>
        <div style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Your Bid</div>
        <div class="bid-amount">${formattedAmount}</div>
      </div>

      <p>You will be notified immediately if you are outbid.</p>

      <div class="btn-container">
        <a href="${auctionUrl}" class="btn" target="_blank">View Live Auction</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Lelam Company. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getOutbidAlertTemplate(
  firstName: string,
  auctionTitle: string,
  auctionUrl: string
): string {
  const name = firstName || 'Bidder';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Outbid Alert - Lelam Company</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
    }
    .header {
      background: linear-gradient(135deg, #92400e 0%, #f59e0b 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
    }
    .content {
      padding: 32px;
    }
    .alert-card {
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .alert-card p {
      margin: 0;
      font-weight: 600;
      color: #92400e;
    }
    .btn-container {
      text-align: center;
      margin: 24px 0 8px 0;
    }
    .btn {
      display: inline-block;
      background-color: #f59e0b;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      font-weight: 600;
      font-size: 14px;
      border-radius: 9999px;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>⚠️ You Have Been Outbid</h1>
    </div>
    <div class="content">
      <p>Dear ${name},</p>
      <p>Another participant has placed a higher bid on an auction you are competing in.</p>

      <div class="alert-card">
        <p>${auctionTitle}</p>
      </div>

      <p>The auction is still active. Click below to return to the bidding room and place a counter-bid before time runs out.</p>

      <div class="btn-container">
        <a href="${auctionUrl}" class="btn" target="_blank">Place New Bid</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Lelam Company. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getEmdReceiptTemplate(
  firstName: string,
  amount: number,
  referenceId: string
): string {
  const name = firstName || 'Valued Customer';
  const formattedAmount = `₹${amount.toLocaleString('en-IN')}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Deposit Receipt - Lelam Company</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
    }
    .header {
      background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
    }
    .content {
      padding: 32px;
    }
    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .receipt-table td {
      padding: 12px 0;
      font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .receipt-table .label {
      color: #64748b;
      width: 45%;
    }
    .receipt-table .value {
      font-weight: 600;
      color: #334155;
      text-align: right;
    }
    .receipt-table .total .label,
    .receipt-table .total .value {
      font-weight: 700;
      font-size: 16px;
      color: #10b981;
      border-top: 2px solid #e2e8f0;
      border-bottom: none;
      padding-top: 16px;
    }
    .btn-container {
      text-align: center;
      margin: 24px 0 8px 0;
    }
    .btn {
      display: inline-block;
      background-color: #0284c7;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      font-weight: 600;
      font-size: 14px;
      border-radius: 9999px;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Deposit Received</h1>
    </div>
    <div class="content">
      <p>Dear ${name},</p>
      <p>We have successfully processed your wallet deposit.</p>

      <table class="receipt-table">
        <tr>
          <td class="label">Transaction Reference</td>
          <td class="value" style="font-family: monospace;">${referenceId}</td>
        </tr>
        <tr>
          <td class="label">Date</td>
          <td class="value">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
        </tr>
        <tr class="total">
          <td class="label">Amount Deposited</td>
          <td class="value">${formattedAmount}</td>
        </tr>
      </table>

      <p>These funds are now available in your ledger to participate in active auctions.</p>

      <div class="btn-container">
        <a href="https://lelam.co/wallet" class="btn" target="_blank">View Wallet Balance</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Lelam Company. All rights reserved.</p>
      <p>If you have any questions, please reach out to support@lelam.co.</p>
    </div>
  </div>
</body>
</html>
  `;
}
