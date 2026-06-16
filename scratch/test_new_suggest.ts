import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve('.env') });

const INDIA_LOCATIONS: Record<string, string[]> = {
  'kerala': ['kerala', 'kerela', 'kl', 'kochi', 'cochin', 'thiruvananthapuram', 'trivandrum', 'tvm', 'kozhikode', 'calicut', 'thrissur', 'kollam', 'alappuzha', 'ernakulam', 'kannur', 'kasaragod', 'wayanad', 'idukki', 'palakkad', 'malappuram', 'pathanamthitta', 'kottayam'],
  'tamil nadu': ['tamil nadu', 'tamilnadu', 'tn', 'chennai', 'madras', 'coimbatore', 'cbe', 'madurai', 'trichy', 'salem', 'tiruppur', 'erode', 'vellore', 'tirunelveli', 'thoothukudi', 'dindigul', 'nagercoil', 'thanjavur', 'kanchipuram'],
  'karnataka': ['karnataka', 'ka', 'bengaluru', 'bangalore', 'blr', 'mysore', 'mysuru', 'mangaluru', 'mangalore', 'hubli', 'dharwad', 'belagavi', 'belgaum', 'gulbarga', 'kalaburagi', 'ballari', 'bellary', 'davanagere', 'shimoga', 'tumkur', 'udupi'],
  'andhra pradesh': ['andhra pradesh', 'andhra', 'ap', 'visakhapatnam', 'vizag', 'vijayawada', 'guntur', 'nellore', 'kurnool', 'rajahmundry', 'kakinada', 'tirupati', 'kadapa', 'anantapur', 'eluru'],
  'telangana': ['telangana', 'ts', 'hyderabad', 'hyd', 'secunderabad', 'warangal', 'nizamabad', 'karimnagar', 'khammam'],
  'maharashtra': ['maharashtra', 'mh', 'mumbai', 'bombay', 'pune', 'poona', 'nagpur', 'nashik', 'aurangabad', 'solapur', 'kolhapur', 'thane', 'navi mumbai', 'amravati'],
  'gujarat': ['gujarat', 'gj', 'ahmedabad', 'amd', 'surat', 'vadodara', 'baroda', 'rajkot', 'gandhinagar', 'bhavnagar', 'jamnagar', 'junagadh'],
  'rajasthan': ['rajasthan', 'rj', 'jaipur', 'jodhpur', 'kota', 'bikaner', 'udaipur', 'ajmer', 'bhilwara', 'alwar', 'sikar'],
  'madhya pradesh': ['madhya pradesh', 'mp', 'bhopal', 'indore', 'jabalpur', 'gwalior', 'ujjain', 'sagar', 'rewa', 'satna'],
  'uttar pradesh': ['uttar pradesh', 'up', 'lucknow', 'kanpur', 'agra', 'varanasi', 'prayagraj', 'allahabad', 'meerut', 'ghaziabad', 'noida', 'mathura', 'aligarh', 'bareilly', 'moradabad', 'saharanpur', 'gorakhpur', 'firozabad'],
  'delhi': ['delhi', 'new delhi', 'ncr'],
  'west bengal': ['west bengal', 'wb', 'bengal', 'kolkata', 'calcutta', 'howrah', 'durgapur', 'asansol', 'siliguri'],
};

