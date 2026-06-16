import 'dotenv/config';

import { MstcSearchService } from '../src/services/publicService';

async function testQuery(query: string) {
  console.log(`\n==================================================`);
  console.log(`Testing query: "${query}"`);
  console.log(`==================================================`);
  const results = await MstcSearchService.searchMarketplaceCatalog(query);
  console.log(`Found ${results.length} results.`);
  
  if (results.length > 0) {
    console.log('Top 5 matches:');
    results.slice(0, 5).forEach(item => {
      console.log(`- [${item.mstc_auction_number}] ${item.category_name} in ${item.location}`);
    });

    const firstItem = results[0];
    console.log(`\nTesting similar suggestions for first item: "${firstItem.category_name}" under query "${query}"`);
    const related = await MstcSearchService.getRelatedMstcAuctions(firstItem, query, 3);
    console.log('Top related results:');
    related.forEach(item => {
      console.log(`- [${item.mstc_auction_number}] ${item.category_name} in ${item.location}`);
    });
  } else {
    console.log('No results found.');
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  await testQuery('I NEED A HEAVY VEHCILE');
  await delay(6000);
  await testQuery('heavy vehicles in Tamil Nadu');
  await delay(6000);
  await testQuery('cables in Tamil Nadu under 2 lakhs');
  await delay(6000);
  await testQuery('pre bid emd below 50 thousand');
}

runTests().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
