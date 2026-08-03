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
          from: SMTP_FROM || 'onboarding@resend.dev',
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
      // Fall through to console logging on failure so we can debug
    }
  }

  // Fallback to beautiful console log preview
  console.log('\n' + '='.repeat(80));
  console.log(`[MOCK EMAIL LOG] TO: ${to}`);
  console.log(`[MOCK EMAIL LOG] SUBJECT: ${subject}`);
  console.log(`[MOCK EMAIL LOG] FROM: ${SMTP_FROM}`);
  console.log('-'.repeat(80));
  // Print stripped HTML text for easy terminal preview
  const plainText = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  console.log(plainText);
  console.log('='.repeat(80) + '\n');
  return true;
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
      border: 1px border #e2e8f0;
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