async function testSuggestions(query: string) {
  const { MstcSearchService } = await import('../src/services/publicService');
  const { parsePriceConstraint, cleanQueryFromPriceConstraint } = await import('../src/services/nlpSearchUtils');

  const trimmedQuery = query.trim();
  console.log(`\n==========================================`);
  console.log(`Query: "${trimmedQuery}"`);

  // Split query into category part and location part
  let categoryPart = trimmedQuery;
  let locationPart = '';
  
  const prepRegex = /\b(located\s+in|located\s+at|in|at|from|near|around|within)\b\s*(.*)$/i;
  const prepMatch = trimmedQuery.match(prepRegex);
  if (prepMatch) {
    const matchIndex = trimmedQuery.toLowerCase().lastIndexOf(prepMatch[1].toLowerCase());
    if (matchIndex !== -1) {
      categoryPart = trimmedQuery.substring(0, matchIndex).trim();
      locationPart = trimmedQuery.substring(matchIndex + prepMatch[1].length).trim();
    }
  }

  const priceConstraint = parsePriceConstraint(categoryPart);
  categoryPart = cleanQueryFromPriceConstraint(categoryPart).trim();

  console.log(`  categoryPart: "${categoryPart}" | locationPart: "${locationPart}"`);

  const lowerCategory = categoryPart.toLowerCase();
  const lowerLocation = locationPart.toLowerCase();
  const lowerFull = trimmedQuery.toLowerCase();

  const matchingAuctions = await MstcSearchService.searchClientSide(categoryPart);
  console.log(`  matchingAuctions count: ${matchingAuctions.length}`);

  const suggestions: any[] = [];
  const seen = new Set<string>();

  const addSuggestion = (s: any) => {
    const key = `${s.type}:${s.text.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      suggestions.push(s);
    }
  };

  const matchedCategories = new Set<string>();
  const matchedSubcategories = new Set<string>();
  const matchedLocations = new Set<string>();

  matchingAuctions.forEach(item => {
    if (item.category_name) {
      const parts = item.category_name.split(' | ');
      const mainCat = parts[0]?.trim();
      const subCat = parts[1]?.trim();
      
      if (mainCat && (mainCat.toLowerCase().startsWith(lowerCategory) || mainCat.toLowerCase().includes(lowerCategory))) {
        matchedCategories.add(mainCat);
      }
      if (subCat && (subCat.toLowerCase().startsWith(lowerCategory) || subCat.toLowerCase().includes(lowerCategory))) {
        matchedSubcategories.add(subCat);
      }
    }
  });

  // Match locations
  if (locationPart.length > 0) {
    const isLocationMatch = (canonical: string, aliases: string[], query: string): boolean => {
      const q = query.trim().toLowerCase();
      if (!q) return false;
      const matchesString = (str: string) => {
        const s = str.toLowerCase();
        if (s.startsWith(q)) return true;
        const words = s.split(/\s+/);
        return words.some(w => w.startsWith(q));
      };
      if (matchesString(canonical)) return true;
      return aliases.some(alias => matchesString(alias));
    };

    for (const [canonical, aliases] of Object.entries(INDIA_LOCATIONS)) {
      const canonicalDisplay = canonical.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (isLocationMatch(canonical, aliases, lowerLocation)) {
        matchedLocations.add(canonicalDisplay);
      }
    }
  }

  // Add category & subcategory direct suggestions if not compound
  if (locationPart.length === 0) {
    matchedCategories.forEach(cat => addSuggestion({ type: 'category', text: cat }));
    matchedSubcategories.forEach(sub => addSuggestion({ type: 'subcategory', text: sub }));
  }

  // Generate Compound Suggestions
  const popularLocations = ['Uttar Pradesh', 'Kerala', 'Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu'];
  
  const locationsToUse = matchedLocations.size > 0 
    ? Array.from(matchedLocations) 
    : (locationPart.length === 0 ? popularLocations : []);

  const priceSuffix = priceConstraint 
    ? ` ${priceConstraint.operator === 'less' ? 'under' : 'above'} ${priceConstraint.value >= 100000 ? (priceConstraint.value / 100000) + ' lakh' : priceConstraint.value}`
    : '';

  matchedSubcategories.forEach(sub => {
    locationsToUse.forEach(loc => {
      addSuggestion({
        type: 'query',
        text: `${sub.toLowerCase()} in ${loc}${priceSuffix}`,
        subtext: `Find ${sub.toLowerCase()} in ${loc}`
      });
    });
  });

  // Final filter
  const filtered = suggestions.filter(s => {
    let checkText = s.text.toLowerCase();
    if (s.type === 'location' && checkText.startsWith('auctions in ')) {
      checkText = checkText.replace('auctions in ', '');
    }
    return checkText.includes(lowerCategory) || checkText.includes(lowerFull);
  });

  console.log(`  Suggestions Returned: ${filtered.length}`);
  filtered.slice(0, 5).forEach(s => {
    console.log(`    - [${s.type}] "${s.text}"`);
  });
}

async function run() {
  await testSuggestions('Residential in ');
  await testSuggestions('Residential in ker');
  await testSuggestions('cables in u');
  await testSuggestions('timber in Kerala');
}

run().catch(console.error);
