import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ParsedItem {
  sr: any;
  description: string;
  qty: string;
  unit: string;
  taxRate?: string;
  marketPrice?: string;
}

interface ParsedAuction {
  items: ParsedItem[];
  needsReview?: boolean;
  reviewReason?: string;
}

async function run() {
  console.log("Fetching all auctions from database...");
  
  // Page size for safety
  const limit = 1000;
  let offset = 0;
  let allAuctions: any[] = [];
  
  while (true) {
    const { data, error } = await supabase
      .from('mstc_auctions')
      .select('id, mstc_auction_number, raw_materials_text, category_name, seller_name, location')
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error("Error fetching data:", error);
      return;
    }
    
    if (!data || data.length === 0) break;
    allAuctions = allAuctions.concat(data);
    offset += limit;
  }
  
  console.log(`Total auctions retrieved: ${allAuctions.length}`);
  
  const anomalies: {
    auctionId: string;
    auctionNumber: string;
    reasons: string[];
    details: any[];
  }[] = [];
  
  let totalItemsChecked = 0;

  for (const record of allAuctions) {
    if (!record.raw_materials_text) continue;
    
    let parsed: ParsedAuction;
    try {
      parsed = JSON.parse(record.raw_materials_text);
    } catch (e) {
      anomalies.push({
        auctionId: record.id,
        auctionNumber: record.mstc_auction_number,
        reasons: ["Invalid JSON in raw_materials_text"],
        details: [record.raw_materials_text]
      });
      continue;
    }
    
    if (!parsed || !Array.isArray(parsed.items)) continue;
    
    const recordReasons: string[] = [];
    const recordDetails: any[] = [];
    
    for (const item of parsed.items) {
      totalItemsChecked++;
      const itemReasons: string[] = [];
      
      // 1. Check for serial number anomalies
      const srStr = String(item.sr || '').trim();
      if (srStr === '0' || srStr === '0.0') {
        itemReasons.push(`Zero Serial Number ('${srStr}')`);
      } else if (srStr.startsWith('.') || srStr.includes('/') || /[a-zA-Z]/.test(srStr) && srStr.length > 5) {
        itemReasons.push(`Malformed/Wrapped Serial Number ('${srStr}')`);
      }
      
      // 2. Check for Pincode in Quantity
      const cleanQtyStr = (item.qty || '').replace(/,/g, '').trim();
      if (/^\d{6}$/.test(cleanQtyStr)) {
        itemReasons.push(`Pincode parsed as Quantity ('${cleanQtyStr}')`);
      }
      
      // 3. Check for Fallback Category Description
      const desc = (item.description || '').toLowerCase();
      const cat = (record.category_name || '').toLowerCase();
      if (desc === cat && cleanQtyStr !== '1' && cleanQtyStr !== '1.0') {
        itemReasons.push(`Generic category fallback used as description with non-trivial quantity: '${item.description}' (Qty: ${item.qty})`);
      }
      
      // 4. Check for leakage of address details into description
      const addressKeywords = ['plot no', 'logistics park', 'tehsil', 'pin 4', 'pin 3', 'pin 5', 'scheme no', 'floor, metro', 'district', 'landmark'];
      for (const keyword of addressKeywords) {
        if (desc.includes(keyword)) {
          itemReasons.push(`Description contains address/location keywords: '${keyword}'`);
          break;
        }
      }
      
      if (itemReasons.length > 0) {
        recordReasons.push(...itemReasons);
        recordDetails.push(item);
      }
    }
    
    if (recordReasons.length > 0) {
      anomalies.push({
        auctionId: record.id,
        auctionNumber: record.mstc_auction_number,
        reasons: Array.from(new Set(recordReasons)),
        details: recordDetails
      });
    }
  }
  
  console.log("\n==================================================");
  console.log(`Validation Completed.`);
  console.log(`Total Auctions Checked: ${allAuctions.length}`);
  console.log(`Total Lot Items Checked: ${totalItemsChecked}`);
  console.log(`Total Anomalous Auctions Found: ${anomalies.length}`);
  console.log("==================================================\n");
  
  if (anomalies.length > 0) {
    console.log("Top 15 Anomalies Found:");
    anomalies.slice(0, 15).forEach((anom, idx) => {
      console.log(`\n${idx + 1}. Auction: ${anom.auctionNumber}`);
      console.log(`   ID: ${anom.auctionId}`);
      console.log(`   Reasons:`, anom.reasons);
      console.log(`   Items:`, JSON.stringify(anom.details, null, 2));
    });
    
    // Save report to a text file for the user to review
    const reportPath = 'scratch/anomaly_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(anomalies, null, 2));
    console.log(`\nDetailed report of all ${anomalies.length} anomalies saved to ${reportPath}`);
  }
}

run();
