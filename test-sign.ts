import { storageService } from './src/services/storageService.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const url = 'https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/mstc-previews/MSTC_VZG_POSTMASTER%20NARASARAOPET/1/NARASARAOPET/25-26/58132.jpg';
  const signed = await storageService.getSignedUrl(url, 'auction_documents');
  console.log("SIGNED:", signed);
  
  const urls = await storageService.getSignedUrls([url]);
  console.log("SIGNED BATCH:", urls);
}

run();
