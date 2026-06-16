// @ts-nocheck
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve('.env') });

async function run() {
  const query = 'Residential in ';
  const trimmedQuery = query.trim();

  const { INVERTED_SYNONYM_MAP, CONCEPT_MAP, STOP_WORDS, GENERIC_KEYWORDS, getInflections, extractTokens, findClosestKeyword, parsePriceConstraint, cleanQueryFromPriceConstraint, filterCompoundComponents, matchWholeWord, getLevenshteinDistance, cleanQueryPriceTypos } = await import('../src/services/nlpSearchUtils');
  const { MstcSearchService } = await import('../src/services/publicService');

  // Extract variables
  const priceConstraint = parsePriceConstraint(trimmedQuery);
  let baseTerm = cleanQueryFromPriceConstraint(trimmedQuery);
  console.log('baseTerm after cleanQueryFromPriceConstraint:', baseTerm);
  
  // Custom extractLocationFromQuery logic from publicService.ts
  const lowerBase = baseTerm.toLowerCase().trim();
  console.log('lowerBase:', lowerBase);

  // Let's call MstcSearchService.getMstcSearchSuggestions and print its internal values
  const matchingAuctions = await MstcSearchService.searchClientSide(trimmedQuery);
  console.log('matchingAuctions length:', matchingAuctions.length);

  const matchedCategories = new Set<string>();
  const matchedSubcategories = new Set<string>();
  const matchedLocations = new Set<string>();

  const lowerBaseTerm = 'residential'; // remaining query after location extraction

  matchingAuctions.forEach(item => {
    if (item.category_name) {
      const parts = item.category_name.split(' | ');
      const mainCat = parts[0]?.trim();
      const subCat = parts[1]?.trim();
      
      console.log('item:', item.mstc_auction_number);
      console.log('  mainCat:', mainCat, 'startsWith/includes lowerBaseTerm:', mainCat.toLowerCase().startsWith(lowerBaseTerm), mainCat.toLowerCase().includes(lowerBaseTerm));
      console.log('  subCat:', subCat, 'startsWith/includes lowerBaseTerm:', subCat.toLowerCase().startsWith(lowerBaseTerm), subCat.toLowerCase().includes(lowerBaseTerm));

      if (mainCat && (mainCat.toLowerCase().startsWith(lowerBaseTerm) || mainCat.toLowerCase().includes(lowerBaseTerm))) {
        matchedCategories.add(mainCat);
      }
      if (subCat && (subCat.toLowerCase().startsWith(lowerBaseTerm) || subCat.toLowerCase().includes(lowerBaseTerm))) {
        matchedSubcategories.add(subCat);
      }
    }
  });

  console.log('matchedCategories:', Array.from(matchedCategories));
  console.log('matchedSubcategories:', Array.from(matchedSubcategories));

  // Let's see if suggestions are added
  const suggestions: any[] = [];
  const seen = new Set<string>();
  const addSuggestion = (s: any) => {
    const key = `${s.type}:${s.text.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      suggestions.push(s);
    }
  };

  matchedSubcategories.forEach(sub => {
    addSuggestion({
      type: 'subcategory',
      text: sub,
      subtext: 'Subcategory'
    });
  });

  console.log('Initial suggestions:', suggestions);

  const popularLocations = ['Uttar Pradesh', 'Kerala', 'Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu'];
  const popularSubcategories = ['iron and steel', 'computers', 'battery', 'transformer', 'fly ash'];

  matchedSubcategories.forEach(sub => {
    popularLocations.forEach(loc => {
      addSuggestion({
        type: 'query',
        text: `${sub.toLowerCase()} in ${loc}`,
        subtext: `Find ${sub.toLowerCase()} in ${loc}`
      });
    });
  });

  console.log('Suggestions with compound queries:', suggestions);

  // Final strict filter: make sure ALL returned suggestions contain the search query prefix/substring to avoid random noise
  const filteredSuggestions = suggestions.filter(s => {
    let checkText = s.text.toLowerCase();
    if (s.type === 'location' && checkText.startsWith('auctions in ')) {
      checkText = checkText.replace('auctions in ', '');
    }
    const match = checkText.includes(lowerBase) || checkText.includes(query.toLowerCase());
    console.log(`Checking suggestion: "${s.text}" | checkText: "${checkText}" | includes "${lowerBase}":`, checkText.includes(lowerBase), `| includes "${query.toLowerCase()}":`, checkText.includes(query.toLowerCase()), `| MATCH:`, match);
    return match;
  });

  console.log('Filtered suggestions:', filteredSuggestions);
}

run().catch(console.error);
