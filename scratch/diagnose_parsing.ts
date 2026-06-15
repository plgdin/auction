/**
 * Diagnostic script: scan completed records and identify parsing failures.
 * 
 * Usage: npx tsx scratch/diagnose_parsing.ts
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

interface DiagnosticResult {
  id: string;
  auctionNumber: string;
  seller: string;
  category: string;
  issues: string[];
  itemCount: number;
  hasOnlyFallbackItems: boolean;
  rawTextSample?: string;
  lotSplitCount: number;
  pdfTextLength: number;
}

async function run() {
  // 1. Pull completed records and inspect parsed results from DB
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, seller_name, category_name, location, raw_materials_text, sanitized_document_path, asset_status')
    .eq('asset_status', 'completed')
    .not('raw_materials_text', 'is', null)
    .limit(50);

  if (error || !records) {
    console.error('Query failed:', error?.message);
    return;
  }

  console.log(`\nAnalyzing ${records.length} completed records...\n`);

  const diagnostics: DiagnosticResult[] = [];
  let poorParseCount = 0;

  for (const record of records) {
    const issues: string[] = [];
    let parsedSummary: any = null;

    try {
      parsedSummary = JSON.parse(record.raw_materials_text);
    } catch {
      issues.push('raw_materials_text is not valid JSON');
    }

    if (parsedSummary) {
      // Check items
      const items = parsedSummary.items || [];
      const hasOnlyFallback = items.length === 1 && 
        (items[0].description === 'Auction Lot Items' || items[0].description === record.category_name);
      
      if (hasOnlyFallback) {
        issues.push('FALLBACK: Only 1 generic item — lot parsing failed entirely');
      }

      if (items.length === 0) {
        issues.push('NO ITEMS: items array is empty');
      }

      // Check for items with missing descriptions
      const blankDescs = items.filter((it: any) => !it.description || it.description === 'Auction Lot Items');
      if (blankDescs.length > 0 && !hasOnlyFallback) {
        issues.push(`${blankDescs.length}/${items.length} items have blank/generic descriptions`);
      }

      // Check for items with missing quantities
      const defaultQty = items.filter((it: any) => it.qty === '1' && it.unit === 'Lot');
      if (defaultQty.length === items.length && items.length > 1) {
        issues.push('ALL items have default qty=1 unit=Lot — quantity parsing may have failed');
      }

      // Check contacts
      const contacts = parsedSummary.keyContacts || [];
      if (contacts.length <= 1) {
        issues.push('Only MSTC default contact found — site contact extraction failed');
      }

      // Check overview quality
      if (parsedSummary.overview?.includes('auction lot items')) {
        issues.push('Overview uses generic fallback description');
      }

      // Check EMD
      if (parsedSummary.depositDetails?.emd === '10% of total bid value' && 
          parsedSummary.depositDetails?.preBidDdg === 'Not required for registered MSME bidders') {
        issues.push('EMD/Pre-Bid values are all defaults — extraction may have missed values');
      }

      if (issues.length > 0) {
        poorParseCount++;
        diagnostics.push({
          id: record.id,
          auctionNumber: record.mstc_auction_number,
          seller: record.seller_name || '',
          category: record.category_name || '',
          issues,
          itemCount: items.length,
          hasOnlyFallbackItems: items.length === 1 && blankDescs.length === 1,
          lotSplitCount: 0,
          pdfTextLength: 0,
        });
      }
    } else {
      poorParseCount++;
      diagnostics.push({
        id: record.id,
        auctionNumber: record.mstc_auction_number,
        seller: record.seller_name || '',
        category: record.category_name || '',
        issues,
        itemCount: 0,
        hasOnlyFallbackItems: true,
        lotSplitCount: 0,
        pdfTextLength: 0,
      });
    }
  }

  console.log(`=== PARSING QUALITY REPORT ===`);
  console.log(`Total completed records scanned: ${records.length}`);
  console.log(`Records with parsing issues:     ${poorParseCount} (${Math.round(poorParseCount / records.length * 100)}%)`);
  console.log(`Records parsing OK:              ${records.length - poorParseCount}`);
  console.log('');

  if (diagnostics.length === 0) {
    console.log('All records parsed cleanly!');
    return;
  }

  // Group issues by type
  const issueFrequency: Record<string, number> = {};
  for (const d of diagnostics) {
    for (const issue of d.issues) {
      const key = issue.split(':')[0].replace(/\d+/g, 'N');
      issueFrequency[key] = (issueFrequency[key] || 0) + 1;
    }
  }

  console.log('=== ISSUE FREQUENCY ===');
  const sorted = Object.entries(issueFrequency).sort((a, b) => b[1] - a[1]);
  for (const [issue, count] of sorted) {
    console.log(`  [${count}x] ${issue}`);
  }
  console.log('');

  // Now download and re-parse a few of the worst offenders to see raw PDF text
  const fallbackRecords = diagnostics.filter(d => d.hasOnlyFallbackItems).slice(0, 3);
  
  if (fallbackRecords.length > 0) {
    console.log(`\n=== DEEP DIVE: ${fallbackRecords.length} WORST PARSING FAILURES ===\n`);
    
    for (const diag of fallbackRecords) {
      const record = records.find(r => r.id === diag.id);
      if (!record?.sanitized_document_path) continue;

      console.log(`--- ${diag.auctionNumber} ---`);
      console.log(`    Seller:   ${diag.seller}`);
      console.log(`    Category: ${diag.category}`);
      console.log(`    Issues:   ${diag.issues.join('; ')}`);

      try {
        const res = await fetch(record.sanitized_document_path);
        if (!res.ok) {
          console.log(`    [Could not download PDF: ${res.status}]`);
          continue;
        }
        const buffer = await res.buffer();
        if (buffer.toString('utf-8', 0, 4) !== '%PDF') {
          console.log(`    [Downloaded file is not a valid PDF]`);
          continue;
        }

        const parsedPdf = await pdf(buffer);
        const text: string = parsedPdf.text || '';
        diag.pdfTextLength = text.length;

        console.log(`    PDF text length: ${text.length} chars`);

        // Check what lot-related patterns exist in the text
        const lotNoMatches = text.match(/Lot\s*No\s*[-:]/gi) || [];
        const lotNameMatches = text.match(/Lot\s*Name\s*[-:]/gi) || [];
        const qtyMatches = text.match(/Quantity\s*[-:]/gi) || [];
        
        console.log(`    Lot No patterns found:   ${lotNoMatches.length}`);
        console.log(`    Lot Name patterns found: ${lotNameMatches.length}`);
        console.log(`    Quantity patterns found: ${qtyMatches.length}`);

        // Show the first 80 lines for context
        const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        console.log(`\n    === RAW PDF TEXT (first 80 non-empty lines) ===`);
        lines.slice(0, 80).forEach((line: string, idx: number) => {
          console.log(`    ${String(idx + 1).padStart(4, ' ')}: ${line}`);
        });

        // Show lines containing lot-related keywords
        console.log(`\n    === LOT-RELATED LINES ===`);
        lines.forEach((line: string, idx: number) => {
          if (/lot\s*no|lot\s*name|quantity|product\s*type|gst|tcs|bid\s*valid/i.test(line)) {
            console.log(`    ${String(idx + 1).padStart(4, ' ')}: ${line}`);
          }
        });

        console.log('');
      } catch (err: any) {
        console.log(`    [Error during deep dive: ${err.message}]`);
      }
    }
  }

  // Print summary table of all problematic records
  console.log('\n=== ALL PROBLEMATIC RECORDS ===');
  console.log(`${'Auction Number'.padEnd(70)} ${'Items'.padStart(5)} Issues`);
  console.log('-'.repeat(120));
  for (const d of diagnostics) {
    const shortNum = d.auctionNumber.length > 68 ? d.auctionNumber.slice(0, 65) + '...' : d.auctionNumber;
    console.log(`${shortNum.padEnd(70)} ${String(d.itemCount).padStart(5)} ${d.issues.join('; ')}`);
  }
}

run().catch(console.error);
