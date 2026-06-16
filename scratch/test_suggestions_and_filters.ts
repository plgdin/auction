import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve('.env') });

async function runTests() {
  const { MstcSearchService } = await import('../src/services/publicService');
  console.log('============================================================');
  console.log('RUNNING SEARCH SUGGESTIONS & FILTER VERIFICATION TESTS');
  console.log('============================================================\n');

  // Test Case 1: Suggestions for "comp"
  console.log('--- Test Case 1: Suggestions for "comp" ---');
  const suggestionsComp = await MstcSearchService.getMstcSearchSuggestions('comp');
  console.log(`Returned ${suggestionsComp.length} suggestions:`);
  suggestionsComp.forEach((s, i) => {
    console.log(`  [${i + 1}] Type: ${s.type.padEnd(12)} | Text: "${s.text}" | Subtext: "${s.subtext || ''}"`);
  });
  console.log();

  // Test Case 2: Suggestions for "iron"
  console.log('--- Test Case 2: Suggestions for "iron" ---');
  const suggestionsIron = await MstcSearchService.getMstcSearchSuggestions('iron');
  console.log(`Returned ${suggestionsIron.length} suggestions:`);
  suggestionsIron.forEach((s, i) => {
    console.log(`  [${i + 1}] Type: ${s.type.padEnd(12)} | Text: "${s.text}" | Subtext: "${s.subtext || ''}"`);
  });
  console.log();

  // Test Case 3: Empty query suggestions
  console.log('--- Test Case 3: Empty query suggestions ---');
  const suggestionsEmpty = await MstcSearchService.getMstcSearchSuggestions('');
  console.log(`Returned ${suggestionsEmpty.length} suggestions:`);
  suggestionsEmpty.forEach((s, i) => {
    console.log(`  [${i + 1}] Type: ${s.type.padEnd(12)} | Text: "${s.text}" | Subtext: "${s.subtext || ''}"`);
  });
  console.log();

  // Test Case 4: Search for "computers in Uttar Pradesh"
  console.log('--- Test Case 4: Search results for "computers in Uttar Pradesh" ---');
  const resultsUP = await MstcSearchService.searchClientSide('computers in Uttar Pradesh');
  console.log(`Returned ${resultsUP.length} results.`);
  if (resultsUP.length > 0) {
    const nonUPorNonComp = resultsUP.filter(item => {
      const isUP = (item.location || '').toLowerCase().includes('uttar pradesh') || 
                   (item.location || '').toLowerCase().includes('noida') ||
                   (item.location || '').toLowerCase().includes('kanpur') ||
                   (item.location || '').toLowerCase().includes('lucknow');
      const isComp = (item.category_name || '').toLowerCase().includes('computers / peripherals');
      return !isUP || !isComp;
    });

    console.log(`  Non-matching results found: ${nonUPorNonComp.length}`);
    if (nonUPorNonComp.length > 0) {
      console.log('  WARNING: Some results do not follow the strict filtering conditions!');
      nonUPorNonComp.slice(0, 3).forEach(item => {
        console.log(`    Num: ${item.mstc_auction_number} | Cat: ${item.category_name} | Loc: ${item.location}`);
      });
    } else {
      console.log('  SUCCESS: All results perfectly match the category "Compters/peripherals" and location "Uttar Pradesh"!');
      resultsUP.slice(0, 3).forEach(item => {
        console.log(`    Result: ${item.mstc_auction_number} | Cat: ${item.category_name} | Loc: ${item.location}`);
      });
    }
  } else {
    console.log('  No auctions matched or database is empty.');
  }
  console.log();

  // Test Case 5: Search for "iron and steel in kerela"
  console.log('--- Test Case 5: Search results for "iron and steel in kerela" ---');
  const resultsKerala = await MstcSearchService.searchClientSide('iron and steel in kerela');
  console.log(`Returned ${resultsKerala.length} results.`);
  if (resultsKerala.length > 0) {
    const nonKeralaOrNonIron = resultsKerala.filter(item => {
      const isKerala = (item.location || '').toLowerCase().includes('kerala') || 
                       (item.location || '').toLowerCase().includes('kochi') ||
                       (item.location || '').toLowerCase().includes('ernakulam') ||
                       (item.location || '').toLowerCase().includes('trivandrum');
      const isIron = (item.category_name || '').toLowerCase().includes('iron and steel');
      return !isKerala || !isIron;
    });

    console.log(`  Non-matching results found: ${nonKeralaOrNonIron.length}`);
    if (nonKeralaOrNonIron.length > 0) {
      console.log('  WARNING: Some results do not follow the strict filtering conditions!');
      nonKeralaOrNonIron.slice(0, 3).forEach(item => {
        console.log(`    Num: ${item.mstc_auction_number} | Cat: ${item.category_name} | Loc: ${item.location}`);
      });
    } else {
      console.log('  SUCCESS: All results perfectly match the category "Iron and steel" and location "Kerala"!');
      resultsKerala.slice(0, 3).forEach(item => {
        console.log(`    Result: ${item.mstc_auction_number} | Cat: ${item.category_name} | Loc: ${item.location}`);
      });
    }
  } else {
    console.log('  No auctions matched or database is empty.');
  }
  // Test Case 6: Suggestions for prefix "ca"
  console.log('--- Test Case 6: Suggestions for prefix "ca" ---');
  const suggestionsCa = await MstcSearchService.getMstcSearchSuggestions('ca');
  console.log(`Returned ${suggestionsCa.length} suggestions:`);
  suggestionsCa.forEach((s, i) => {
    console.log(`  [${i + 1}] Type: ${s.type.padEnd(12)} | Text: "${s.text}" | Subtext: "${s.subtext || ''}"`);
  });
  console.log();
}

runTests().catch(console.error);
