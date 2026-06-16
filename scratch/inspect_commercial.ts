import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data: allItems, error } = await supabase
    .from('auctions')
    .select('*, auction_categories(name)');

  if (error) {
    console.error('Error fetching auctions:', error);
    return;
  }

  console.log(`Total auctions rows: ${allItems.length}`);

  // Count distinct categories
  const categories = new Set(allItems.map(i => i.auction_categories?.name || i.category_id));
  console.log('\nDistinct Category Names:');
  categories.forEach(c => console.log(` - ${c}`));

  // Count distinct locations
  const locations = new Set(allItems.map(i => i.location));
  console.log('\nDistinct Locations:');
  locations.forEach(l => console.log(` - ${l}`));

  // Find any item in Kerala
  const keralaItems = allItems.filter(i => (i.location || '').toLowerCase().includes('kerala') || (i.location || '').toLowerCase().includes('kerela'));
  console.log(`\nItems in Kerala: ${keralaItems.length}`);
  keralaItems.forEach(i => {
    console.log(`  ID: ${i.id} | Title: ${i.title} | Category: ${i.auction_categories?.name} | Location: ${i.location} | StartPrice: ${i.starting_price} | EMD: ${i.emd_amount}`);
  });

  // Find any item with "residential" in category or title
  const residentialItems = allItems.filter(i => 
    (i.auction_categories?.name || '').toLowerCase().includes('residential') || 
    (i.title || '').toLowerCase().includes('residential')
  );
  console.log(`\nResidential Items: ${residentialItems.length}`);
  residentialItems.forEach(i => {
    console.log(`  ID: ${i.id} | Title: ${i.title} | Category: ${i.auction_categories?.name} | Location: ${i.location} | StartPrice: ${i.starting_price} | EMD: ${i.emd_amount}`);
  });
}

inspect().catch(console.error);
