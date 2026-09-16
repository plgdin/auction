import * as dotenv from 'dotenv';
import {
  normalizePhoneNumber,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  sendWhatsAppInteractiveButtons,
} from '../api/utils/whatsapp.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const args = process.argv.slice(2);
  const command = args[0] || '--help';
  const targetPhone = args[1] || '919876543210';

  console.log('\n======================================================');
  console.log('  🏛️  Lelam WhatsApp Cloud API Automation Tester');
  console.log('======================================================\n');

  const tokenPresent = !!process.env.WHATSAPP_TOKEN;
  const phoneIdPresent = !!process.env.WHATSAPP_PHONE_NUMBER_ID;

  console.log(`• WHATSAPP_TOKEN:            ${tokenPresent ? '✅ Configured' : '⚠️ Missing (Using Mock Fallback)'}`);
  console.log(`• WHATSAPP_PHONE_NUMBER_ID: ${phoneIdPresent ? `✅ ${process.env.WHATSAPP_PHONE_NUMBER_ID}` : '⚠️ Missing (Using Mock Fallback)'}`);
  console.log(`• WHATSAPP_VERIFY_TOKEN:    ${process.env.WHATSAPP_VERIFY_TOKEN || 'lelam_whatsapp_verify_secret'}`);
  console.log(`• Target Phone:             +${normalizePhoneNumber(targetPhone)}\n`);

  if (command === '--help') {
    console.log('Usage:');
    console.log('  npx tsx scripts/test-whatsapp.ts --zomato <phone> [style_id]');
    console.log('  npx tsx scripts/test-whatsapp.ts --text <phone> [message]');
    console.log('  npx tsx scripts/test-whatsapp.ts --template <phone> [template_name]');
    console.log('  npx tsx scripts/test-whatsapp.ts --buttons <phone>');
    console.log('  npx tsx scripts/test-whatsapp.ts --simulate-inbound <query>');
    console.log('  npx tsx scripts/test-whatsapp.ts --test-all\n');
    return;
  }

  if (command === '--zomato') {
    const { generateZomatoCopy, ZOMATO_HOOK_TEMPLATES } = await import('../api/utils/zomatoCopyEngine.js');
    const styleId = args[2];
    console.log('🍔 Available Zomato/Swiggy Hooks:');
    ZOMATO_HOOK_TEMPLATES.forEach(t => console.log(`  • ${t.id.padEnd(20)} -> ${t.style}`));
    console.log('');

    const copy = generateZomatoCopy(
      {
        id: 'mstc-copper-lot-8819',
        title: 'MSTC Heavy Grade Copper & Armoured Cable Scrap',
        price: 280000,
        location: 'Navi Mumbai, MH',
      },
      styleId
    );

    console.log(`\x1b[33m[Generated Copy: ${copy.style}]\x1b[0m\n`);
    console.log(copy.fullMessage);
    console.log('\n--- Dispatching to target phone ---');
    const res = await sendWhatsAppText(targetPhone, copy.fullMessage, true);
    console.log('Result:', res);
    console.log('======================================================\n');
    return;
  }

  if (command === '--text' || command === '--test-all') {
    console.log('--- 1. Testing Text Message Dispatch ---');
    const msg = args[2] || 'Hello from Lelam Auction Platform! WhatsApp automation is connected and live.';
    const res = await sendWhatsAppText(targetPhone, msg, true);
    console.log('Result:', res);
    console.log('');
  }

  if (command === '--buttons' || command === '--test-all') {
    console.log('--- 2. Testing Interactive Button Dispatch ---');
    const res = await sendWhatsAppInteractiveButtons(
      targetPhone,
      'Welcome to Lelam! Please choose an option to continue:',
      [
        { id: 'btn_search', title: '🔍 Search Lots' },
        { id: 'btn_bids', title: '📋 My Bids' },
        { id: 'btn_support', title: '💬 Support' },
      ],
      'Lelam Assistant',
      'Select an option below'
    );
    console.log('Result:', res);
    console.log('');
  }

  if (command === '--template' || command === '--test-all') {
    console.log('--- 3. Testing Pre-approved Template Dispatch ---');
    const templateName = args[2] || 'bid_confirmation';
    const res = await sendWhatsAppTemplate(
      targetPhone,
      templateName,
      'en',
      [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rajesh' },
            { type: 'text', text: '₹2,50,000' },
            { type: 'text', text: 'MSTC Copper Scrap Lot #4819' },
            { type: 'text', text: 'https://lelam.co/auctions/demo' },
          ],
        },
      ]
    );
    console.log('Result:', res);
    console.log('');
  }

  if (command === '--simulate-inbound') {
    const query = args.slice(1).join(' ') || 'search copper';
    console.log(`--- Testing Inbound Query Simulation: "${query}" ---`);

    // Import webhook handler directly to test intent routing
    const webhook = (await import('../api/whatsapp-webhook.js')).default;
    const mockReq = {
      method: 'POST',
      body: {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'mock_waba',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  contacts: [{ profile: { name: 'Test User' }, wa_id: normalizePhoneNumber(targetPhone) }],
                  messages: [
                    {
                      from: normalizePhoneNumber(targetPhone),
                      id: `wamid_sim_${Date.now()}`,
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: 'text',
                      text: { body: query },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      },
    };

    const mockRes = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { console.log('Webhook Response:', data); return this; },
      writeHead() {},
      end() {},
    };

    await webhook(mockReq, mockRes);
    console.log('\nSimulation completed successfully.');
  }

  console.log('======================================================\n');
}

run().catch(console.error);
