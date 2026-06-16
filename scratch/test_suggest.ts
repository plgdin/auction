// @ts-nocheck
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve('.env') });

async function run() {
  const { MstcSearchService } = await import('../src/services/publicService');
  const { parsePriceConstraint } = await import('../src/services/nlpSearchUtils');
  const query = 'Residential in ';
  const trimmedQuery = query.trim();
  
  console.log('--- Debug suggestions for: "Residential in " ---');
  const priceConstraint = parsePriceConstraint(trimmedQuery);
  console.log('priceConstraint:', priceConstraint);
  
  // Let's call searchClientSide directly
  const matchingAuctions = await MstcSearchService.searchClientSide(trimmedQuery);
  console.log('matchingAuctions count:', matchingAuctions.length);
  if (matchingAuctions.length > 0) {
    console.log('matchingAuctions[0]:', matchingAuctions[0].mstc_auction_number);
  }

  const suggestions = await MstcSearchService.getMstcSearchSuggestions(query);
  console.log('Suggestions count:', suggestions.length);
}

run().catch(console.error);
