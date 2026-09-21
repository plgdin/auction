import * as dotenv from 'dotenv';
import { sendWhatsAppText } from '../api/utils/whatsapp.ts';
import { ZOMATO_HOOK_TEMPLATES, generateZomatoCopy } from '../api/utils/zomatoCopyEngine.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const PHONE = process.env.TARGET_PHONE || process.argv[2] || '918590889282';
const DELAY_MS = 3000;

const auctionContext = {
  id: '',
  title: 'High-Grade Copper Cable Scrap (Lot #42)',
  location: 'Mumbai Warehouse',
  category: 'copper scrap & industrial metals',
  closingTime: '6 hours',
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n🚀 Sending ${ZOMATO_HOOK_TEMPLATES.length} templates to +${PHONE}\n`);

  let sent = 0;
  let failed = 0;

  for (const template of ZOMATO_HOOK_TEMPLATES) {
    const copy = generateZomatoCopy(auctionContext, template.id);

    const header = `━━━━━━━━━━━━━━━━━━\n📌 *Template ${sent + 1}/${ZOMATO_HOOK_TEMPLATES.length}*\n🏷️ Style: _${template.style}_\n🆔 ID: \`${template.id}\`\n━━━━━━━━━━━━━━━━━━\n\n`;
    const fullMsg = header + copy.fullMessage;

    console.log(`[${sent + 1}/${ZOMATO_HOOK_TEMPLATES.length}] Sending: ${template.id} (${template.style})...`);

    const result = await sendWhatsAppText(PHONE, fullMsg, true);

    if (result.success) {
      sent++;
      console.log(`  ✅ Sent (${result.isMock ? 'MOCK' : result.messageId})`);
    } else {
      failed++;
      console.log(`  ❌ Failed: ${result.error}`);
    }

    if (sent + failed < ZOMATO_HOOK_TEMPLATES.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✅ Done! Sent: ${sent}, Failed: ${failed}\n`);
}

main().catch(console.error);
