import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectRecord() {
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .ilike('mstc_auction_number', '%/10465');

  if (error) {
    console.error('Error fetching record:', error.message);
    return;
  }

  if (!records || records.length === 0) {
    console.log('Record 10465 not found.');
    return;
  }

  const rec = records[0];
  console.log(`Auction Number: ${rec.mstc_auction_number}`);
  console.log(`Asset Status: ${rec.asset_status}`);
  console.log(`Sanitized Doc Path: ${rec.sanitized_document_path}`);
  
  try {
    const parsed = JSON.parse(rec.raw_materials_text || '{}');
    console.log(`Preview Image URL: ${parsed.preview_image_url}`);
    console.log(`Extracted Images count: ${parsed.extracted_images?.length}`);
  } catch (e) {
    console.log(`Raw Materials Text (Raw): ${rec.raw_materials_text}`);
  }
}

inspectRecord().catch(console.error);
