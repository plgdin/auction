import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { generateCampaignEmailHtml } from './emailTemplate.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_ADDRESS = process.env.SMTP_FROM || 'Lelam Team <team@notification.lelam.co>';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const PROGRESS_FILE = path.resolve('campaign_progress.json');
const DEFAULT_CSV_FILE = path.resolve('mail.csv');
const DEFAULT_SUBJECT = 'Track MSTC, GeM & Bank Auctions in One Place | Lelam.co';

interface Recipient {
  company: string;
  email: string;
  category: string;
}

interface ProgressRecord {
  sent: Record<string, { company: string; resendId: string; sentAt: string }>;
  failed: Record<string, { company: string; error: string; failedAt: string }>;
}

function loadProgress(): ProgressRecord {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    } catch {
      // fallback
    }
  }
  return { sent: {}, failed: {} };
}

function saveProgress(progress: ProgressRecord) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
}

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function loadRecipients(csvFilePath: string, allAliases = false): Recipient[] {
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }

  const content = fs.readFileSync(csvFilePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const recipients: Recipient[] = [];
  const seenEmails = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if line contains comma-separated columns or just single email / trailing comma
    const cols = parseCsvLine(line);

    // If header line on line 0 (e.g. "Company,Email,..."), skip
    if (i === 0 && (cols[0]?.toLowerCase().includes('company') || cols[1]?.toLowerCase().includes('email'))) {
      continue;
    }

    if (cols.length >= 3 && cols[1] && cols[2].includes('@')) {
      // Format: ID, Company, Email, Category
      const company = cols[1] || '';
      const rawEmail = cols[2] || '';
      const category = cols[3] || 'Industrial Auction Buyers';
      const emails = rawEmail.split(/[,;\/]/).map(e => e.trim().toLowerCase()).filter(Boolean);

      for (const email of emails) {
        if (emailRegex.test(email) && !seenEmails.has(email)) {
          seenEmails.add(email);
          recipients.push({ company, email, category });
          if (!allAliases) break;
        }
      }
    } else {
      // Plain list of emails (e.g. mail.csv)
      const extracted = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const email of extracted) {
        const lower = email.toLowerCase();
        if (!seenEmails.has(lower)) {
          seenEmails.add(lower);
          recipients.push({ company: '', email: lower, category: 'Auction Buyers' });
        }
      }
    }
  }

  return recipients;
}

async function getUnsubscribedEmails(): Promise<Set<string>> {
  const set = new Set<string>();
  if (supabase) {
    try {
      const { data } = await supabase.from('email_unsubscribes').select('email');
      data?.forEach(r => set.add(r.email.toLowerCase()));
    } catch {
      // ignore
    }
  }
  return set;
}

