/**
 * Script to register and inspect WhatsApp Message Templates directly on Meta Graph API
 *
 * Usage:
 *   npx tsx scripts/register-meta-templates.ts --list
 *   npx tsx scripts/register-meta-templates.ts --register-all
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
const TOKEN = process.env.WHATSAPP_TOKEN || '';
const GRAPH_API = 'https://graph.facebook.com/v21.0';

export const TEMPLATES_TO_REGISTER = [
  {
    name: 'lelam_auction_alert',
    category: 'MARKETING',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Lelam Auction Update',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe have an exclusive auction opportunity on Lelam.co that matches your profile:\n\n{{2}}\n\nBidding registration is open. You can inspect the lot, terms, and schedule using the official link below:\n\n👉 Inspect Lot: {{3}}\n\nReply directly to this chat if you need assistance from our auction desk.',
        example: {
          body_text: [
            ['Ankit', 'MSTC Heavy Industrial Copper Scrap Lot is currently open for inspection with reserve price of ₹3,50,000.', 'https://lelam.co/auctions'],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: "Lelam.co • India's Auction Platform",
      },
    ],
  },
  {
    name: 'lelam_b2b_outreach',
    category: 'MARKETING',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Lelam Industrial Bidding',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe noticed your interest in commercial assets and equipment auctions on Lelam.co.\n\n{{2}}\n\nTo inspect verified government and PSU surplus auction catalogues, visit the link below:\n\n👉 Browse Auctions: {{3}}\n\nReply directly to this chat if you have any questions or wish to connect with our team.',
        example: {
          body_text: [
            ['Ankit', 'Multiple government surplus fleet disposals and machinery lots are open for bidding across India.', 'https://lelam.co/auctions'],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Lelam.co • B2B Auction Intelligence',
      },
    ],
  },
  {
    name: 'lelam_vehicle_auctions',
    category: 'MARKETING',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Government Vehicle Auction',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nNew government fleet and seized vehicle auctions have been catalogued on Lelam.co.\n\n{{2}}\n\nBidding schedules, vehicle condition reports, and regional inspection locations are now available online:\n\n👉 View Vehicle Lots: {{3}}\n\nReply directly to this chat if you need assistance from our team.',
        example: {
          body_text: [
            ['Ankit', 'Over 45 commercial trucks and passenger vehicles from state transport departments are listed with starting bids from ₹85,000.', 'https://lelam.co/auctions'],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Lelam.co • Vehicle Auctions',
      },
    ],
  },
  {
    name: 'lelam_scrap_machinery',
    category: 'MARKETING',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Industrial Scrap & Machinery',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nNew industrial surplus, copper scrap, and plant machinery lots are live on Lelam.co.\n\n{{2}}\n\nInspection dates, reserve prices, and earnest money deposit terms are detailed on our platform:\n\n👉 Inspect Scrap Lots: {{3}}\n\nReply to this message for bidder registration support.',
        example: {
          body_text: [
            ['Ankit', 'Heavy copper transformers and structural steel scrap lots from MSTC regional offices with reserve price ₹4,20,000.', 'https://lelam.co/auctions'],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Lelam.co • Industrial Procurement',
      },
    ],
  },
  {
    name: 'lelam_bank_properties',
    category: 'MARKETING',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Bank Property & Land Auctions',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nNew bank-seized commercial real estate and residential properties under SARFAESI are listed on Lelam.co.\n\n{{2}}\n\nBank possession notices, valuation details, and auction schedules can be viewed at the link below:\n\n👉 View Properties: {{3}}\n\nReply to this chat to connect with our real estate desk.',
        example: {
          body_text: [
            ['Ankit', 'Industrial manufacturing unit in Navi Mumbai with reserve price ₹1.85 Cr under SARFAESI auction.', 'https://lelam.co/auctions'],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Lelam.co • Bank Asset Auctions',
      },
    ],
  },
  {
    name: 'lelam_kyc_verification',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Account Verification Notice',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nYour bidder account on Lelam.co is pending document verification to unlock active bidding access.\n\n{{2}}\n\nPlease complete your GST and KYC verification through your secure dashboard:\n\n👉 Complete Verification: {{3}}\n\nThank you for choosing Lelam.co.',
        example: {
          body_text: [
            ['Ankit', 'Upload your PAN and GST certificate to activate live bidding on state auctions.', 'https://lelam.co/dashboard/documents'],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Lelam.co • Bidder Support',
      },
    ],
  },
];

async function listTemplates() {
  const res = await fetch(`${GRAPH_API}/${WABA_ID}/message_templates`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  if (data.error) {
    console.error('Error listing templates:', data.error);
    return;
  }
  console.log('\n📋 Current Meta Message Templates:');
  data.data.forEach((t: any) => {
    console.log(` • ${t.name.padEnd(25)} Status: ${t.status.padEnd(12)} Category: ${t.category}`);
  });
  console.log('');
}

async function registerTemplates() {
  for (const tpl of TEMPLATES_TO_REGISTER) {
    console.log(`Submitting template '${tpl.name}' to Meta...`);
    const res = await fetch(`${GRAPH_API}/${WABA_ID}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tpl),
    });
    const data = await res.json();
    if (data.error) {
      if (data.error.error_subcode === 2388043) {
        console.log(` ⚠️ '${tpl.name}' is already submitted on Meta.`);
      } else {
        console.error(` ❌ Error:`, data.error.message);
      }
    } else {
      console.log(` ✅ '${tpl.name}' registered successfully! ID: ${data.id}, Status: ${data.status}`);
    }
  }
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--list') {
    await listTemplates();
  } else {
    await registerTemplates();
    await listTemplates();
  }
}

main();
