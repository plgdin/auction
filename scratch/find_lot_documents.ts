import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findLotDocuments() {
  console.log('Searching database for references to Photo documents or Lot Documents...');
  
  // Fetch a batch of auctions to search within raw_materials_text
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, raw_materials_text, sanitized_document_path')
    .order('id', { ascending: false })
    .limit(100);

  if (error || !records) {
    console.error('Error fetching records:', error?.message);
    return;
  }

  let matches = 0;
  for (const record of records) {
    const text = record.raw_materials_text || '';
    if (text.toLowerCase().includes('.pdf') && (text.toLowerCase().includes('photo') || text.toLowerCase().includes('img') || text.toLowerCase().includes('lot'))) {
      matches++;
      console.log(`\n[Match ${matches}] Auction: ${record.mstc_auction_number}`);
      console.log(`Sanitized Doc Path: ${record.sanitized_document_path}`);
      
      // Let's print out the matching snippet from raw_materials_text
      try {
        const parsed = JSON.parse(text);
        console.log('Parsed Items/Lots Snippet:');
        if (parsed.items) {
          const matchingItems = parsed.items.filter((item: any) => 
            JSON.stringify(item).toLowerCase().includes('.pdf')
          );
          console.log(JSON.stringify(matchingItems, null, 2));
        } else {
          console.log(text.substring(0, 500));
        }
      } catch (e) {
        console.log(text.substring(0, 500));
      }
    }
  }

  console.log(`\nFound ${matches} auctions referencing external lot documents.`);
}

findLotDocuments().catch(err => console.error(err));
