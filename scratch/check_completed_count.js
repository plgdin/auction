import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error("Credentials not found");
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, asset_status, raw_materials_text');

  if (error) {
    console.error("DB error:", error);
    process.exit(1);
  }

  let completedCount = 0;
  let emptyDescCount = 0;
  let totalLotsCount = 0;
  const auctionsWithEmptyLots = [];

  for (const record of records) {
    if (record.asset_status === 'completed') {
      completedCount++;
      if (record.raw_materials_text) {
        try {
          const parsed = JSON.parse(record.raw_materials_text);
          if (parsed && parsed.items && Array.isArray(parsed.items)) {
            let hasEmptyLot = false;
            for (const item of parsed.items) {
              totalLotsCount++;
              if (!item.description || !item.description.trim()) {
                emptyDescCount++;
                hasEmptyLot = true;
              }
            }
            if (hasEmptyLot) {
              auctionsWithEmptyLots.push(record);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  console.log(`Total records: ${records.length}`);
  console.log(`Completed records: ${completedCount}`);
  console.log(`Total parsed lots: ${totalLotsCount}`);
  console.log(`Lots with empty description: ${emptyDescCount}`);
  console.log(`Auctions containing at least one empty lot description: ${auctionsWithEmptyLots.length}`);
  
  if (auctionsWithEmptyLots.length > 0) {
    console.log("\nSample of affected auctions:");
    auctionsWithEmptyLots.slice(0, 10).forEach(auc => {
      console.log(`- ID: ${auc.id} | Number: ${auc.mstc_auction_number}`);
    });
  }
}

check();
