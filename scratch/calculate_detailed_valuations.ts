import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { valuationService } from '../src/services/valuationService';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runValuations(auctionNum: string) {
  console.log(`\n======================================================================`);
  console.log(`RUNNING DETAILED VALUATION FOR: ${auctionNum}`);
  console.log(`======================================================================`);

  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .eq('mstc_auction_number', auctionNum)
    .limit(1);

  if (error) {
    console.error('Database query error:', error.message);
    return;
  }

  if (!records || records.length === 0) {
    console.log('No auction record found in database.');
    return;
  }

  const record = records[0];
  let parsedTextObj: any = {};
  try {
    parsedTextObj = JSON.parse(record.raw_materials_text);
  } catch (e) {
    console.error('Failed to parse raw materials text as JSON.');
    return;
  }

  const rawItems = parsedTextObj.items || [];
  console.log(`Found ${rawItems.length} items to value individually.`);

  // Set cost estimates
  const preBidVal = parseInt((parsedTextObj.depositDetails?.preBidDdg || '').replace(/[^\d]/g, ''), 10) || 50000;
  const costs = {
    currentBid: preBidVal,
    gstTaxesPercent: 18,
    transportation: 5000,
    loadingUnloading: 2000,
    refurbishment: 0,
    otherFees: 1000
  };

  const valuation = await valuationService.calculateValuation(
    rawItems.map((it: any) => ({
      sr: it.sr,
      description: it.description,
      qty: String(it.qty),
      unit: it.unit
    })),
    costs,
    true // hasImages
  );

  console.log('\n--- Individual Item Valuations (via SerpAPI / Categories) ---');
  console.log(
    '| ' +
    'Item Description'.padEnd(35) +
    ' | ' +
    'Qty'.padStart(10) +
    ' | ' +
    'Unit Value'.padStart(14) +
    ' | ' +
    'Total Value'.padStart(14) +
    ' | ' +
    'Confidence'.padStart(10) +
    ' |'
  );
  console.log('|' + '-'.repeat(37) + '|' + '-'.repeat(12) + '|' + '-'.repeat(16) + '|' + '-'.repeat(16) + '|' + '-'.repeat(12) + '|');
  
  for (const item of valuation.items) {
    console.log(
      '| ' +
      item.name.substring(0, 35).padEnd(35) +
      ' | ' +
      String(item.qty).padStart(10) +
      ' | ' +
      `₹${item.unitValue.toLocaleString('en-IN')}`.padStart(14) +
      ' | ' +
      `₹${item.totalValue.toLocaleString('en-IN')}`.padStart(14) +
      ' | ' +
      `${item.confidence}%`.padStart(10) +
      ' | '
    );
  }

  console.log('\n--- Overall Lot Financial Summary ---');
  console.log(`Estimated Total Market Value:   ₹${valuation.totalLotValue.toLocaleString('en-IN')}`);
  console.log(`Total Acquisition Cost:         ₹${valuation.totalCost.toLocaleString('en-IN')}`);
  console.log(`Projected Net Profit:           ₹${valuation.estimatedProfit.toLocaleString('en-IN')}`);
  console.log(`Estimated ROI:                  ${valuation.roiPercent}%`);
  console.log(`Break-Even Bid Value:           ₹${valuation.breakEven.toLocaleString('en-IN')}`);
  console.log(`Recommendation:                 ${valuation.recommendation}`);
  console.log(`Reasoning:                      ${valuation.recommendationReasoning}`);
}

async function start() {
  await runValuations('MSTC/GHY/Supply Depot ASC Dimapur /1/Dimapur/26-27/8714');
  await runValuations('MSTC/CDG/POWER GRID CORPORATION OF INDIA LTD/1/SARNA, DIST. PATHANKOT/26-27/13078');
}

start();
