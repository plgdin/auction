import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { valuationService } from '../src/services/valuationService.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .ilike('mstc_auction_number', '%14317%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No record found');
    return;
  }

  const record = data[0];
  const parsed = JSON.parse(record.raw_materials_text || '{}');
  const items = parsed.items || [];

  console.log('Auction Number:', record.mstc_auction_number);

  const rawItems = items.map((it: any) => ({
    sr: it.sr,
    description: it.description || '',
    qty: String(it.qty || '1'),
    unit: it.unit || 'Nos',
    marketPrice: it.marketPrice || '',
  }));

  const customCosts = {
    currentBid: parsed.totalMarketValue || 50000,
    transportation: 5000,
    loadingUnloading: 2000,
    refurbishment: 0,
    otherFees: 1000,
  };

  const valuation = await valuationService.calculateValuation(rawItems, customCosts, false);
  console.log('Valuation Items Output:');
  valuation.items.forEach((item, idx) => {
    console.log(`${idx + 1}. Description: "${item.name}"`);
    console.log(`   Qty: ${item.qty}`);
    console.log(`   Unit Value: ₹${item.unitValue}`);
    console.log(`   Total Value: ₹${item.totalValue}`);
  });
}

run().catch(console.error);
