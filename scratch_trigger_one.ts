import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testSingleRecordProcess() {
  console.log('Finding a downloaded catalog to test parsing on...');
  const { data: record, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, source_pdf_url, asset_status, raw_materials_text')
    .not('source_pdf_url', 'is', null)
    .limit(1)
    .single();

  if (error || !record) {
    console.error('No record found to test:', error);
    return;
  }

  console.log(`Found record: ${record.mstc_auction_number} (status: ${record.asset_status})`);

  // Reset status to pending so worker picks it up
  console.log('Resetting record to pending...');
  const { error: resetErr } = await supabase
    .from('mstc_auctions')
    .update({
      asset_status: 'pending',
      retry_count: 0,
      sanitized_document_path: null,
      raw_materials_text: null
    })
    .eq('id', record.id);

  if (resetErr) {
    console.error('Failed to reset record:', resetErr);
    return;
  }

  console.log('Record successfully reset. Running assetWorker queue...');
  
  // Dynamically import assetWorker's queue function or run assetWorker.ts via runAssetPipelineQueue
  // Since assetWorker.ts runs on a timer, we can import it or just run the file itself
  // To run the file itself, we can execute: npx tsx assetWorker.ts
  // But assetWorker.ts has a setInterval at the end of the file. Let's inspect the end of assetWorker.ts first.
}

testSingleRecordProcess();