async function sendSingleEmail(recipient: Recipient, subject: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const html = generateCampaignEmailHtml({
    companyName: recipient.company,
    recipientEmail: recipient.email,
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: recipient.email,
        reply_to: 'business@lelam.co',
        subject: subject,
        html,
      }),
    });

    const data: any = await res.json();
    if (res.ok && data.id) {
      return { success: true, id: data.id };
    }
    return { success: false, error: data.message || JSON.stringify(data) };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find(a => a.includes('@') && !a.startsWith('--'));
  const isTest = args.includes('--test') || Boolean(emailArg);
  const testEmailIndex = args.indexOf('--test');
  const testEmail = (testEmailIndex !== -1 && args[testEmailIndex + 1]) ? args[testEmailIndex + 1] : (emailArg || '');

  const isDryRun = args.includes('--dry-run');
  const isSend = args.includes('--send');
  const isAllAliases = args.includes('--all-aliases');

  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : Infinity;

  const csvIndex = args.indexOf('--csv');
  const csvPath = csvIndex !== -1 && args[csvIndex + 1] ? path.resolve(args[csvIndex + 1]) : DEFAULT_CSV_FILE;

  const subjectIndex = args.indexOf('--subject');
  const subject = subjectIndex !== -1 && args[subjectIndex + 1] ? args[subjectIndex + 1] : DEFAULT_SUBJECT;

  console.log('====================================================');
  console.log('  LELAM B2B EMAIL CAMPAIGN RUNNER');
  console.log('====================================================');
  console.log(`CSV File     : ${csvPath}`);
  console.log(`From Address : ${FROM_ADDRESS}`);
  console.log(`Subject      : ${subject}`);
  console.log(`API Key      : ${RESEND_API_KEY ? `${RESEND_API_KEY.substring(0, 7)}...` : 'MISSING'}`);

  if (!RESEND_API_KEY) {
    console.error('\n[ERROR] RESEND_API_KEY is not set in .env.local');
    process.exit(1);
  }

  // 1. TEST MODE: Send 1 test email
  if (isTest) {
    if (!testEmail || !testEmail.includes('@')) {
      console.error('\n[ERROR] Please specify a valid email: --test your-email@example.com');
      process.exit(1);
    }
    console.log(`\n[TEST MODE] Sending test email to: ${testEmail}`);
    const testRecipient: Recipient = {
      company: '',
      email: testEmail,
      category: 'Auction Buyers',
    };
    const result = await sendSingleEmail(testRecipient, subject);
    if (result.success) {
      console.log(`\n[SUCCESS] Test email sent! Resend ID: ${result.id}`);
      console.log('Please check your inbox (and spam folder) to review formatting.');
    } else {
      console.error(`\n[FAILED] Error sending test email: ${result.error}`);
    }
    return;
  }

  // 2. LOAD RECIPIENTS
  const allRecipients = loadRecipients(csvPath, isAllAliases);
  const unsubscribed = await getUnsubscribedEmails();
  const progress = loadProgress();

  const toSend = allRecipients.filter(r => {
    const email = r.email.toLowerCase();
    if (unsubscribed.has(email)) return false;
    if (progress.sent[email]) return false; // already sent
    return true;
  });

  console.log(`\nTotal Recipients in CSV : ${allRecipients.length}`);
  console.log(`Already Sent            : ${Object.keys(progress.sent).length}`);
  console.log(`Unsubscribed/Suppressed : ${unsubscribed.size}`);
  console.log(`Pending to Send         : ${toSend.length}`);

  if (isDryRun || (!isSend && !isTest)) {
    console.log('\n[DRY RUN MODE] No emails were sent.');
    console.log('First 5 pending recipients:');
    toSend.slice(0, 5).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.company ? `${r.company} ` : ''}<${r.email}>`);
    });
    console.log('\nCommands:');
    console.log('  Send test email   : npx tsx scripts/send_campaign.ts --test your-email@gmail.com');
    console.log('  Send first 100    : npx tsx scripts/send_campaign.ts --send --limit 100');
    console.log('  Send all pending  : npx tsx scripts/send_campaign.ts --send');
    return;
  }

  // 3. SENDING
  const targetBatch = toSend.slice(0, limit);
  console.log(`\n[STARTING] Sending to ${targetBatch.length} recipients...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targetBatch.length; i++) {
    const r = targetBatch[i];
    process.stdout.write(`[${i + 1}/${targetBatch.length}] ${r.company ? `${r.company} ` : ''}(${r.email})... `);

    const result = await sendSingleEmail(r, subject);
    const nowIso = new Date().toISOString();

    if (result.success) {
      console.log(`OK (ID: ${result.id})`);
      progress.sent[r.email.toLowerCase()] = {
        company: r.company,
        resendId: result.id || '',
        sentAt: nowIso,
      };
      delete progress.failed[r.email.toLowerCase()];
      successCount++;

      // Optionally sync to Supabase queue
      if (supabase) {
        try {
          await supabase.from('email_campaign_queue').upsert({
            campaign_name: 'auction_buyers_intro',
            recipient_email: r.email.toLowerCase(),
            company_name: r.company,
            category: r.category,
            subject: subject,
            html_body: 'template_auction_intro',
            status: 'sent',
            resend_id: result.id,
            sent_at: nowIso,
          }, { onConflict: 'campaign_name,recipient_email' });
        } catch {
          // sync error ignored
        }
      }
    } else {
      console.log(`FAILED: ${result.error}`);
      progress.failed[r.email.toLowerCase()] = {
        company: r.company,
        error: result.error || 'Unknown error',
        failedAt: nowIso,
      };
      failCount++;

      if (supabase) {
        try {
          await supabase.from('email_campaign_queue').upsert({
            campaign_name: 'auction_buyers_intro',
            recipient_email: r.email.toLowerCase(),
            company_name: r.company,
            category: r.category,
            subject: subject,
            html_body: 'template_auction_intro',
            status: 'failed',
            last_error: result.error,
          }, { onConflict: 'campaign_name,recipient_email' });
        } catch {
          // sync error ignored
        }
      }
    }

    saveProgress(progress);

    // Rate-limit pause: 600ms pause between sends (Resend free tier limit is 2/sec)
    if (i < targetBatch.length - 1) {
      await sleep(600);
    }
  }

  console.log('\n====================================================');
  console.log(`Finished: ${successCount} sent, ${failCount} failed.`);
  console.log(`Progress saved in: ${PROGRESS_FILE}`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
