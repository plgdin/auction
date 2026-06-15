import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MOCK_IMAGES = [
  'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=400'
];

async function run() {
  const auctionNum = "MSTC/WRO/BEML LIMITED/1/PUNE/26-27/13045";
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .eq('mstc_auction_number', auctionNum)
    .limit(1);

  if (error || !records || records.length === 0) {
    console.error("Record not found", error);
    return;
  }

  const record = records[0];
  const summaryObj = JSON.parse(record.raw_materials_text);

  if (summaryObj.items && Array.isArray(summaryObj.items)) {
    summaryObj.items.forEach((item: any, idx: number) => {
      // Assign two mock images to each item
      item.images = [
        MOCK_IMAGES[idx % MOCK_IMAGES.length],
        MOCK_IMAGES[(idx + 1) % MOCK_IMAGES.length]
      ];
    });
  }

  // Also put mock images in extracted_images
  summaryObj.extracted_images = MOCK_IMAGES;

  const { error: updateError } = await supabase
    .from('mstc_auctions')
    .update({
      raw_materials_text: JSON.stringify(summaryObj)
    })
    .eq('id', record.id);

  if (updateError) {
    console.error("DB update failed:", updateError.message);
  } else {
    console.log("Mock images injected successfully into database!");
  }
}

run().catch(console.error);
