/**
 * Deep dive into the 4 failing records to see their raw PDF text structure.
 * Usage: npx tsx scratch/deep_dive_failures.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FAILING_AUCTIONS = [
  'MSTC/VAD/BSNL, RAJKOT/10/RAJKOT/26-27/13088',
  'MSTC/NRO/DHL EXPRESS (INDIA) PRIVATE LIMITED/3/DELHI/26-27/13097',
  'MSTC/VZG/UPGRADE PRIMARY HEALTH CENTRE KODUMUR M/2/KODUMUR/26-27',
  'MSTC/WRO/BEML LIMITED/1/PUNE/26-27/13045',
];

async function run() {
  for (const auctionNum of FAILING_AUCTIONS) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`AUCTION: ${auctionNum}`);
    console.log('='.repeat(100));

    const { data: records } = await supabase
      .from('mstc_auctions')
      .select('*')
      .ilike('mstc_auction_number', `%${auctionNum.slice(0, 40)}%`)
      .limit(1);

    if (!records || records.length === 0) {
      console.log('[Not found in DB]');
      continue;
    }

    const record = records[0];
    console.log(`Category: ${record.category_name}`);
    console.log(`Seller:   ${record.seller_name}`);
    console.log(`Doc URL:  ${record.sanitized_document_path}`);

    if (!record.sanitized_document_path) {
      console.log('[No document path]');
      continue;
    }

    try {
      const res = await fetch(record.sanitized_document_path);
      if (!res.ok) {
        console.log(`[Download failed: ${res.status}]`);
        continue;
      }
      const buffer = await res.buffer();
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') {
        console.log('[Not a valid PDF]');
        continue;
      }

      const parsedPdf = await pdf(buffer);
      const text: string = parsedPdf.text || '';

      console.log(`PDF text length: ${text.length} chars`);

      // Test the current lot-splitting regex
      const lotBlocks = text.split(/Lot No\s*-\s*/);
      console.log(`Lot blocks from "Lot No -" split: ${lotBlocks.length - 1}`);

      // Test alternative lot patterns
      const altPatterns = [
        { label: 'Lot No.', regex: /Lot\s*No\.\s*/gi },
        { label: 'Lot No :', regex: /Lot\s*No\s*:\s*/gi },
        { label: 'Lot No-', regex: /Lot\s*No\s*-\s*/gi },
        { label: 'Lot No', regex: /Lot\s*No\s+\d/gi },
        { label: 'Lot Number', regex: /Lot\s*Number/gi },
        { label: 'S.No / Sr.No / Sl.No', regex: /(?:S\.?\s*No|Sr\.?\s*No|Sl\.?\s*No)[\s.:]+\d/gi },
        { label: 'Item No', regex: /Item\s*No/gi },
      ];

      for (const { label, regex } of altPatterns) {
        const matches = text.match(regex) || [];
        if (matches.length > 0) {
          console.log(`  Pattern "${label}": ${matches.length} matches → ${matches.slice(0, 5).join(', ')}`);
        }
      }

      // Print full PDF text (first 150 non-empty lines)
      const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      console.log(`\n--- RAW TEXT (first 150 non-empty lines of ${lines.length} total) ---`);
      lines.slice(0, 150).forEach((line: string, idx: number) => {
        console.log(`  ${String(idx + 1).padStart(4, ' ')}: ${line}`);
      });

      // If text is short, print it all
      if (lines.length <= 150) {
        console.log(`  [End of text — ${lines.length} lines total]`);
      } else {
        // Print lines containing any lot/item references
        console.log(`\n--- ALL LINES WITH LOT/ITEM/QTY KEYWORDS (from full ${lines.length} lines) ---`);
        lines.forEach((line: string, idx: number) => {
          if (/lot|item|quantity|product|description|sr\.?\s*no|sl\.?\s*no|material/i.test(line)) {
            console.log(`  ${String(idx + 1).padStart(4, ' ')}: ${line}`);
          }
        });
      }

    } catch (err: any) {
      console.log(`[Error: ${err.message}]`);
    }
  }
}

run().catch(console.error);
