import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve('.env') });

async function run() {
  const { MstcSearchService } = await import('../src/services/publicService');

  // Check 1: timber in Kerala
  console.log('\n==========================================');
  console.log('Test 1: searchClientSide("timber in Kerala")');
  const results1 = await MstcSearchService.searchClientSide('timber in Kerala');
  console.log(`Results: ${results1.length}`);
  results1.forEach(i => {
    console.log(`  - Number: ${i.mstc_auction_number} | Category: ${i.category_name} | Location: ${i.location}`);
  });

  // Check 2: computers in Uttar Pradesh
  console.log('\n==========================================');
  console.log('Test 2: searchClientSide("computers in Uttar Pradesh")');
  const results2 = await MstcSearchService.searchClientSide('computers in Uttar Pradesh');
  console.log(`Results: ${results2.length}`);

  // Check 3: cables in Uttar Pradesh
  console.log('\n==========================================');
  console.log('Test 3: searchClientSide("cables in Uttar Pradesh")');
  const results3 = await MstcSearchService.searchClientSide('cables in Uttar Pradesh');
  console.log(`Results: ${results3.length}`);
  results3.forEach(i => {
    console.log(`  - Number: ${i.mstc_auction_number} | Category: ${i.category_name} | Location: ${i.location}`);
  });

  // Check 4: Residential in Rajasthan under 1 lakh
  console.log('\n==========================================');
  console.log('Test 4: searchClientSide("Residential in Rajasthan under 1 lakh")');
  const results4 = await MstcSearchService.searchClientSide('Residential in Rajasthan under 1 lakh');
  console.log(`Results: ${results4.length}`);
  results4.forEach(i => {
    console.log(`  - Number: ${i.mstc_auction_number} | Category: ${i.category_name} | Location: ${i.location}`);
  });

  // Check 5: Suggestions for "Residential in "
  console.log('\n==========================================');
  console.log('Test 5: getMstcSearchSuggestions("Residential in ")');
  const suggestions = await MstcSearchService.getMstcSearchSuggestions('Residential in ');
  console.log(`Suggestions returned: ${suggestions.length}`);
  suggestions.forEach(s => {
    console.log(`  - [${s.type}] ${s.text} (${s.subtext})`);
  });
}

run().catch(console.error);
