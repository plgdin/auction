import { supabase } from '../lib/supabase';
import type { ContactMessage, FaqItem, Announcement, NewsUpdate } from '../types/database.types';
import { PageCache } from '../utils/pageCache';
import { hasConfirmedAssetDocuments, isPreBidRequired } from '../utils/mstcHelpers';
import {
  INVERTED_SYNONYM_MAP,
  CONCEPT_MAP,
  STOP_WORDS,
  GENERIC_KEYWORDS,
  getInflections,
  extractTokens,
  findClosestKeyword,
  parsePriceConstraint,
  cleanQueryFromPriceConstraint,
  filterCompoundComponents,
  matchWholeWord,
  getLevenshteinDistance,
  cleanQueryPriceTypos
} from './nlpSearchUtils';

// ─── India Location Lookup ────────────────────────────────────────────────────
// Maps canonical state/city → all known aliases (names, abbreviations, spellings).
// Add new cities/states here — the search engine picks them up automatically.
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
  'odisha': ['odisha', 'orissa', 'or', 'bhubaneswar', 'cuttack', 'rourkela', 'sambalpur', 'puri', 'balasore'],
  'jharkhand': ['jharkhand', 'jh', 'ranchi', 'jamshedpur', 'dhanbad', 'bokaro', 'hazaribagh'],
  'bihar': ['bihar', 'br', 'patna', 'gaya', 'bhagalpur', 'muzaffarpur', 'darbhanga', 'purnia'],
  'chhattisgarh': ['chhattisgarh', 'cg', 'raipur', 'bilaspur', 'durg', 'korba', 'rajnandgaon'],
  'punjab': ['punjab', 'pb', 'ludhiana', 'amritsar', 'jalandhar', 'patiala', 'bathinda', 'mohali'],
  'haryana': ['haryana', 'hr', 'faridabad', 'gurugram', 'gurgaon', 'hisar', 'rohtak', 'panipat', 'karnal', 'ambala', 'sonipat'],
  'chandigarh': ['chandigarh'],
  'uttarakhand': ['uttarakhand', 'uk', 'dehradun', 'haridwar', 'roorkee', 'rishikesh', 'haldwani', 'nainital'],
  'himachal pradesh': ['himachal pradesh', 'hp', 'shimla', 'dharamsala', 'mandi', 'solan'],
  'assam': ['assam', 'as', 'guwahati', 'dibrugarh', 'silchar', 'jorhat'],
  'goa': ['goa', 'panaji', 'margao', 'vasco'],
  'manipur': ['manipur', 'mn', 'imphal'],
  'meghalaya': ['meghalaya', 'ml', 'shillong'],
  'mizoram': ['mizoram', 'mz', 'aizawl'],
  'nagaland': ['nagaland', 'nl', 'kohima'],
  'tripura': ['tripura', 'tr', 'agartala'],
  'sikkim': ['sikkim', 'sk', 'gangtok'],
  'arunachal pradesh': ['arunachal pradesh', 'arunachal', 'itanagar'],
  'jammu and kashmir': ['jammu and kashmir', 'jammu', 'kashmir', 'jk', 'srinagar'],
  'ladakh': ['ladakh', 'leh'],
};

/**
 * Extract a location mentioned in the query (e.g. "in Kerala", "at Mumbai", "from UP", bare "Kerala").
 * Returns the canonical location key and the query with the location phrase stripped.
 */
function findLocationMatch(candidate: string): string | null {
  const c = candidate.trim().toLowerCase();
  if (!c || c.length <= 1) return null;
  if (STOP_WORDS.has(c)) return null;

  // Exact check first
  for (const [canonical, aliases] of Object.entries(INDIA_LOCATIONS)) {
    if (canonical.toLowerCase() === c) return canonical;
    for (const alias of aliases) {
      if (alias.toLowerCase() === c) return canonical;
    }
  }

  // Fuzzy check - only for candidates with length >= 4 to avoid short-word collisions (e.g. "me" matching "mh")
  if (c.length <= 3) return null;

  let bestCanonical: string | null = null;
  let minDistance = Infinity;

  const isAllowedFuzzy = (dist: number, target: string) => {
    if (dist === 0) return true;
    if (dist === 1 && target.length >= 3) return true;
    if (dist === 2 && target.length >= 7 && c.length >= 7) return true;
    return false;
  };

  for (const [canonical, aliases] of Object.entries(INDIA_LOCATIONS)) {
    // Check canonical
    const distCanonical = getLevenshteinDistance(c, canonical.toLowerCase());
    if (isAllowedFuzzy(distCanonical, canonical) && distCanonical < minDistance) {
      minDistance = distCanonical;
      bestCanonical = canonical;
    }

    // Check aliases
    for (const alias of aliases) {
      const distAlias = getLevenshteinDistance(c, alias.toLowerCase());
      if (isAllowedFuzzy(distAlias, alias) && distAlias < minDistance) {
        minDistance = distAlias;
        bestCanonical = canonical;
      }
    }
  }

  return bestCanonical;
}

function extractLocationFromQuery(query: string): { canonical: string | null; remainingQuery: string } {
  if (!query) return { canonical: null, remainingQuery: query };
  const lower = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = lower.split(' ');

  // 1. First try with prepositions to be highly accurate
  const preps = ['located in', 'located at', 'in', 'at', 'from', 'near', 'around', 'within'];
  for (const prep of preps) {
    const prepWords = prep.split(' ');
    // Find index of prep sequence
    let prepIndex = -1;
    for (let i = 0; i <= words.length - prepWords.length; i++) {
      let match = true;
      for (let j = 0; j < prepWords.length; j++) {
        if (words[i + j] !== prepWords[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        prepIndex = i;
        break;
      }
    }

    if (prepIndex !== -1) {
      // Look at sequences of length 1, 2, 3 following the preposition
      const startIndex = prepIndex + prepWords.length;
      for (let len = 3; len >= 1; len--) {
        if (startIndex + len <= words.length) {
          const candidate = words.slice(startIndex, startIndex + len).join(' ');
          const matched = findLocationMatch(candidate);
          if (matched) {
            // Strip preposition and candidate from the query
            const remainingWords = [...words];
            remainingWords.splice(prepIndex, prepWords.length + len);
            return { canonical: matched, remainingQuery: remainingWords.join(' ') };
          }
        }
      }
    }
  }

  // 2. If no preposition matches, search all word sequences in the query
  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const candidate = words.slice(i, i + len).join(' ');
      const matched = findLocationMatch(candidate);
      if (matched) {
        const remainingWords = [...words];
        remainingWords.splice(i, len);
        return { canonical: matched, remainingQuery: remainingWords.join(' ') };
      }
    }
  }

  return { canonical: null, remainingQuery: query };
}

/**
 * Returns true if the DB location string contains any alias for the given canonical location.
 * Handles "Kochi, Kerala" matching both "kerala" and "kochi".
 */
function dbLocationMatchesCanonical(dbLocation: string, canonical: string): boolean {
  if (!dbLocation || !canonical) return false;
  const loc = dbLocation.toLowerCase();
  const aliases = INDIA_LOCATIONS[canonical] || [];
  for (const alias of aliases) {
    if (loc.includes(alias.toLowerCase())) return true;
  }
  return false;
}

// ─── Subcategory Precision Map ────────────────────────────────────────────────
// When the user's query matches a phrase here, ONLY that specific subcategory is returned.
// Future-proof: add new entries as subcategories are added to the system.
const SUBCATEGORY_EXACT_MAP: Array<{ phrase: string; subcategory: string }> = [
  // Metal subcategories
  { phrase: 'iron and steel', subcategory: 'Iron and steel' },
  { phrase: 'iron & steel', subcategory: 'Iron and steel' },
  { phrase: 'iron steel', subcategory: 'Iron and steel' },
  { phrase: 'ms scrap', subcategory: 'Iron and steel' },
  { phrase: 'mild steel', subcategory: 'Iron and steel' },
  { phrase: 'iron', subcategory: 'Iron and steel' },
  { phrase: 'steel', subcategory: 'Iron and steel' },
  { phrase: 'aluminium', subcategory: 'Aluminium' },
  { phrase: 'aluminum', subcategory: 'Aluminium' },
  { phrase: 'copper', subcategory: 'Copper' },
  { phrase: 'brass', subcategory: 'Brass' },
  { phrase: 'zinc', subcategory: 'Zinc' },
  { phrase: 'nickel', subcategory: 'Nickle' },
  { phrase: 'nickle', subcategory: 'Nickle' },
  { phrase: 'bronze', subcategory: 'Gun metal/bronze' },
  { phrase: 'gun metal', subcategory: 'Gun metal/bronze' },
  { phrase: 'mixed metal', subcategory: 'Mixed metal scraps' },
  { phrase: 'mixed scrap', subcategory: 'Mixed metal scraps' },
  { phrase: 'metal', subcategory: 'Mixed metal scraps' },
  { phrase: 'metals', subcategory: 'Mixed metal scraps' },
  { phrase: 'scrap', subcategory: 'Mixed metal scraps' },
  { phrase: 'scraps', subcategory: 'Mixed metal scraps' },
  // Electrical subcategories
  { phrase: 'battery', subcategory: 'Battery' },
  { phrase: 'batteries', subcategory: 'Battery' },
  { phrase: 'transformer', subcategory: 'Transformer' },
  { phrase: 'transformers', subcategory: 'Transformer' },
  { phrase: 'dg set', subcategory: 'DG Sets / Generators' },
  { phrase: 'dg sets', subcategory: 'DG Sets / Generators' },
  { phrase: 'generator', subcategory: 'DG Sets / Generators' },
  { phrase: 'generators', subcategory: 'DG Sets / Generators' },
  { phrase: 'genset', subcategory: 'DG Sets / Generators' },
  { phrase: 'gensets', subcategory: 'DG Sets / Generators' },
  { phrase: 'air conditioner', subcategory: 'Others' },
  { phrase: 'cable', subcategory: 'Cables' },
  { phrase: 'cables', subcategory: 'Cables' },
  { phrase: 'wire', subcategory: 'Cables' },
  { phrase: 'wires', subcategory: 'Cables' },
  // Vehicle subcategories
  { phrase: 'car', subcategory: 'Car' },
  { phrase: 'cars', subcategory: 'Car' },
  { phrase: 'vehicle', subcategory: 'Car' },
  { phrase: 'vehicles', subcategory: 'Car' },
  { phrase: 'automobiles', subcategory: 'Car' },
  { phrase: 'automobile', subcategory: 'Car' },
  { phrase: 'automotive', subcategory: 'Car' },
  { phrase: 'vechicle', subcategory: 'Car' },
  { phrase: 'vechicles', subcategory: 'Car' },
  { phrase: 'truck', subcategory: 'Car' },
  { phrase: 'trucks', subcategory: 'Car' },
  { phrase: 'jeep', subcategory: 'Car' },
  { phrase: 'jeeps', subcategory: 'Car' },
  { phrase: 'bus', subcategory: 'Car' },
  { phrase: 'buses', subcategory: 'Car' },
  { phrase: 'scooter', subcategory: 'Car' },
  { phrase: 'scooters', subcategory: 'Car' },
  { phrase: 'bike', subcategory: 'Car' },
  { phrase: 'bikes', subcategory: 'Car' },
  { phrase: 'motorcycle', subcategory: 'Car' },
  { phrase: 'motorcycles', subcategory: 'Car' },
  { phrase: 'dumper', subcategory: 'Car' },
  { phrase: 'dumpers', subcategory: 'Car' },
  { phrase: 'tipper', subcategory: 'Car' },
  { phrase: 'tippers', subcategory: 'Car' },
  { phrase: 'tractor', subcategory: 'Car' },
  { phrase: 'tractors', subcategory: 'Car' },
  { phrase: 'elv', subcategory: 'Car' },
  { phrase: 'elvs', subcategory: 'Car' },
  { phrase: 'van', subcategory: 'Car' },
  { phrase: 'vans', subcategory: 'Car' },
  // Electronics subcategories
  { phrase: 'computer', subcategory: 'Computers / Peripherals' },
  { phrase: 'computers', subcategory: 'Computers / Peripherals' },
  { phrase: 'laptop', subcategory: 'Computers / Peripherals' },
  { phrase: 'laptops', subcategory: 'Computers / Peripherals' },
  { phrase: 'pc', subcategory: 'Computers / Peripherals' },
  { phrase: 'pcs', subcategory: 'Computers / Peripherals' },
  { phrase: 'desktop', subcategory: 'Computers / Peripherals' },
  { phrase: 'desktops', subcategory: 'Computers / Peripherals' },
  { phrase: 'monitor', subcategory: 'Computers / Peripherals' },
  { phrase: 'monitors', subcategory: 'Computers / Peripherals' },
  { phrase: 'printer', subcategory: 'Computers / Peripherals' },
  { phrase: 'printers', subcategory: 'Computers / Peripherals' },
  { phrase: 'mobile', subcategory: 'Computers / Peripherals' },
  { phrase: 'tablet', subcategory: 'Computers / Peripherals' },
  { phrase: 'e-waste', subcategory: 'Computers / Peripherals' },
  { phrase: 'ewaste', subcategory: 'Computers / Peripherals' },
  { phrase: 'electronics', subcategory: 'Computers / Peripherals' },
  { phrase: 'electronic', subcategory: 'Computers / Peripherals' },
  // Forest Produce
  { phrase: 'teak timber', subcategory: 'Timber' },
  { phrase: 'rosewood', subcategory: 'Timber' },
  { phrase: 'firewood', subcategory: 'Timber' },
  { phrase: 'sandalwood', subcategory: 'Timber' },
  { phrase: 'sandal wood', subcategory: 'Timber' },
  { phrase: 'timber', subcategory: 'Timber' },
  { phrase: 'wood', subcategory: 'Timber' },
  { phrase: 'log', subcategory: 'Timber' },
  { phrase: 'logs', subcategory: 'Timber' },
  { phrase: 'teak', subcategory: 'Timber' },
  // Ash
  { phrase: 'fly ash', subcategory: 'Others' },
  { phrase: 'pond ash', subcategory: 'Others' },
  { phrase: 'bottom ash', subcategory: 'Others' },
  { phrase: 'ash', subcategory: 'Others' },
  { phrase: 'ashes', subcategory: 'Others' },
  // Chemicals
  { phrase: 'spent catalyst', subcategory: 'Others' },
  // Coal
  { phrase: 'coal linkage', subcategory: 'Coal' },
  { phrase: 'coal', subcategory: 'Coal' },
  { phrase: 'lignite', subcategory: 'Minerals' },
  { phrase: 'coke', subcategory: 'Minerals' },
  // Property
  { phrase: 'godown', subcategory: 'Plot/Land' },
  { phrase: 'godowns', subcategory: 'Plot/Land' },
  { phrase: 'warehouse', subcategory: 'Plot/Land' },
  { phrase: 'warehouses', subcategory: 'Plot/Land' },
  { phrase: 'property', subcategory: 'Plot/Land' },
  { phrase: 'properties', subcategory: 'Plot/Land' },
  { phrase: 'land', subcategory: 'Plot/Land' },
  { phrase: 'plot', subcategory: 'Plot/Land' },
  { phrase: 'plots', subcategory: 'Plot/Land' },
  { phrase: 'real estate', subcategory: 'Plot/Land' },
  { phrase: 'realestate', subcategory: 'Plot/Land' },
  { phrase: 'building', subcategory: 'Plot/Land' },
  { phrase: 'buildings', subcategory: 'Plot/Land' },
  { phrase: 'office', subcategory: 'Commercial' },
  { phrase: 'offices', subcategory: 'Commercial' },
  { phrase: 'shop', subcategory: 'Commercial' },
  { phrase: 'shops', subcategory: 'Commercial' },
  { phrase: 'store', subcategory: 'Commercial' },
  { phrase: 'stores', subcategory: 'Commercial' },
  { phrase: 'commercial', subcategory: 'Commercial' },
  { phrase: 'residential', subcategory: 'Residential' },
  { phrase: 'house', subcategory: 'Residential' },
  { phrase: 'houses', subcategory: 'Residential' },
  { phrase: 'flat', subcategory: 'Residential' },
  { phrase: 'flats', subcategory: 'Residential' },
  { phrase: 'apartment', subcategory: 'Residential' },
  { phrase: 'apartments', subcategory: 'Residential' },
  { phrase: 'home', subcategory: 'Residential' },
  { phrase: 'homes', subcategory: 'Residential' },
];

function detectPrecisionSubcategory(query: string): string | null {
  if (!query) return null;
  const lower = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = lower.split(' ');

  const sortedMap = [...SUBCATEGORY_EXACT_MAP].sort((a, b) => b.phrase.length - a.phrase.length);

  // Try exact match first
  for (const { phrase, subcategory } of sortedMap) {
    if (lower.includes(phrase)) return subcategory;
  }

  // Try fuzzy matching of word sequences
  for (const { phrase, subcategory } of sortedMap) {
    const phraseWords = phrase.split(' ');
    for (let i = 0; i <= words.length - phraseWords.length; i++) {
      const candidate = words.slice(i, i + phraseWords.length).join(' ');
      
      if (STOP_WORDS.has(candidate)) {
        continue;
      }
      
      const dist = getLevenshteinDistance(candidate, phrase);
      
      let allowed = false;
      if (dist === 0) {
        allowed = true;
      } else if (dist === 1 && phrase.length >= 3) {
        allowed = true;
      } else if (dist === 2 && phrase.length >= 7 && candidate.length >= 7) {
        allowed = true;
      }

      if (allowed) {
        return subcategory;
      }
    }
  }

  return null;
}

function matchSubcategory(itemSub: string, targetSub: string): boolean {
  const item = itemSub.toLowerCase().trim();
  const target = targetSub.toLowerCase().trim();
  if (item === target) return true;

  const itemNorm = item.replace(/[^a-z0-9]/g, '');
  const targetNorm = target.replace(/[^a-z0-9]/g, '');
  if (itemNorm === targetNorm) return true;

  // Check if one contains the other as a substring (e.g. 'timber' matching 'timber - rosewood')
  if (itemNorm.includes(targetNorm) || targetNorm.includes(itemNorm)) return true;

  // Equivalences / Synonyms
  if (targetNorm === 'car' || targetNorm === 'endoflifevehicles') {
    return itemNorm === 'car' || itemNorm === 'endoflifevehicles' || itemNorm.includes('vehicle') || itemNorm.includes('car');
  }

  return false;
}



const DEFAULT_FAQ_ITEMS = [
  {
    question: 'Is Lelam affiliated with MSTC India or any government agency?',
    answer: 'No, Lelam is a completely independent, third-party platform. We are not officially affiliated, authorized, or endorsed by MSTC India, the Indian Government, or any public sector undertaking. We only provide analytical value-added services for public eAuctions data.',
    category: 'mstc',
    display_order: 1,
    is_active: true
  },
  // MSTC eAuctions Help
  {
    question: 'How does bidding work in MSTC eAuctions, and how does Lelam assist in the process?',
    answer: 'Bidding in MSTC eAuctions is conducted on the official MSTC e-commerce portal during the scheduled auction time. Lelam is an independent, third-party assistive platform that helps buyers analyze MSTC catalogs, estimate market values, calculate projected transportation and unloading costs, and assess potential ROI. Bidders must register and place actual bids on the official MSTC platform.',
    category: 'mstc',
    display_order: 2,
    is_active: true
  },
  {
    question: 'Why are photos sometimes missing or different from the actual scrap items on MSTC eAuctions, and how can Lelam help?',
    answer: 'MSTC eAuctions feature scrap and surplus materials which are stored in open environments and subject to deterioration. Because of this, MSTC rarely uploads high-quality photos to prevent misleading interpretations, advising buyers to inspect materials in person. Lelam assists by aggregating available catalog details, providing documents, and helping you analyze lot specifications to make better-informed inspection and bidding decisions.',
    category: 'mstc',
    display_order: 3,
    is_active: true
  },
  {
    question: 'How is the Pre-Bid EMD (Earnest Money Deposit) handled and refunded for MSTC eAuctions?',
    answer: "Pre-Bid EMD is managed directly by MSTC and the respective sellers. For unsuccessful bids, the EMD is typically refunded back to the buyer's ledger on the MSTC portal. Please note that Lelam has no access to your financial transactions or EMD payments; all payments, challans, and refunds must be managed directly through the official MSTC portal.",
    category: 'mstc',
    display_order: 4,
    is_active: true
  },
  {
    question: 'What should I do if my Pre-Bid EMD is not credited in my MSTC ledger for an eAuction?',
    answer: 'EMD credit delays on MSTC usually happen if multiple transactions are sent using a single NEFT/RTGS challan, or if the deposit is made more than 3 days after challan generation. You should double-check your transaction references and contact the respective MSTC branch officer. As Lelam is an independent utility, we do not handle or process any payments or deposits.',
    category: 'mstc',
    display_order: 5,
    is_active: true
  },
  {
    question: 'Why do MSTC eAuctions often run late into the night or go into extensions?',
    answer: 'MSTC eAuctions automatically enter extensions if active bidding continues near the closing time. This system ensures fair competition for the lot. Lelam helps you prepare for these long sessions by providing real-time valuation metrics and an interactive bid-and-cost calculator so you can calculate your break-even bid threshold in advance.',
    category: 'mstc',
    display_order: 6,
    is_active: true
  },
  {
    question: 'How do I submit my Pollution Control Board (PCB) documents for e-waste or hazardous scrap eAuctions?',
    answer: 'For e-waste and restricted scrap categories, buyers must submit their Consent to Operate and PCB passbooks to the concerned MSTC dealing officer listed in the eAuction catalogue. Lelam provides a consolidated view of these key contacts and eligibility criteria extracted from the official eAuction PDF to simplify your preparation.',
    category: 'mstc',
    display_order: 7,
    is_active: true
  },

  // Lelam Platform Help
  {
    question: 'What is Lelam and how does it work for eAuctions?',
    answer: 'Lelam is an advanced assistant and intelligence platform for industrial and government eAuctions. Our system automatically scrapes, normalizes, and indexes public catalogs from portals like MSTC. We then apply statistical models and NLP search capabilities to help you search, analyze, and estimate the value of scrap, vehicles, and raw materials.',
    category: 'lelam',
    display_order: 8,
    is_active: true
  },
  {
    question: 'How do I search for specific materials or locations of eAuctions on Lelam?',
    answer: 'You can use our hybrid search bar on the homepage. Our NLP-powered eAuctions search understands typos, synonyms (like "mild steel" for "MS scrap"), and locations (like "in Kerala" or "near Mumbai"). You can search for active eAuctions by material type, auction number, seller, or state.',
    category: 'lelam',
    display_order: 9,
    is_active: true
  },
  {
    question: 'How does the Live Bid & Cost Calculator work for eAuctions?',
    answer: 'When viewing an eAuction listing on Lelam, you can use our dynamic calculator to build custom quotes. You can input your bid price per metric ton, and the system automatically calculates extra charges such as GST, TCS, Customs duties, loading fees, and transport costs to give you an accurate landed cost and ROI estimate.',
    category: 'lelam',
    display_order: 10,
    is_active: true
  },
  {
    question: 'Why is valuation or market pricing not available for some eAuction catalogs?',
    answer: 'Valuation predictions for eAuctions require sufficient historical data and stable market price indices (like LME or local scrap rates). For highly custom, mixed, or rare eAuction lots (such as mixed plant machinery, unsorted office waste, or unique property lots), our linear regression models do not have standardized pricing parameters. In these cases, we disable the automated valuation panel to prevent inaccurate projections.',
    category: 'lelam',
    display_order: 11,
    is_active: true
  },
  {
    question: 'Can I place bids directly on eAuctions through the Lelam website?',
    answer: 'No, Lelam is an assistive analytical tool and does not host the eAuctions bidding environment. To place bids, you must log in to the official MSTC e-commerce platform and use their bidding interface.',
    category: 'lelam',
    display_order: 12,
    is_active: true
  },
  {
    question: 'How does the Scrap Metal Price regression model for eAuctions work?',
    answer: 'Our system runs a trend-prediction model for eAuctions utilizing historical market prices from Indian scrap hubs and global metal exchanges (like LME). It maps these benchmarks to the specific eAuction catalog specifications (material type, grade, and location) to predict a fair market price range.',
    category: 'lelam',
    display_order: 13,
    is_active: true
  },
  {
    question: 'What is the "Interested" or bookmarking feature for eAuctions?',
    answer: 'If you find an eAuction catalog or listing that you want to keep track of, you can click the Heart icon on the card. This saves the listing to your watchlist so you can easily access it later and receive updates when the opening date approaches.',
    category: 'lelam',
    display_order: 14,
    is_active: true
  },
  {
    question: 'How do I access the PDF catalogs and official documents for eAuctions on Lelam?',
    answer: 'We index and host official eAuction catalogs and terms sheets in our secure Supabase storage. When viewing an eAuction details page, you can open or download the original PDF document to read the complete official terms.',
    category: 'lelam',
    display_order: 15,
    is_active: true
  },
  {
    question: 'How often is the eAuctions catalog data on Lelam updated?',
    answer: 'Our scraping system runs multiple times a day to search for new eAuction catalog releases and update active schedules. Any new eAuctions published on MSTC are processed and made searchable on Lelam within a few hours.',
    category: 'lelam',
    display_order: 16,
    is_active: true
  },
  {
    question: 'Do I need to pay to use Lelam\'s analytical tools for eAuctions?',
    answer: 'Lelam offers free access to eAuction catalog searches, basic details, and standard calculators. Advanced analytics, trend histories, and automated price prediction models for eAuctions are available to registered business users.',
    category: 'lelam',
    display_order: 17,
    is_active: true
  }
];

export const publicService = {
  async submitContactMessage(messageData: Partial<ContactMessage>): Promise<boolean> {
    const { error } = await supabase
      .from('contact_messages')
      .insert([messageData]);

    if (error) {
      console.error('Error submitting contact message:', error);
      return false;
    }
    return true;
  },

  getActiveFaqs: PageCache.memoize(async function getActiveFaqs(): Promise<FaqItem[]> {
    try {
      const { data, error } = await supabase
        .from('faq_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        return data;
      }

      // If empty in DB, return defaults mapped with unique IDs
      return DEFAULT_FAQ_ITEMS.map((faq, index) => ({
        id: `faq-${index + 1}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...faq
      })) as any[];
    } catch (e) {
      console.error('Error fetching FAQs, falling back to local defaults:', e);
      return DEFAULT_FAQ_ITEMS.map((faq, index) => ({
        id: `faq-${index + 1}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...faq
      })) as any[];
    }
  }, 'activeFaqs'),

  getActiveAnnouncements: PageCache.memoize(async function getActiveAnnouncements(limit: number = 5): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }
    return data;
  }, 'activeAnnouncements'),

  getPublishedNews: PageCache.memoize(async function getPublishedNews(limit: number = 10): Promise<NewsUpdate[]> {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching news:', error);
      return [];
    }
    return data;
  }, 'publishedNews'),

  async getMaintenanceMode(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single();
      
      if (error) {
        return false;
      }
      return !!data?.value;
    } catch (e) {
      return false;
    }
  },

  async logUnauthorizedLogin(logData: {
    email: string;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
    system_info?: any;
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('security_audit_logs')
        .insert({
          email: logData.email,
          user_id: logData.user_id || null,
          ip_address: logData.ip_address || 'Unknown',
          user_agent: logData.user_agent || 'Unknown',
          system_info: logData.system_info || {}
        });
      if (error) {
        console.error('Error logging unauthorized access:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error logging unauthorized access:', e);
      return false;
    }
  }
};

export interface MstcSanitizedAuction {
  id: string;
  mstc_auction_number: string;
  seller_name: string;
  category_name: string;
  location: string;
  opening_date: string;
  closing_date: string;
  sanitized_document_path: string | null; // Masked path pointing exclusively to your Supabase cloud asset
  raw_materials_text: string | null;
  status: string;
  is_reauction?: boolean;
  original_auction_number?: string | null;
  parent_auction_id?: string | null;
}

export interface SearchSuggestion {
  type: 'category' | 'subcategory' | 'location' | 'seller' | 'query' | 'auction';
  text: string;
  subtext?: string;
}

const MAIN_CATEGORIES = [
  'Agricultural Produce',
  'Aquatic Produce',
  'Ash',
  'Chemicals',
  'Coal',
  'Container',
  'Diamond',
  'Electrical Items',
  'Electronics Items',
  'Forest Produce',
  'Immovable Property',
  'Liquor License Contracts',
  'Metal',
  'Mine Block',
  'Minerals',
  'Miscellaneous',
  'Petroleum Products',
  'Plant/Machineries',
  'Transport Vehicles',
  'Vessels'
];

function buildTaxonomy(data: MstcSanitizedAuction[]): {
  categoryKeywords: Record<string, string[]>;
  subcategoryKeywords: Record<string, string[]>;
} {
  const categoryKeywords: Record<string, string[]> = {};
  const subcategoryKeywords: Record<string, string[]> = {};

  // Seed with CONCEPT_MAP
  for (const [conceptWord, catList] of Object.entries(CONCEPT_MAP)) {
    categoryKeywords[conceptWord] = [...catList];
  }

  // Iterate over data to extract and map keywords from categories/subcategories
  for (const item of data) {
    if (!item.category_name) continue;
    const parts = item.category_name.split(' | ');
    const mainCategory = parts[0].trim();
    const subcategory = parts[1]?.trim();

    // 1. Process main category tokens
    const mainTokens = extractTokens(mainCategory);
    for (const token of mainTokens) {
      if (!categoryKeywords[token]) {
        categoryKeywords[token] = [];
      }
      if (!categoryKeywords[token].includes(mainCategory)) {
        categoryKeywords[token].push(mainCategory);
      }
    }

    // 2. Process subcategory tokens
    if (subcategory) {
      const subTokens = extractTokens(subcategory);
      for (const token of subTokens) {
        if (!subcategoryKeywords[token]) {
          subcategoryKeywords[token] = [];
        }
        if (!subcategoryKeywords[token].includes(mainCategory)) {
          subcategoryKeywords[token].push(mainCategory);
        }
      }
    }
  }

  return { categoryKeywords, subcategoryKeywords };
}

export function estimateAuctionValues(item: MstcSanitizedAuction): { preBid: number; totalValue: number; isEstimated: boolean } {
  const required = isPreBidRequired(item);
  if (!required) {
    return { preBid: 0, totalValue: 500000, isEstimated: false };
  }

  let preBid = 50000; // default fallback
  let totalValue = 500000; // default fallback (preBid * 10)
  let isEstimated = true;

  const shortId = (item?.mstc_auction_number || '').split('/').pop() || item?.id?.substring(0, 8) || '';
  const shortIdNum = parseInt(shortId, 10);
  if (!isNaN(shortIdNum)) {
    if (shortIdNum % 4 === 0) preBid = 100000;
    else if (shortIdNum % 4 === 1) preBid = 25000;
    else if (shortIdNum % 4 === 2) preBid = 150000;
    else preBid = 50000;
    totalValue = preBid * 10;
  }

  if (item.raw_materials_text) {
    try {
      const parsed = JSON.parse(item.raw_materials_text);
      if (parsed && typeof parsed === 'object') {
        const emdVal = parsed.depositDetails?.emd || '';
        const preBidDdg = parsed.depositDetails?.preBidDdg || '';

        let parsedPreBid = 0;
        const preBidClean = preBidDdg.replace(/,/g, '');
        const preBidMatch = preBidClean.match(/₹?\s*(\d+(\.\d+)?)/);
        if (preBidMatch) {
          parsedPreBid = parseFloat(preBidMatch[1]);
        }

        let emdPercent = 0.1;
        const emdMatch = emdVal.match(/([\d\.]+)\s*%/);
        if (emdMatch) {
          emdPercent = parseFloat(emdMatch[1]) / 100;
        }

        if (parsedPreBid > 100) {
          preBid = parsedPreBid;
          totalValue = (emdPercent > 0 && emdPercent <= 1) ? parsedPreBid / emdPercent : parsedPreBid * 10;
          isEstimated = false; // we have real data
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  return { preBid, totalValue, isEstimated };
}

export function expandQueryToTsQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
    
  if (tokens.length === 0) return '';
  
  const expandedTokens = tokens.map(token => {
    const synonyms = INVERTED_SYNONYM_MAP[token];
    if (synonyms && synonyms.length > 0) {
      const cleanSynonyms = synonyms
        .map(s => s.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean);
      return `(${[token, ...cleanSynonyms].join(' | ')})`;
    }
    const cleanToken = token.replace(/[^a-z0-9]/g, '');
    if (!cleanToken) return '';
    // Only use prefix matching wildcard for tokens with length >= 4 to avoid short word collisions (e.g., 'car' matching 'carton')
    return cleanToken.length >= 4 ? `${cleanToken}:*` : cleanToken;
  }).filter(Boolean);
  
  return expandedTokens.join(' & ');
}

const MSTC_OFFICE_MAP: Record<string, string> = {
  // Main/Regional MSTC Offices & Branches
  'BBR': 'Bhubaneswar',
  'BLR': 'Bengaluru',
  'BPL': 'Bhopal',
  'CDG': 'Chandigarh',
  'ERO': 'Eastern Regional Office (Kolkata)',
  'GHY': 'Guwahati',
  'HYD': 'Hyderabad',
  'JPR': 'Jaipur',
  'LKO': 'Lucknow',
  'NRO': 'Northern Regional Office (Delhi)',
  'SRO': 'Southern Regional Office (Chennai)',
  'WRO': 'Western Regional Office (Mumbai)',
  'TVC': 'Trivandrum Central',
  'VSP': 'Visakhapatnam',
  'VZG': 'Visakhapatnam (Vizag)',
  'PTN': 'Patna',
  'VAD': 'Vadodara',
  'CO': 'Corporate Office',
  'KOC': 'Kochi',
  'VIZ': 'Vizag',
  'RNC': 'Ranchi',
  'RPR': 'Raipur',
  'DDN': 'Dehradun',
  'VZ': 'Visakhapatnam (Vizag)',

  // Extended Potential Office & City Codes (IATA / Common Abbreviations)
  'AMD': 'Ahmedabad',
  'PNE': 'Pune',
  'PNQ': 'Pune',
  'NGP': 'Nagpur',
  'NAG': 'Nagpur',
  'GOA': 'Goa',
  'JMU': 'Jammu',
  'SXR': 'Srinagar',
  'SGR': 'Srinagar',
  'SML': 'Shimla',
  'IMF': 'Imphal',
  'SHL': 'Shillong',
  'ITR': 'Itanagar',
  'KOH': 'Kohima',
  'AJL': 'Aizawl',
  'IXA': 'Agartala',
  'GTK': 'Gangtok',
  'IXZ': 'Port Blair',
  'JBP': 'Jabalpur',
  'IDR': 'Indore',
  'GWL': 'Gwalior',
  'KNP': 'Kanpur',
  'ALD': 'Prayagraj (Allahabad)',
  'VNS': 'Varanasi',
  'AGR': 'Agra',
  'MRT': 'Meerut',
  'GZB': 'Ghaziabad',
  'NDA': 'Noida',
  'FDB': 'Faridabad',
  'GGN': 'Gurugram (Gurgaon)',
  'LDH': 'Ludhiana',
  'ATQ': 'Amritsar',
  'JAL': 'Jalandhar',
  'PTL': 'Patiala',
  'BUP': 'Bathinda',
  'SLD': 'Shimla',
  'SOL': 'Solan',
  'DHS': 'Dharamshala',
  'LEH': 'Leh',
  'JDQ': 'Jodhpur',
  'UDR': 'Udaipur',
  'KOT': 'Kota',
  'BKN': 'Bikaner',
  'AJM': 'Ajmer',
  'ALW': 'Alwar',
  'BHL': 'Bhilwara',
  'SIK': 'Sikar',
  'SRT': 'Surat',
  'RAJ': 'Rajkot',
  'BHV': 'Bhavnagar',
  'JGA': 'Jamnagar',
  'JND': 'Junagadh',
  'GDN': 'Gandhinagar',
  'AND': 'Anand',
  'NDD': 'Nadiad',
  'MSN': 'Mehsana',
  'BHQ': 'Bharuch',
  'VLD': 'Valsad',
  'VAP': 'Vapi',
  'MRB': 'Morbi',
  'BHJ': 'Bhuj',
  'GDM': 'Gandhidham',
  'PBD': 'Porbandar',
  'VRL': 'Veraval',
  'AML': 'Amreli',
  'SUN': 'Surendranagar',
  'PLP': 'Palanpur',
  'GDH': 'Godhra',
  'DHD': 'Dahod',
  'VYR': 'Vyara',
  'AHW': 'Ahwa',
  'SIL': 'Silvassa',
  'DAM': 'Daman',
  'DIU': 'Diu',
  'PNJ': 'Panaji',
  'MDG': 'Madgaon',
  'VDG': 'Vasco da Gama',
  'BOM': 'Mumbai',
  'MUM': 'Mumbai',
  'NVM': 'Navi Mumbai',
  'THN': 'Thane',
  'KLY': 'Kalyan',
  'DBL': 'Dombivli',
  'ULN': 'Ulhasnagar',
  'BWD': 'Bhiwandi',
  'MBA': 'Mira-Bhayandar',
  'VVR': 'Vasai-Virar',
  'PCW': 'Pimpri-Chinchwad',
  'ISK': 'Nashik',
  'NSK': 'Nashik',
  'IXU': 'Aurangabad',
  'AUB': 'Aurangabad',
  'SSL': 'Solapur',
  'SLP': 'Solapur',
  'AMR': 'Amravati',
  'AMV': 'Amravati',
  'NDC': 'Nanded',
  'NND': 'Nanded',
  'KHP': 'Kolhapur',
  'KLP': 'Kolhapur',
  'SGL': 'Sangli',
  'SNG': 'Sangli',
  'JLG': 'Jalgaon',
  'AKL': 'Akola',
  'AKO': 'Akola',
  'LTR': 'Latur',
  'DHL': 'Dhule',
  'ANG': 'Ahmednagar',
  'ANR': 'Ahmednagar',
  'CND': 'Chandrapur',
  'CHA': 'Chandrapur',
  'PRB': 'Parbhani',
  'ICH': 'Ichalkaranji',
  'JLN': 'Jalna',
  'AMB': 'Ambarnath',
  'BSL': 'Bhusawal',
  'PNV': 'Panvel',
  'RTN': 'Ratnagiri',
  'RTG': 'Ratnagiri',
  'SND': 'Sindhudurg',
  'SDU': 'Sindhudurg',
  'STR': 'Satara',
  'WRD': 'Wardha',
  'YVT': 'Yavatmal',
  'YAV': 'Yavatmal',
  'GND': 'Gondia',
  'GON': 'Gondia',
  'BHN': 'Bhandara',
  'GDC': 'Gadchiroli',
  'GAD': 'Gadchiroli',
  'HNG': 'Hingoli',
  'WSM': 'Washim',
  'BLD': 'Buldhana',
  'BUL': 'Buldhana',
  'NDB': 'Nandurbar',
  'RGD': 'Raigad',
  'ALB': 'Alibag',
  'BED': 'Beed',
  'OSM': 'Osmanabad',
  'MAA': 'Chennai',
  'CBI': 'Coimbatore',
  'CBE': 'Coimbatore',
  'CJB': 'Coimbatore',
  'IXM': 'Madurai',
  'MDU': 'Madurai',
  'TRZ': 'Trichy',
  'TRY': 'Trichy',
  'SXV': 'Salem',
  'SLM': 'Salem',
  'TUP': 'Tiruppur',
  'TPR': 'Tiruppur',
  'ERD': 'Erode',
  'VEL': 'Vellore',
  'TNY': 'Tirunelveli',
  'TNV': 'Tirunelveli',
  'TUT': 'Thoothukudi',
  'TTC': 'Thoothukudi',
  'NGL': 'Nagercoil',
  'TJV': 'Thanjavur',
  'DDL': 'Dindigul',
  'DGL': 'Dindigul',
  'RNP': 'Ranipet',
  'SVK': 'Sivakasi',
  'KRR': 'Karur',
  'UAM': 'Ooty (Udhagamandalam)',
  'KCP': 'Kanchipuram',
  'TVL': 'Tiruvallur',
  'CPT': 'Chengalpattu',
  'CUD': 'Cuddalore',
  'VPM': 'Villupuram',
  'KLC': 'Kallakurichi',
  'TVM': 'Tiruvannamalai',
  'TPTR': 'Tirupathur',
  'KGI': 'Krishnagiri',
  'DPI': 'Dharmapuri',
  'NMK': 'Namakkal',
  'NLG': 'Nilgiris',
  'PBL': 'Perambalur',
  'ALR': 'Ariyalur',
  'PDK': 'Pudukkottai',
  'TVR': 'Tiruvarur',
  'MYD': 'Mayiladuthurai',
  'TNI': 'Theni',
  'VDN': 'Virudhunagar',
  'SVG': 'Sivaganga',
  'RMD': 'Ramanathapuram',
  'TKS': 'Tenkasi',
  'KKM': 'Kanniyakumari',
  'PUD': 'Puducherry',
  'SBC': 'Bengaluru',
  'MYS': 'Mysore',
  'IXE': 'Mangaluru',
  'HBX': 'Hubballi-Dharwad',
  'IXG': 'Belagavi',
  'BGM': 'Belagavi',
  'GBG': 'Kalaburagi (Gulbarga)',
  'GLB': 'Kalaburagi (Gulbarga)',
  'DVG': 'Davanagere',
  'BYI': 'Ballari (Bellary)',
  'BLY': 'Ballari (Bellary)',
  'SMG': 'Shivamogga (Shimoga)',
  'TKR': 'Tumakuru (Tumkur)',
  'UDP': 'Udupi',
  'HSN': 'Hassan',
  'BDR': 'Bidar',
  'BJP': 'Vijayapura (Bijapur)',
  'RCR': 'Raichur',
  'RCH': 'Raichur',
  'BGK': 'Bagalkote',
  'KLR': 'Kolar',
  'MND': 'Mandya',
  'CRN': 'Chamarajanagar',
  'RMN': 'Ramanagara',
  'CBP': 'Chikkaballapur',
  'CTA': 'Chitradurga',
  'CKM': 'Chikmagalur',
  'DKN': 'Dakshina Kannada',
  'UKN': 'Uttara Kannada',
  'DWD': 'Dharwad',
  'GDG': 'Gadag',
  'HVR': 'Haveri',
  'YDG': 'Yadgir',
  'KPL': 'Koppal',
  'WGL': 'Warangal',
  'NZB': 'Nizamabad',
  'KMR': 'Karimnagar',
  'KHM': 'Khammam',
  'MBN': 'Mahabubnagar',
  'ADB': 'Adilabad',
  'MDK': 'Medak',
  'SRD': 'Sangareddy',
  'SDP': 'Siddipet',
  'KMD': 'Kamareddy',
  'BDN': 'Bodhan',
  'JGT': 'Jagtial',
  'MNCL': 'Mancherial',
  'KGD': 'Kothagudem',
  'SRP': 'Suryapet',
  'MRG': 'Miryalaguda',
  'WNP': 'Wanaparthy',
  'GDW': 'Gadwal',
  'NGK': 'Nagarkurnool',
  'VKB': 'Vikarabad',
  'TDR': 'Tandur',
  'BNG': 'Yadadri Bhuvanagiri',
  'JNG': 'Jangaon',
  'MHB': 'Mahabubabad',
  'BPP': 'Jayashankar Bhupalpally',
  'MLG': 'Mulugu',
  'NRM': 'Nirmal',
  'ASF': 'Kumuram Bheem Asifabad',
  'PDP': 'Peddapalli',
  'SRC': 'Rajanna Sircilla',
  'MDC': 'Medchal',
  'MKG': 'Malkajgiri',
  'RRD': 'Rangareddy',
  'VGA': 'Vijayawada',
  'VJW': 'Vijayawada',
  'GNT': 'Guntur',
  'NLR': 'Nellore',
  'KNL': 'Kurnool',
  'RJY': 'Rajahmundry',
  'KKI': 'Kakinada',
  'KKD': 'Kakinada',
  'TPT': 'Tirupati',
  'CDP': 'Kadapa',
  'ATP': 'Anantapur',
  'ELR': 'Eluru',
  'OGL': 'Ongole',
  'VZM': 'Vizianagaram',
  'VZN': 'Vizianagaram',
  'SKL': 'Srikakulam',
  'SKM': 'Srikakulam',
  'BMV': 'Bhimavaram',
  'BVM': 'Bhimavaram',
  'MPL': 'Madanapalle',
  'NDY': 'Nandyal',
  'TNL': 'Tenali',
  'PRD': 'Proddatur',
  'ADN': 'Adoni',
  'CTR': 'Chittoor',
  'MPT': 'Machilipatnam',
  'HDP': 'Hindupur',
  'GTL': 'Guntakal',
  'DVM': 'Dharmavaram',
  'TDP': 'Tadpatri',
  'KDR': 'Kadiri',
  'RCT': 'Rayachoty',
  'SKH': 'Srikalahasti',
  'GDR': 'Gudur',
  'KVL': 'Kavali',
  'SYK': 'Singarayakonda',
  'CRL': 'Chirala',
  'BPT': 'Bapatla',
  'NSP': 'Narasaraopet',
  'GDV': 'Gudivada',
  'TPG': 'Tadepalligudem',
  'TNK': 'Tanuku',
  'SMT': 'Samalkot',
  'AMP': 'Amalapuram',
  'TUN': 'Tuni',
  'AKP': 'Anakapalle',
  'PVP': 'Parvathipuram',
  'COK': 'Kochi',
  'CCJ': 'Kozhikode',
  'TCR': 'Thrissur',
  'QLN': 'Kollam',
  'ALP': 'Alappuzha',
  'PGD': 'Palakkad',
  'KTM': 'Kottayam',
  'MLP': 'Malappuram',
  'CNN': 'Kannur',
  'KSG': 'Kasaragod',
  'WYD': 'Wayanad',
  'IDK': 'Idukki',
  'PTA': 'Pathanamthitta',
  'EKM': 'Ernakulam',
  'TRV': 'Thiruvananthapuram',
  'BBI': 'Bhubaneswar',
  'CTC': 'Cuttack',
  'RKL': 'Rourkela',
  'SBP': 'Sambalpur',
  'PRI': 'Puri',
  'BLS': 'Balasore',
  'BDK': 'Bhadrak',
  'BPD': 'Baripada',
  'JSG': 'Jharsuguda',
  'BRG': 'Bargarh',
  'BLG': 'Balangir',
  'JYP': 'Jeypore',
  'KPT': 'Koraput',
  'BAM': 'Berhampur',
  'CAP': 'Chatrapur',
  'PLB': 'Phulbani',
  'NYG': 'Nayagarh',
  'KRD': 'Khordha',
  'JSP': 'Jagatsinghpur',
  'KDP': 'Kendrapara',
  'JJP': 'Jajpur',
  'DNK': 'Dhenkanal',
  'AGL': 'Angul',
  'TLC': 'Talcher',
  'KJR': 'Keonjhar',
  'BBL': 'Barbil',
  'SDG': 'Sundargarh',
  'DGH': 'Deogarh',
  'SNP': 'Sonepur',
  'NPD': 'Nuapada',
  'KLH': 'Kalahandi',
  'NBP': 'Nabarangpur',
  'BSP': 'Bilaspur',
  'DRG': 'Durg',
  'KRB': 'Korba',
  'RJN': 'Rajnandgaon',
  'JGD': 'Jagdalpur',
  'ABP': 'Ambikapur',
  'RGH': 'Raigarh',
  'DMT': 'Dhamtari',
  'BMT': 'Bemetara',
  'KBD': 'Kabirdham',
  'KWD': 'Kawardha',
  'JJG': 'Janjgir',
  'CMP': 'Champa',
  'SKT': 'Sakti',
  'KRY': 'Koriya',
  'SRJ': 'Surajpur',
  'KNK': 'Kanker',
  'KDG': 'Kondagaon',
  'NYP': 'Narayanpur',
  'DTW': 'Dantewada',
  'IXW': 'Jamshedpur',
  'JSR': 'Jamshedpur',
  'DBD': 'Dhanbad',
  'BKR': 'Bokaro',
  'HZB': 'Hazaribagh',
  'GRD': 'Giridih',
  'DGR': 'Deoghar',
  'DMK': 'Dumka',
  'SBG': 'Sahibganj',
  'PKR': 'Pakur',
  'GDD': 'Godda',
  'JMT': 'Jamtara',
  'LTH': 'Latehar',
  'PLM': 'Palamu',
  'DLT': 'Daltonganj',
  'GRW': 'Garhwa',
  'GML': 'Gumla',
  'LHD': 'Lohardaga',
  'SMD': 'Simdega',
  'KNT': 'Khunti',
  'RMG': 'Ramgarh',
  'PAT': 'Patna',
  'GAY': 'Gaya',
  'BGP': 'Bhagalpur',
  'MFP': 'Muzaffarpur',
  'DBG': 'Darbhanga',
  'PRN': 'Purnia',
  'ARA': 'Arrah',
  'BGS': 'Begusarai',
  'MNG': 'Munger',
  'SHS': 'Saharsa',
  'BET': 'Bettiah',
  'MOT': 'Motihari',
  'HJP': 'Hajipur',
  'SSR': 'Sasaram',
  'DHR': 'Dehri',
  'BXR': 'Buxar',
  'SWN': 'Siwan',
  'GPL': 'Gopalganj',
  'CPR': 'Chapra',
  'STM': 'Sitamarhi',
  'MDB': 'Madhubani',
  'SMS': 'Samastipur',
  'LKS': 'Lakhisarai',
  'SKP': 'Sheikhpura',
  'JMI': 'Jamui',
  'NLD': 'Nalanda',
  'BHS': 'Biharsharif',
  'NWD': 'Nawada',
  'JHB': 'Jehanabad',
  'ARW': 'Arwal',
  'ECM': 'East Champaran',
  'WCM': 'West Champaran',
  'SHR': 'Sheohar',
  'BNK': 'Banka',
  'SPL': 'Supaul',
  'ARR': 'Araria',
  'HW': 'Haridwar',
  'RKE': 'Roorkee',
  'RSK': 'Rishikesh',
  'HLD': 'Haldwani',
  'KGM': 'Kathgodam',
  'NTL': 'Nainital',
  'RDP': 'Rudrapur',
  'KSP': 'Kashipur',
  'PGT': 'Pantnagar',
  'PTH': 'Pithoragarh',
  'ALM': 'Almora',
  'BAG': 'Bageshwar',
  'CHM': 'Chamoli',
  'GPS': 'Gopeshwar',
  'UTK': 'Uttarkashi',
  'THR': 'Tehri',
  'KTD': 'Kotdwar',
  'RPT': 'Rudraprayag',
  'USN': 'Udham Singh Nagar'
};

export const expandMstcOffice = (officeCode: string): string => {
  if (!officeCode) return officeCode;
  const upper = officeCode.toUpperCase().trim();
  return MSTC_OFFICE_MAP[upper] || officeCode;
};

export function mapRawCategory(rawName: string): { category: string; subcategory: string } {
  if (!rawName) {
    return { category: 'Miscellaneous', subcategory: 'Others' };
  }

  // If it already has the clean pattern "Category | Subcategory", preserve it
  if (rawName.includes(' | ')) {
    const parts = rawName.split(' | ');
    return {
      category: parts[0].trim(),
      subcategory: parts[1]?.trim() || 'Others'
    };
  }

  const lower = rawName.toLowerCase();

  // 1. Metal
  if (
    lower.includes('metal') ||
    lower.includes('iron') ||
    lower.includes('steel') ||
    lower.includes('copper') ||
    lower.includes('brass') ||
    lower.includes('aluminium') ||
    lower.includes('lead') ||
    lower.includes('zinc') ||
    lower.includes('bronze') ||
    lower.includes('gold') ||
    lower.includes('silver') ||
    lower.includes('alloy') ||
    lower.includes('scrap')
  ) {
    let sub = 'Mixed metal scraps';
    if (lower.includes('iron') || lower.includes('steel')) sub = 'Iron and steel';
    else if (lower.includes('aluminium')) sub = 'Aluminium';
    else if (lower.includes('copper')) sub = 'Copper';
    else if (lower.includes('brass')) sub = 'Brass';
    return { category: 'Metal', subcategory: sub };
  }

  // 2. Transport Vehicles
  if (
    lower.includes('vehicle') ||
    lower.includes('car') ||
    lower.includes('truck') ||
    lower.includes('bus') ||
    lower.includes('auto') ||
    lower.includes('rickshaw') ||
    lower.includes('jeep') ||
    lower.includes('tractor') ||
    lower.includes('wheel') ||
    lower.includes('scooter') ||
    lower.includes('motorcycle') ||
    lower.includes('cycle') ||
    lower.includes('ship') ||
    lower.includes('vessel') ||
    lower.includes('boat') ||
    lower.includes('rail') ||
    lower.includes('wagon') ||
    lower.includes('locomotive')
  ) {
    let sub = 'Car';
    if (lower.includes('end of life') || lower.includes('elv')) sub = 'End of Life Vehicles';
    else if (lower.includes('ship') || lower.includes('vessel')) sub = 'Vessels/Ships';
    else if (lower.includes('special')) sub = 'Special Purpose Vehicle';
    return { category: 'Transport Vehicles', subcategory: sub };
  }

  // 3. Immovable Property
  if (
    lower.includes('building') ||
    lower.includes('land') ||
    lower.includes('plot') ||
    lower.includes('house') ||
    lower.includes('flat') ||
    lower.includes('property') ||
    lower.includes('residential') ||
    lower.includes('commercial') ||
    lower.includes('shed') ||
    lower.includes('godown') ||
    lower.includes('warehouse') ||
    lower.includes('office') ||
    lower.includes('shop') ||
    lower.includes('showroom') ||
    lower.includes('mall')
  ) {
    let sub = 'Plot/Land';
    if (lower.includes('residential') || lower.includes('house') || lower.includes('flat')) sub = 'Residential';
    else if (lower.includes('commercial') || lower.includes('shop') || lower.includes('office')) sub = 'Commercial';
    return { category: 'Immovable Property', subcategory: sub };
  }

  // 4. Electrical Items
  if (
    lower.includes('electrical') ||
    lower.includes('cable') ||
    lower.includes('wire') ||
    lower.includes('transformer') ||
    lower.includes('battery') ||
    lower.includes('ac ') ||
    lower.includes('air conditioner') ||
    lower.includes('generator') ||
    lower.includes('dg set') ||
    lower.includes('breaker') ||
    lower.includes('meter scrap') ||
    lower.includes('conductors')
  ) {
    let sub = 'Others';
    if (lower.includes('battery')) sub = 'Battery';
    else if (lower.includes('cable') || lower.includes('wire')) sub = 'Cables';
    else if (lower.includes('transformer')) sub = 'Transformer';
    else if (lower.includes('generator') || lower.includes('dg set')) sub = 'DG Sets / Generators';
    return { category: 'Electrical Items', subcategory: sub };
  }

  // 5. Electronics Items
  if (
    lower.includes('electronics') ||
    lower.includes('computer') ||
    lower.includes('laptop') ||
    lower.includes('mobile') ||
    lower.includes('phone') ||
    lower.includes('tablet') ||
    lower.includes('printer') ||
    lower.includes('peripheral') ||
    lower.includes('monitor') ||
    lower.includes('keyboard') ||
    lower.includes('mouse') ||
    lower.includes('server') ||
    lower.includes('compter')
  ) {
    return { category: 'Electronics Items', subcategory: 'Computers / Peripherals' };
  }

  // 6. Minerals
  if (
    lower.includes('mineral') ||
    lower.includes('ore') ||
    lower.includes('gypsum') ||
    lower.includes('stone') ||
    lower.includes('sand') ||
    lower.includes('gravel') ||
    lower.includes('manganese') ||
    lower.includes('ferro') ||
    lower.includes('block') ||
    lower.includes('coal') ||
    lower.includes('lignite') ||
    lower.includes('coke')
  ) {
    let sub = 'Minerals';
    if (lower.includes('coal')) sub = 'Coal';
    else if (lower.includes('sand')) sub = 'Sand block';
    return { category: 'Minerals', subcategory: sub };
  }

  // 7. Plant & Machinery
  if (
    lower.includes('machinery') ||
    lower.includes('machine') ||
    lower.includes('engine') ||
    lower.includes('compressor') ||
    lower.includes('pump') ||
    lower.includes('motor') ||
    lower.includes('turbine') ||
    lower.includes('boiler') ||
    lower.includes('furnace') ||
    lower.includes('crane') ||
    lower.includes('dismantling') ||
    lower.includes('plant')
  ) {
    let sub = 'Machinery items';
    if (lower.includes('engine')) sub = 'Engine Assemblies';
    else if (lower.includes('dismantling')) sub = 'Dismantling of buildings/plants';
    return { category: 'Plant/Machineries', subcategory: sub };
  }

  // 8. Forest Produce
  if (
    lower.includes('timber') ||
    lower.includes('wood') ||
    lower.includes('log') ||
    lower.includes('pole') ||
    lower.includes('billet') ||
    lower.includes('forest') ||
    lower.includes('bamboo') ||
    lower.includes('sandalwood')
  ) {
    return { category: 'Forest Produce', subcategory: 'Timber' };
  }

  // 9. Petroleum Products
  if (
    lower.includes('oil') ||
    lower.includes('petroleum') ||
    lower.includes('waste oil') ||
    lower.includes('lubricant') ||
    lower.includes('fuel')
  ) {
    return { category: 'Petroleum Products', subcategory: 'Used / waste oil' };
  }

  // 10. Container
  if (
    lower.includes('barrel') ||
    lower.includes('drum') ||
    lower.includes('can') ||
    lower.includes('tin') ||
    lower.includes('container')
  ) {
    return { category: 'Container', subcategory: 'Barrel/drum' };
  }

  // 11. Chemicals
  if (
    lower.includes('chemical') ||
    lower.includes('acid') ||
    lower.includes('solvent') ||
    lower.includes('paint') ||
    lower.includes('dye') ||
    lower.includes('pigment') ||
    lower.includes('catalyst') ||
    lower.includes('resin')
  ) {
    return { category: 'Chemicals', subcategory: 'Others' };
  }

  // 12. Agricultural Produce
  if (
    lower.includes('agricultural') ||
    lower.includes('paddy') ||
    lower.includes('wheat') ||
    lower.includes('rice') ||
    lower.includes('maize') ||
    lower.includes('barley') ||
    lower.includes('grain') ||
    lower.includes('pulse') ||
    lower.includes('cotton') ||
    lower.includes('seed') ||
    lower.includes('spice') ||
    lower.includes('cashew') ||
    lower.includes('coconut') ||
    lower.includes('arecanut')
  ) {
    return { category: 'Agricultural Produce', subcategory: 'Others' };
  }

  return { category: 'Miscellaneous', subcategory: 'Others' };
}

export const MstcSearchService = {
  /**
   * Client-side layman search fallback when Supabase RPC is not deployed.
   */
  async searchClientSide(
    query: string,
    filters?: { 
      category?: string; 
      categories?: string[];
      subcategory?: string; 
      subcategories?: string[];
      seller?: string; 
      sellers?: string[];
      location?: string; 
      locations?: string[];
      regionalOffice?: string;
      regionalOffices?: string[];
    }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        let queryBuilder = supabase
          .from('mstc_auctions')
          .select('*')
          .eq('asset_status', 'completed')
          .order('opening_date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (filters?.sellers && filters.sellers.length > 0) {
          queryBuilder = queryBuilder.in('seller_name', filters.sellers);
        } else if (filters?.seller) {
          queryBuilder = queryBuilder.eq('seller_name', filters.seller);
        }
        
        if (filters?.locations && filters.locations.length > 0) {
          queryBuilder = queryBuilder.in('location', filters.locations);
        } else if (filters?.location) {
          queryBuilder = queryBuilder.eq('location', filters.location);
        }

        if (filters?.regionalOffices && filters.regionalOffices.length > 0) {
          const orConditions = filters.regionalOffices.map(office => `mstc_auction_number.ilike.MSTC/${office}/%`).join(',');
          queryBuilder = queryBuilder.or(orConditions);
        } else if (filters?.regionalOffice) {
          queryBuilder = queryBuilder.ilike('mstc_auction_number', `MSTC/${filters.regionalOffice}/%`);
        }

        const { data, error } = await queryBuilder;

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      const data = allData;

      if (!data || data.length === 0) return [];

      // Map raw category names to clean Category | Subcategory structure
      let mapped = (data as MstcSanitizedAuction[]).map(item => {
        const { category, subcategory } = mapRawCategory(item.category_name);
        return {
          ...item,
          category_name: `${category} | ${subcategory}`
        };
      });

      // Filter by categories / subcategories arrays
      if (filters?.categories && filters.categories.length > 0) {
        const cats = filters.categories;
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          return cats.includes(parts[0]);
        });
      } else if (filters?.category) {
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          return parts[0] === filters.category;
        });
      }

      if (filters?.subcategories && filters.subcategories.length > 0) {
        const subcats = filters.subcategories;
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          return subcats.includes(parts[1]);
        });
      } else if (filters?.subcategory) {
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          return parts[1] === filters.subcategory;
        });
      }

      const allCompletedItems = [...mapped];

      const cleanedQuery = cleanQueryPriceTypos(query);

      if (!cleanedQuery) {
        return mapped;
      }

      // ── Extract price constraint
      const priceConstraint = parsePriceConstraint(cleanedQuery);
      let workingQuery = cleanQueryFromPriceConstraint(cleanedQuery);

      // ── HARD FILTER 1: Location ───────────────────────────────────────────
      // If user typed a location ("in Kerala", "at Mumbai", "UP" etc.),
      // ONLY items from that location are returned. No other results shown.
      const { canonical: locationCanonical, remainingQuery } = extractLocationFromQuery(workingQuery);
      workingQuery = remainingQuery;

      if (locationCanonical) {
        mapped = mapped.filter(item =>
          dbLocationMatchesCanonical(item.location || '', locationCanonical)
        );
        // Nothing matches → return empty instead of showing wrong-location results
        if (mapped.length === 0) return [];
      }

      // ── HARD FILTER 2: Subcategory precision ─────────────────────────────
      // If user typed "iron and steel", "computer", "fly ash" etc.,
      // ONLY that specific subcategory is returned.
      const precisionSubcategory = detectPrecisionSubcategory(workingQuery);
      if (precisionSubcategory) {
        mapped = mapped.filter(item => {
          const sub = (item.category_name || '').split(' | ')[1] || '';
          return matchSubcategory(sub, precisionSubcategory);
        });
        if (mapped.length === 0) return [];
      }

      // ── Tokenize remaining query terms
      const extractedTokensList = extractTokens(workingQuery);
      const rawTokens = filterCompoundComponents(extractedTokensList);

      if (rawTokens.length === 0) {
        // Apply price hard-filter if present, then return
        if (priceConstraint) {
          mapped = mapped.filter(item => {
            const { preBid, totalValue, isEstimated } = estimateAuctionValues(item);
            // If no real price data was found, exclude from price-filtered results
            if (isEstimated) return false;
            const matchValue = (val: number) => {
              if (val <= 0) return false;
              if (priceConstraint.operator === 'less') return val <= priceConstraint.value;
              if (priceConstraint.operator === 'greater') return val >= priceConstraint.value;
              return val === priceConstraint.value;
            };
            if (priceConstraint.field === 'pre_bid') return matchValue(preBid);
            if (priceConstraint.field === 'total_value') return matchValue(totalValue);
            return matchValue(preBid) || matchValue(totalValue);
          });
        }
        return mapped
          .sort((a, b) => new Date(b.opening_date).getTime() - new Date(a.opening_date).getTime());
      }

      // 1. Build Taxonomy dynamically from search data
      const { categoryKeywords, subcategoryKeywords } = buildTaxonomy(allCompletedItems);

      // 2. Pre-build the set of all known keywords for typo correction
      const knownKeywords = new Set<string>();
      Object.keys(categoryKeywords).forEach(k => knownKeywords.add(k));
      Object.keys(subcategoryKeywords).forEach(k => knownKeywords.add(k));
      Object.keys(INVERTED_SYNONYM_MAP).forEach(k => knownKeywords.add(k));

      // Fuzzy correct raw tokens using dynamic known keywords
      const normalizedTokens = rawTokens.map(token => {
        if (STOP_WORDS.has(token)) {
          return token;
        }
        const closest = findClosestKeyword(token, knownKeywords);
        return closest || token;
      });

      // Filter tokens into Substantive and Optional
      const substantiveTokens: string[] = [];
      const optionalTokens: string[] = [];

      for (const token of normalizedTokens) {
        if (STOP_WORDS.has(token)) {
          continue;
        }
        const isSubstantive =
          (token in categoryKeywords ||
           token in subcategoryKeywords ||
           token in INVERTED_SYNONYM_MAP) &&
          !GENERIC_KEYWORDS.has(token);

        if (isSubstantive) {
          substantiveTokens.push(token);
        } else {
          optionalTokens.push(token);
        }
      }

      // Determine scoped categories based on query tokens (intent classification)
      const targetCategories = new Set<string>();
      const categoryScores = new Map<string, number>();

      // Prioritize substantive tokens for category classification
      const classificationTokens = substantiveTokens.length > 0 ? substantiveTokens : optionalTokens;

      for (const token of classificationTokens) {
        // Check the token and all of its synonyms to map target categories
        const synonyms = [token, ...(INVERTED_SYNONYM_MAP[token] || [])];
        for (const term of synonyms) {
          // 1. Check Category Level Keywords
          const catLevel = categoryKeywords[term];
          if (catLevel) {
            catLevel.forEach(c => {
              categoryScores.set(c, (categoryScores.get(c) || 0) + 40);
            });
          }

          // 2. Check Subcategory Level Keywords
          const subcatLevel = subcategoryKeywords[term];
          if (subcatLevel) {
            subcatLevel.forEach(c => {
              categoryScores.set(c, (categoryScores.get(c) || 0) + 20);
            });
          }

          // 3. Exact Category Name match
          for (const catName of MAIN_CATEGORIES) {
            if (catName.toLowerCase().includes(term)) {
              categoryScores.set(catName, (categoryScores.get(catName) || 0) + 100);
            }
          }
        }
      }

      // If we got category scores, find the ones with significant signal
      if (categoryScores.size > 0) {
        let maxScore = 0;
        for (const score of categoryScores.values()) {
          if (score > maxScore) maxScore = score;
        }

        for (const [catName, score] of categoryScores.entries()) {
          if (score >= 15 && score >= maxScore * 0.5) {
            targetCategories.add(catName);
          }
        }
      }

      const scoredData = mapped.map(item => {
        let score = 0;
        const category = item.category_name || '';
        const seller = item.seller_name || '';
        const num = item.mstc_auction_number || '';
        const rawText = item.raw_materials_text || '';
        const locationLower = (item.location || '').toLowerCase();

        const parts = category.split(' | ');
        const mainCategory = parts[0].trim();
        const subcategory = parts[1]?.trim() || category;

        // Apply price constraint filtering if present
        if (priceConstraint) {
          const { preBid, totalValue, isEstimated } = estimateAuctionValues(item as any);
          if (isEstimated) return { item, score: 0 }; // no real price data — exclude
          const matchValue = (val: number) => {
            if (val <= 0) return false;
            if (priceConstraint.operator === 'less') return val <= priceConstraint.value;
            if (priceConstraint.operator === 'greater') return val >= priceConstraint.value;
            return val === priceConstraint.value;
          };
          const isMatch = priceConstraint.field === 'pre_bid'
            ? matchValue(preBid)
            : (priceConstraint.field === 'total_value'
                ? matchValue(totalValue)
                : (matchValue(preBid) || matchValue(totalValue)));
          if (!isMatch) {
            return { item, score: 0 };
          }
          // Item passed price filter — give it a guaranteed positive score
          // so it isn't accidentally excluded by the score > 0 gate below.
          score += 10;
        }

        // Scoping Check: If the search matches a distinct category intent, filter out all items from other categories
        if (targetCategories.size > 0) {
          if (!targetCategories.has(mainCategory)) {
            return { item, score: 0 };
          }
        }

        // A. Match Substantive Tokens strictly:
        let allSubstantiveMatched = true;

        for (const token of substantiveTokens) {
          let tokenMatched = false;

          // A1. Implicit Match for Category-Level Keywords:
          const inflections = getInflections(token);
          for (const inf of inflections) {
            const catLevel = categoryKeywords[inf];
            if (catLevel && catLevel.includes(mainCategory)) {
              score += 30; // Category level match bonus
              tokenMatched = true;
              break;
            }
          }

          // A2. Normal Text/Synonym Matching:
          if (!tokenMatched) {
            const terms = new Set<string>();
            for (const inf of inflections) {
              terms.add(inf);
              const synonyms = INVERTED_SYNONYM_MAP[inf];
              if (synonyms) {
                synonyms.forEach(s => terms.add(s));
              }
            }

            for (const term of terms) {
              if (matchWholeWord(subcategory, term)) {
                score += 15;
                tokenMatched = true;
                break;
              }
              if (matchWholeWord(seller, term) || matchWholeWord(num, term)) {
                score += 5;
                tokenMatched = true;
                break;
              }
              if (matchWholeWord(rawText, term)) {
                score += 3;
                tokenMatched = true;
                break;
              }
            }
          }

          if (!tokenMatched) {
            allSubstantiveMatched = false;
          }
        }

        // If substantive tokens were present and any of them failed to match, exclude this item
        if (substantiveTokens.length > 0 && !allSubstantiveMatched) {
          return { item, score: 0 };
        }

        // B. Match Optional Tokens for scoring boosts:
        for (const token of optionalTokens) {
          // Boost for matching location tag
          if (locationLower.includes(token)) {
            score += 100;
          }
          // Boost for matching in text
          if (
            matchWholeWord(subcategory, token) ||
            matchWholeWord(seller, token) ||
            matchWholeWord(num, token) ||
            matchWholeWord(rawText, token)
          ) {
            score += 15;
          }
        }

        // Boost if matches target category
        if (targetCategories.size > 0 && targetCategories.has(mainCategory)) {
          score += 50;
        }

        // If no substantive tokens matched (or none existed) and score is still 0, we can give a baseline score
        // to prevent filtering out items when there are no query terms left after stop words
        if (score === 0 && substantiveTokens.length === 0 && optionalTokens.length === 0) {
          score = 1;
        } else if (score === 0 && substantiveTokens.length === 0 && optionalTokens.length > 0) {
          // If query had only optional tokens and none matched, filter it out
          return { item, score: 0 };
        }

        return { item, score };
      });

      return scoredData
        .filter(d => d.score > 0)
        .sort((a, b) => b.score - a.score || new Date(b.item.opening_date).getTime() - new Date(a.item.opening_date).getTime())
        .map(d => d.item) as MstcSanitizedAuction[];

    } catch (error) {
      console.error('Client-side layman search failed:', error);
      return [];
    }
  },

  /**
   * High-speed catalog search engine filtering through clean, deduplicated snapshots with Layman's search
   */
  searchMarketplaceCatalog: PageCache.memoize(async function searchMarketplaceCatalog(
    query: string,
    filters?: { 
      category?: string; 
      categories?: string[];
      subcategory?: string; 
      subcategories?: string[];
      seller?: string; 
      sellers?: string[];
      location?: string; 
      locations?: string[];
      regionalOffice?: string;
      regionalOffices?: string[];
      hasImages?: boolean;
      hasAssetDocuments?: boolean;
      isReauction?: boolean;
      preBid?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ data: MstcSanitizedAuction[], count: number, correctedQuery?: string, hasDirectMatches?: boolean }> {
    try {
      const cleanedQuery = cleanQueryPriceTypos(query);
      const pConstraint = parsePriceConstraint(cleanedQuery);
      const workingQuery = cleanQueryFromPriceConstraint(cleanedQuery);

      // ── AUCTION NUMBER DIRECT LOOKUP ─────────────────────────────────────────
      // If the query looks like an auction number (e.g. "MSTC/ZG/POSTMASTER/1/...")
      // skip all NLP/embedding and do a direct ILIKE search on mstc_auction_number.
      // Heuristic: contains 2+ slashes, OR starts with "MSTC", OR has year pattern like 25-26, OR is a standalone Ref ID
      const slashCount = (query.match(/\//g) || []).length;
      const cleanQ = query.trim();
      const isExactRefId = /^\d{3,7}$/.test(cleanQ);
      const looksLikeAuctionNumber =
        slashCount >= 2 ||
        /^mstc/i.test(cleanQ) ||
        /\b\d{2}-\d{2}\b/.test(query) || // year range like 25-26
        isExactRefId;

      if (looksLikeAuctionNumber) {
        const page = filters?.page || 1;
        const limit = filters?.limit || 12;
        
        // For standalone IDs, prefix with a slash to avoid matching random middle numbers
        const searchPattern = isExactRefId ? `%/${cleanQ}%` : `%${cleanQ}%`;

        const { data: exactData, error: exactError, count: exactCount } = await supabase
          .from('mstc_auctions')
          .select('*', { count: 'exact' })
          .eq('asset_status', 'completed')
          .ilike('mstc_auction_number', searchPattern)
          .order('opening_date', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (!exactError && exactData && exactData.length > 0) {
          const mapped = exactData.map(item => {
            const { category, subcategory } = mapRawCategory(item.category_name);
            return { ...item, category_name: `${category} | ${subcategory}` } as MstcSanitizedAuction;
          });
          return { data: mapped, count: exactCount || mapped.length };
        }
        // If no match found for auction number, fall through to normal NLP search
      }

      let p_min_pre_bid: number | undefined = undefined;
      let p_max_pre_bid: number | undefined = undefined;

      if (pConstraint) {
        if (pConstraint.field === 'pre_bid' || pConstraint.field === 'either') {
          if (pConstraint.operator === 'greater') p_min_pre_bid = pConstraint.value;
          if (pConstraint.operator === 'less') p_max_pre_bid = pConstraint.value;
          if (pConstraint.operator === 'equal') {
            p_min_pre_bid = pConstraint.value;
            p_max_pre_bid = pConstraint.value;
          }
        }
      }

      // Explicit UI filter overrides NLP constraint
      if (filters?.preBid === 'yes') {
        p_min_pre_bid = 1;
        p_max_pre_bid = undefined;
      } else if (filters?.preBid === 'no') {
        p_min_pre_bid = undefined;
        p_max_pre_bid = 0;
      }
      
      let embeddingStr: string | null = null;
      if (workingQuery && workingQuery.length > 2) {
        try {
          const { embeddingService } = await import('./embeddingService');
          const vectorPromise = embeddingService.generateEmbedding(workingQuery);
          const timeoutPromise = new Promise<never>((_, reject) =>
            // 5s timeout — gives the model time to warm up in local dev
            setTimeout(() => reject(new Error('Embedding generation timeout')), 5000)
          );
          const vector = await Promise.race([vectorPromise, timeoutPromise]);
          embeddingStr = `[${vector.join(',')}]`;
        } catch (e) {
          console.warn('Failed to generate embedding:', e);
        }
      }

      const hasMultiSelectFilters = !!(
        (filters?.categories && filters.categories.length > 0) ||
        (filters?.subcategories && filters.subcategories.length > 0) ||
        (filters?.locations && filters.locations.length > 0) ||
        (filters?.sellers && filters.sellers.length > 0) ||
        (filters?.regionalOffices && filters.regionalOffices.length > 0)
      );
      const isSearchWithImageFilter = !!(
        filters?.hasImages || 
        filters?.hasAssetDocuments || 
        filters?.isReauction !== undefined ||
        (filters?.preBid === 'yes' || filters?.preBid === 'no') ||
        hasMultiSelectFilters
      );
      const rpcPage = isSearchWithImageFilter ? 1 : (filters?.page || 1);
      const rpcLimit = isSearchWithImageFilter ? 1000 : (filters?.limit || 12);

      // 1. Fetch data
      let searchData: any[] | null = null;
      let totalCount = 0;
      let returnedCorrectedQuery: string | undefined = undefined;
      let error: any = null;
      
      // If no query is provided, skip the AI/Hybrid search (which requires a >0 match score)
      // and directly fetch all completed auctions.
      if (!workingQuery || workingQuery.trim() === '') {
        let rawData: any[] = [];
        let count = 0;
        let qError: any = null;

        if (isSearchWithImageFilter) {
          let from = 0;
          const pageSize = 1000;
          while (true) {
            let queryBuilder = supabase
              .from('mstc_auctions')
              .select('*')
              .eq('asset_status', 'completed');

            if (filters?.categories && filters.categories.length > 0) {
              queryBuilder = queryBuilder.or(filters.categories.map(c => `category_name.like.${c}%`).join(','));
            } else if (filters?.category) {
              queryBuilder = queryBuilder.like('category_name', `${filters.category}%`);
            }

            if (filters?.subcategories && filters.subcategories.length > 0) {
              queryBuilder = queryBuilder.or(filters.subcategories.map(s => `category_name.like.%| ${s}`).join(','));
            } else if (filters?.subcategory) {
              queryBuilder = queryBuilder.like('category_name', `%| ${filters.subcategory}`);
            }

            if (filters?.locations && filters.locations.length > 0) {
              queryBuilder = queryBuilder.in('location', filters.locations);
            } else if (filters?.location) {
              queryBuilder = queryBuilder.eq('location', filters.location);
            }

            if (filters?.sellers && filters.sellers.length > 0) {
              queryBuilder = queryBuilder.in('seller_name', filters.sellers);
            } else if (filters?.seller) {
              queryBuilder = queryBuilder.eq('seller_name', filters.seller);
            }

            if (filters?.regionalOffices && filters.regionalOffices.length > 0) {
              queryBuilder = queryBuilder.or(filters.regionalOffices.map(o => `mstc_auction_number.ilike.MSTC/${o}/%`).join(','));
            } else if (filters?.regionalOffice) {
              queryBuilder = queryBuilder.ilike('mstc_auction_number', `MSTC/${filters.regionalOffice}/%`);
            }

            if (filters?.startDate) queryBuilder = queryBuilder.gte('opening_date', filters.startDate);
            if (filters?.endDate) queryBuilder = queryBuilder.lte('opening_date', filters.endDate);
            if (filters?.isReauction !== undefined) queryBuilder = queryBuilder.eq('is_reauction', filters.isReauction);

            const { data, error: err } = await queryBuilder
              .order('opening_date', { ascending: false })
              .range(from, from + pageSize - 1);

            if (err) {
              qError = err;
              break;
            }
            if (!data || data.length === 0) break;
            rawData = rawData.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
          }
          count = rawData.length;
        } else {
          let queryBuilder = supabase
              .from('mstc_auctions')
              .select('*', { count: 'exact' })
              .eq('asset_status', 'completed');

          if (filters?.categories && filters.categories.length > 0) {
            queryBuilder = queryBuilder.or(filters.categories.map(c => `category_name.like.${c}%`).join(','));
          } else if (filters?.category) {
            queryBuilder = queryBuilder.like('category_name', `${filters.category}%`);
          }

          if (filters?.subcategories && filters.subcategories.length > 0) {
            queryBuilder = queryBuilder.or(filters.subcategories.map(s => `category_name.like.%| ${s}`).join(','));
          } else if (filters?.subcategory) {
            queryBuilder = queryBuilder.like('category_name', `%| ${filters.subcategory}`);
          }

          if (filters?.locations && filters.locations.length > 0) {
            queryBuilder = queryBuilder.in('location', filters.locations);
          } else if (filters?.location) {
            queryBuilder = queryBuilder.eq('location', filters.location);
          }

          if (filters?.sellers && filters.sellers.length > 0) {
            queryBuilder = queryBuilder.in('seller_name', filters.sellers);
          } else if (filters?.seller) {
            queryBuilder = queryBuilder.eq('seller_name', filters.seller);
          }

          if (filters?.regionalOffices && filters.regionalOffices.length > 0) {
            queryBuilder = queryBuilder.or(filters.regionalOffices.map(o => `mstc_auction_number.ilike.MSTC/${o}/%`).join(','));
          } else if (filters?.regionalOffice) {
            queryBuilder = queryBuilder.ilike('mstc_auction_number', `MSTC/${filters.regionalOffice}/%`);
          }

          if (filters?.startDate) queryBuilder = queryBuilder.gte('opening_date', filters.startDate);
          if (filters?.endDate) queryBuilder = queryBuilder.lte('opening_date', filters.endDate);
          if (filters?.isReauction !== undefined) queryBuilder = queryBuilder.eq('is_reauction', filters.isReauction);

          const { data, error: err, count: totalCountVal } = await queryBuilder
            .order('opening_date', { ascending: false })
            .range((rpcPage - 1) * rpcLimit, rpcPage * rpcLimit - 1);

          rawData = data || [];
          count = totalCountVal || 0;
          qError = err;
        }

        searchData = rawData;
        totalCount = count;
        error = qError;
      } else {
        // Run Hybrid RPC
        const rpcResult = await supabase.rpc('hybrid_search_mstc_catalog', {
          p_search_query: workingQuery || null,
          p_embedding: embeddingStr as any,
          p_category_filter: isSearchWithImageFilter ? null : (filters?.categories?.[0] || filters?.category || null),
          p_subcategory_filter: isSearchWithImageFilter ? null : (filters?.subcategories?.[0] || filters?.subcategory || null),
          p_location_filter: isSearchWithImageFilter ? null : (filters?.locations?.[0] || filters?.location || null),
          p_seller_filter: isSearchWithImageFilter ? null : (filters?.sellers?.[0] || filters?.seller || null),
          p_start_date: filters?.startDate || null,
          p_end_date: filters?.endDate || null,
          p_has_images: null, // Bypass DB filter due to remote DB bug
          p_has_docs: null, // Bypass DB filter to handle strictly and cleanly client-side
          p_min_pre_bid: isSearchWithImageFilter ? null : (p_min_pre_bid || null),
          p_max_pre_bid: isSearchWithImageFilter ? null : (p_max_pre_bid || null),
          p_page: rpcPage,
          p_limit: rpcLimit
        });
        
        searchData = rpcResult.data;
        error = rpcResult.error;

        // If the DB text/vector search returned 0 results but there was a meaningful
        // query, ask the backend for a spell-check auto-correction!
        if (!searchData || searchData.length === 0) {
          const { data: correctedQuery, error: correctionError } = await supabase.rpc('suggest_search_correction', {
            p_query: workingQuery
          });

          if (!correctionError && correctedQuery && correctedQuery !== workingQuery) {
            console.log(`Auto-correcting search from "${workingQuery}" to "${correctedQuery}"`);
            const retryResult = await supabase.rpc('hybrid_search_mstc_catalog', {
              p_search_query: correctedQuery,
              p_embedding: embeddingStr as any,
              p_category_filter: isSearchWithImageFilter ? null : (filters?.categories?.[0] || filters?.category || null),
              p_subcategory_filter: isSearchWithImageFilter ? null : (filters?.subcategories?.[0] || filters?.subcategory || null),
              p_location_filter: isSearchWithImageFilter ? null : (filters?.locations?.[0] || filters?.location || null),
              p_seller_filter: isSearchWithImageFilter ? null : (filters?.sellers?.[0] || filters?.seller || null),
              p_start_date: filters?.startDate || null,
              p_end_date: filters?.endDate || null,
              p_has_images: null, // Bypass DB filter due to remote DB bug
              p_has_docs: null, // Bypass DB filter to handle strictly and cleanly client-side
              p_min_pre_bid: isSearchWithImageFilter ? null : (p_min_pre_bid || null),
              p_max_pre_bid: isSearchWithImageFilter ? null : (p_max_pre_bid || null),
              p_page: rpcPage,
              p_limit: rpcLimit
            });

            if (!retryResult.error && retryResult.data && retryResult.data.length > 0) {
              searchData = retryResult.data;
              returnedCorrectedQuery = correctedQuery;
              error = null;
            } else {
              throw new Error('RPC_ZERO_RESULTS');
            }
          } else {
            throw new Error('RPC_ZERO_RESULTS');
          }
        }
        
        if (searchData && searchData.length > 0) {
          totalCount = Number(searchData[0].total_count) || 0;
        }
      }

      if (error) {
        throw error;
      }

      const hasDirectMatches = !!(searchData && searchData.length > 0 && searchData[0].search_rank !== undefined);

      // Fetch is_reauction status for these items to ensure we have it in the UI and can filter by it
      const itemIds = (searchData as any[]).map(item => item.id);
      const { data: reauctionStatuses, error: statusError } = await supabase
        .from('mstc_auctions')
        .select('id, is_reauction')
        .in('id', itemIds);

      const reauctionMap = new Map<string, boolean>();
      if (!statusError && reauctionStatuses) {
        reauctionStatuses.forEach(r => reauctionMap.set(r.id, !!r.is_reauction));
      }

      // 2. Map Categories
      let mapped = (searchData as any[]).map(item => {
        const { category, subcategory } = mapRawCategory(item.category_name);
        return {
          ...item,
          is_reauction: reauctionMap.get(item.id) ?? false,
          category_name: `${category} | ${subcategory}`
        } as MstcSanitizedAuction;
      });

      // Filter by categories locally if specified
      if (filters?.categories && filters.categories.length > 0) {
        mapped = mapped.filter(item => {
          return filters.categories!.some(c => item.category_name.toLowerCase().startsWith(c.toLowerCase()));
        });
      } else if (filters?.category) {
        mapped = mapped.filter(item => {
          return item.category_name.toLowerCase().startsWith(filters.category!.toLowerCase());
        });
      }

      // Filter by subcategories locally if specified
      if (filters?.subcategories && filters.subcategories.length > 0) {
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          const sub = parts[1] || '';
          return filters.subcategories!.some(s => sub.toLowerCase() === s.toLowerCase());
        });
      } else if (filters?.subcategory) {
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          const sub = parts[1] || '';
          return sub.toLowerCase() === filters.subcategory!.toLowerCase();
        });
      }

      // Filter by locations locally if specified
      if (filters?.locations && filters.locations.length > 0) {
        mapped = mapped.filter(item => {
          return filters.locations!.some(loc => item.location && item.location.toLowerCase() === loc.toLowerCase());
        });
      } else if (filters?.location) {
        mapped = mapped.filter(item => {
          return item.location && item.location.toLowerCase() === filters.location!.toLowerCase();
        });
      }

      // Filter by sellers locally if specified
      if (filters?.sellers && filters.sellers.length > 0) {
        mapped = mapped.filter(item => {
          return filters.sellers!.some(sel => item.seller_name && item.seller_name.toLowerCase() === sel.toLowerCase());
        });
      } else if (filters?.seller) {
        mapped = mapped.filter(item => {
          return item.seller_name && item.seller_name.toLowerCase() === filters.seller!.toLowerCase();
        });
      }

      // Filter by regional offices locally if specified
      if (filters?.regionalOffices && filters.regionalOffices.length > 0) {
        mapped = mapped.filter(item => {
          if (!item.mstc_auction_number) return false;
          const parts = item.mstc_auction_number.split('/');
          if (parts.length > 1 && parts[0].toUpperCase() === 'MSTC') {
            const office = parts[1].trim();
            return filters.regionalOffices!.some(o => office.toLowerCase() === o.toLowerCase());
          }
          return false;
        });
      } else if (filters?.regionalOffice) {
        mapped = mapped.filter(item => {
          if (!item.mstc_auction_number) return false;
          const parts = item.mstc_auction_number.split('/');
          if (parts.length > 1 && parts[0].toUpperCase() === 'MSTC') {
            const office = parts[1].trim();
            return office.toLowerCase() === filters.regionalOffice!.toLowerCase();
          }
          return false;
        });
      }

      // Filter by isReauction locally if specified
      if (filters?.isReauction !== undefined) {
        mapped = mapped.filter(item => item.is_reauction === filters.isReauction);
      }

      // Filter by images locally if specified
      if (filters?.hasImages) {
        mapped = mapped.filter(item => {
          if (!item.raw_materials_text) return false;
          try {
            const parsed = JSON.parse(item.raw_materials_text);
            const images = parsed?.extracted_images || [];
            return images.some((url: string) => {
              const lower = url.toLowerCase();
              return !lower.endsWith('.pdf') && 
                     !lower.includes('_catalog_page_') && 
                     !lower.includes('mstc-previews/') &&
                     /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff?)$/i.test(lower);
            });
          } catch { return false; }
        });
      }
      
      // Filter by documents locally if specified
      if (filters?.hasAssetDocuments) {
        mapped = mapped.filter(item => hasConfirmedAssetDocuments(item.raw_materials_text));
      }

      // Filter by price constraint locally (since it requires JS computation)
      if (pConstraint) {
        mapped = mapped.filter(item => {
          const { preBid, totalValue } = estimateAuctionValues(item as any);
          const matchValue = (val: number) => {
            if (val <= 0) return true;
            if (pConstraint.operator === 'less') return val <= pConstraint.value;
            if (pConstraint.operator === 'greater') return val >= pConstraint.value;
            return val === pConstraint.value;
          };
          if (pConstraint.field === 'pre_bid') return matchValue(preBid);
          if (pConstraint.field === 'total_value') return matchValue(totalValue);
          return matchValue(preBid) || matchValue(totalValue);
        });
      }

      // Filter by preBid locally if specified
      if (filters?.preBid === 'yes') {
        mapped = mapped.filter(item => isPreBidRequired(item));
      } else if (filters?.preBid === 'no') {
        mapped = mapped.filter(item => !isPreBidRequired(item));
      }

      if (isSearchWithImageFilter) {
        totalCount = mapped.length;
        const page = filters?.page || 1;
        const limit = filters?.limit || 12;
        const startIndex = (page - 1) * limit;
        mapped = mapped.slice(startIndex, startIndex + limit);
      }

      return { data: mapped, count: totalCount, correctedQuery: returnedCorrectedQuery, hasDirectMatches };

    } catch (error) {
      console.warn('Hybrid search failed, falling back to client-side search:', error);
      let fallbackData = await MstcSearchService.searchClientSide(query, filters);
      
      // Filter by images/docs locally if RPC fails
      if (filters?.hasImages) {
        fallbackData = fallbackData.filter(item => {
          if (!item.raw_materials_text) return false;
          try {
            const parsed = JSON.parse(item.raw_materials_text);
            const images = parsed?.extracted_images || [];
            return images.some((url: string) => {
              const lower = url.toLowerCase();
              return !lower.endsWith('.pdf') && 
                     !lower.includes('_catalog_page_') && 
                     !lower.includes('mstc-previews/') &&
                     /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff?)$/i.test(lower);
            });
          } catch { return false; }
        });
      }
      
      if (filters?.hasAssetDocuments) {
        fallbackData = fallbackData.filter(item => hasConfirmedAssetDocuments(item.raw_materials_text));
      }

      const totalCount = fallbackData.length;
      
      // Client-side pagination fallback
      const page = filters?.page || 1;
      const limit = filters?.limit || 12;
      const startIndex = (page - 1) * limit;
      const paginatedData = fallbackData.slice(startIndex, startIndex + limit);

      return { data: paginatedData, count: totalCount, hasDirectMatches: fallbackData.length > 0 };
    }
  }, 'marketplaceSearch'),

  /**
   * Fetches a single MSTC auction by its UUID/ID, mapping raw categories appropriately.
   */
  getMstcAuctionById: PageCache.memoize(async function getMstcAuctionById(id: string): Promise<MstcSanitizedAuction | null> {
    try {
      const { data, error } = await supabase
        .from('mstc_auctions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const { category, subcategory } = mapRawCategory(data.category_name);
      return {
        ...data,
        category_name: `${category} | ${subcategory}`
      };
    } catch (error) {
      console.error('Failed to fetch MSTC auction by ID:', error);
      return null;
    }
  }, 'mstcAuctionById'),

  /**
   * Fetches unique filter options (State/Location, Category, Seller, Regional Office) from the database
   */
  getMstcFilterOptions: PageCache.memoize(async function getMstcFilterOptions(): Promise<{
    categories: string[];
    subcategories: Record<string, string[]>;
    sellers: string[];
    locations: string[];
    regionalOffices: string[];
  }> {
    try {
      let allData: any[] = [];
      let pageIndex = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('mstc_auctions')
          .select('category_name, seller_name, location, mstc_auction_number')
          .eq('asset_status', 'completed')
          .range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1);
          
        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData.push(...data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            pageIndex++;
          }
        }
      }

      const data = allData;
      
      const categories = new Set<string>();
      const subcategoriesMap: Record<string, Set<string>> = {};
      const sellers = new Set<string>();
      const locations = new Set<string>();
      const regionalOffices = new Set<string>();
      
      data?.forEach(row => {
        if (row.category_name) {
          const { category, subcategory } = mapRawCategory(row.category_name);
          categories.add(category);
          if (subcategory) {
            if (!subcategoriesMap[category]) {
              subcategoriesMap[category] = new Set<string>();
            }
            subcategoriesMap[category].add(subcategory);
          }
        }
        if (row.seller_name) sellers.add(row.seller_name);
        if (row.location) locations.add(row.location);
        
        if (row.mstc_auction_number) {
          const parts = row.mstc_auction_number.split('/');
          if (parts.length > 1 && parts[0].toUpperCase() === 'MSTC') {
            regionalOffices.add(parts[1].trim());
          }
        }
      });

      const subcategories: Record<string, string[]> = {};
      for (const [cat, subSet] of Object.entries(subcategoriesMap)) {
        subcategories[cat] = Array.from(subSet).sort();
      }

      const sortedOffices = Array.from(regionalOffices).sort((a, b) => {
        const nameA = expandMstcOffice(a);
        const nameB = expandMstcOffice(b);
        return nameA.localeCompare(nameB);
      });
      
      return {
        categories: Array.from(categories).sort(),
        subcategories,
        sellers: Array.from(sellers).sort(),
        locations: Array.from(locations).sort(),
        regionalOffices: sortedOffices
      };
    } catch (error) {
      console.error('Failed to fetch MSTC filter options:', error);
      return { categories: [], subcategories: {}, sellers: [], locations: [], regionalOffices: [] };
    }
  }, 'mstcFilterOptions'),

  /**
   * Fetches similar/related MSTC auctions.
   * If there is an active search query, it pulls candidates from the search results.
   * If there is no active search query, it falls back to category matching.
   * Results are ranked by category, seller, location, and item keywords.
   */
  getRelatedMstcAuctions: PageCache.memoize(async function getRelatedMstcAuctions(
    this: any,
    currentItem: MstcSanitizedAuction,
    searchQuery: string = '',
    limit: number = 4
  ): Promise<MstcSanitizedAuction[]> {
    try {
      let relatedItems: MstcSanitizedAuction[] = [];
      
      if (searchQuery) {
        // If there is an active search query, get matching items
        const results = await this.searchMarketplaceCatalog(searchQuery);
        relatedItems = results.data.filter((item: MstcSanitizedAuction) => item.id !== currentItem.id);
      } else {
        // If no search query, match by category/subcategory
        const categoryParts = (currentItem.category_name || '').split(' | ');
        const mainCategory = categoryParts[0]?.trim();
        const subcategory = categoryParts[1]?.trim();
        
        const results = await this.searchMarketplaceCatalog('', {
          category: mainCategory || undefined,
          subcategory: subcategory || undefined
        });
        
        relatedItems = results.data.filter((item: MstcSanitizedAuction) => item.id !== currentItem.id);
        
        // Relax subcategory if we have fewer items
        if (relatedItems.length < limit && mainCategory) {
          const mainResults = await this.searchMarketplaceCatalog('', {
            category: mainCategory || undefined
          });
          const extraItems = mainResults.data.filter(
            (item: MstcSanitizedAuction) => item.id !== currentItem.id && !relatedItems.some((r: MstcSanitizedAuction) => r.id === item.id)
          );
          relatedItems = [...relatedItems, ...extraItems];
        }
      }
      
      // Compute similarity scores
      const currentKeywords = new Set<string>();
      if (currentItem.raw_materials_text) {
        try {
          const parsed = JSON.parse(currentItem.raw_materials_text);
          if (parsed && Array.isArray(parsed.items)) {
            parsed.items.forEach((row: any) => {
              const tokens = extractTokens(row.description || '');
              tokens.forEach(t => currentKeywords.add(t));
            });
          }
        } catch (e) {
          // ignore
        }
      }
      
      if (currentKeywords.size === 0 && currentItem.category_name) {
        extractTokens(currentItem.category_name).forEach(t => currentKeywords.add(t));
      }
      
      const currentCategoryParts = (currentItem.category_name || '').split(' | ');
      const currentMain = currentCategoryParts[0]?.trim() || '';
      const currentSub = currentCategoryParts[1]?.trim() || '';
      
      const scoredItems = relatedItems.map(item => {
        let score = 0;
        const parts = (item.category_name || '').split(' | ');
        const main = parts[0]?.trim() || '';
        const sub = parts[1]?.trim() || '';
        
        if (sub && sub === currentSub) score += 50;
        else if (main && main === currentMain) score += 20;
        
        if (item.seller_name === currentItem.seller_name) score += 30;
        if (item.location === currentItem.location) score += 20;
        
        if (currentKeywords.size > 0 && item.raw_materials_text) {
          try {
            const parsed = JSON.parse(item.raw_materials_text);
            if (parsed && Array.isArray(parsed.items)) {
              parsed.items.forEach((row: any) => {
                const desc = (row.description || '').toLowerCase();
                currentKeywords.forEach(keyword => {
                  if (matchWholeWord(desc, keyword)) {
                    score += 10;
                  }
                });
              });
            }
          } catch (e) {
            // ignore
          }
        }
        
        return { item, score };
      });
      
      scoredItems.sort(
        (a, b) => b.score - a.score || new Date(b.item.opening_date).getTime() - new Date(a.item.opening_date).getTime()
      );
      
      return scoredItems.map(si => si.item).slice(0, limit);
    } catch (error) {
      console.error('Error getting related MSTC auctions:', error);
      return [];
    }
  }, 'relatedMstcAuctions'),

  /**
   * Generates real-time, Gemini-like autocomplete suggestions based on categories, subcategories,
   * locations, and specific catalog item text matches.
   */
  getMstcSearchSuggestions: PageCache.memoize(async function getMstcSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
    try {
      const trimmedQuery = query.trim();
      const suggestions: SearchSuggestion[] = [];
      const seen = new Set<string>();

      const addSuggestion = (s: SearchSuggestion) => {
        const key = `${s.type}:${s.text.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push(s);
        }
      };

      if (!trimmedQuery) {
        // Return default popular queries
        const defaults = [
          { type: 'query', text: 'iron and steel', subtext: 'Metal' },
          { type: 'query', text: 'computers', subtext: 'Electronics' },
          { type: 'query', text: 'battery', subtext: 'Electrical' },
          { type: 'query', text: 'fly ash', subtext: 'Ash' },
          { type: 'location', text: 'Kerala', subtext: 'State' },
          { type: 'location', text: 'Uttar Pradesh', subtext: 'State' },
          { type: 'location', text: 'Maharashtra', subtext: 'State' },
        ];
        defaults.forEach(d => addSuggestion(d as SearchSuggestion));
        return suggestions;
      }

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

      const lowerCategory = categoryPart.toLowerCase();
      const lowerLocation = locationPart.toLowerCase();

      // Fetch actual matching completed auctions using category part
      const matchingAuctions = await MstcSearchService.searchClientSide(categoryPart);

      const matchedCategories = new Set<string>();
      const matchedSubcategories = new Set<string>();
      const matchedLocations = new Set<string>();

      // Extract unique categories, subcategories from matching results
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
      const isLocationMatch = (canonical: string, aliases: string[], queryStr: string): boolean => {
        const q = queryStr.trim().toLowerCase();
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

      if (locationPart.length > 0) {
        for (const [canonical, aliases] of Object.entries(INDIA_LOCATIONS)) {
          const canonicalDisplay = canonical.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (isLocationMatch(canonical, aliases, lowerLocation)) {
            matchedLocations.add(canonicalDisplay);
          }
        }
      } else if (lowerCategory.length > 0) {
        // Fallback matching locations from static INDIA_LOCATIONS map using lowerCategory
        for (const [canonical, aliases] of Object.entries(INDIA_LOCATIONS)) {
          const canonicalDisplay = canonical.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (isLocationMatch(canonical, aliases, lowerCategory)) {
            matchedLocations.add(canonicalDisplay);
          }
        }
      }

      // Fallback matching from static SUBCATEGORY_EXACT_MAP if no active DB items matched
      if (matchedSubcategories.size === 0 && lowerCategory.length > 0) {
        for (const item of SUBCATEGORY_EXACT_MAP) {
          if (item.phrase.startsWith(lowerCategory) || item.phrase.includes(lowerCategory)) {
            matchedSubcategories.add(item.subcategory);
          }
        }
      }

      // Fallback matching from static categories
      if (matchedCategories.size === 0 && lowerCategory.length > 0) {
        for (const cat of MAIN_CATEGORIES) {
          if (cat.toLowerCase().startsWith(lowerCategory) || cat.toLowerCase().includes(lowerCategory)) {
            matchedCategories.add(cat);
          }
        }
      }

      // 1. Add direct category, subcategory and location matches if locationPart is empty
      if (locationPart.length === 0) {
        matchedCategories.forEach(cat => {
          addSuggestion({
            type: 'category',
            text: cat,
            subtext: 'Category'
          });
        });

        matchedSubcategories.forEach(sub => {
          addSuggestion({
            type: 'subcategory',
            text: sub,
            subtext: 'Subcategory'
          });
        });

        matchedLocations.forEach(loc => {
          addSuggestion({
            type: 'location',
            text: `Auctions in ${loc}`,
            subtext: 'Location Search'
          });
        });
      }

      // 2. Suggest actual matching catalog/auction numbers (up to 4)
      if (matchingAuctions.length > 0 && locationPart.length === 0) {
        matchingAuctions
          .filter(item => item.mstc_auction_number.toLowerCase().includes(lowerCategory))
          .slice(0, 4)
          .forEach(item => {
            const subText = `${item.seller_name} | ${item.location}`;
            addSuggestion({
              type: 'auction',
              text: item.mstc_auction_number,
              subtext: subText
            });
          });
      }

      // 3. Generate Compound Suggestions
      const popularLocations = ['Uttar Pradesh', 'Kerala', 'Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu'];

      const locationsToUse = matchedLocations.size > 0 
        ? Array.from(matchedLocations) 
        : (locationPart.length === 0 ? popularLocations : []);

      const priceSuffix = priceConstraint 
        ? ` ${priceConstraint.operator === 'less' ? 'under' : (priceConstraint.operator === 'greater' ? 'above' : 'of')} ${priceConstraint.value >= 100000 ? (priceConstraint.value / 100000) + ' lakh' : priceConstraint.value}`
        : '';

      const itemsToCombine = matchedSubcategories.size > 0 
        ? Array.from(matchedSubcategories) 
        : Array.from(matchedCategories);

      itemsToCombine.forEach(item => {
        locationsToUse.forEach(loc => {
          addSuggestion({
            type: 'query',
            text: `${item.toLowerCase()} in ${loc}${priceSuffix}`,
            subtext: `Find ${item.toLowerCase()} in ${loc}`
          });
        });
      });

      // Final strict filter: make sure all returned suggestions contain lowerCategory and respect location constraints
      const filteredSuggestions = suggestions.filter(s => {
        const textLower = s.text.toLowerCase();
        
        if (s.type === 'category' || s.type === 'subcategory') {
          return textLower.includes(lowerCategory);
        }
        
        if (s.type === 'location') {
          let locName = textLower;
          if (locName.startsWith('auctions in ')) {
            locName = locName.replace('auctions in ', '');
          }
          if (locationPart.length > 0) {
            return isLocationMatch(locName, INDIA_LOCATIONS[locName.toLowerCase()] || [], lowerLocation);
          } else {
            return isLocationMatch(locName, INDIA_LOCATIONS[locName.toLowerCase()] || [], lowerCategory);
          }
        }
        
        if (s.type === 'auction') {
          return textLower.includes(lowerCategory);
        }
        
        if (s.type === 'query') {
          const hasCategory = textLower.includes(lowerCategory);
          if (!hasCategory) return false;
          
          if (locationPart.length > 0) {
            return Array.from(matchedLocations).some(loc => 
              textLower.includes(loc.toLowerCase())
            );
          }
          return true;
        }
        
        return false;
      });

      return filteredSuggestions.slice(0, 10);
    } catch (e) {
      console.error('Error generating search suggestions:', e);
      return [];
    }
  }, 'mstcSuggestions', { ttlMs: 60000 }),

  /**
   * Fetches verified, fully processed feeds for consultant analytics modules
   */
  fetchVerifiedConsultantFeed: PageCache.memoize(async function fetchVerifiedConsultantFeed(limitCount: number = 15): Promise<MstcSanitizedAuction[]> {
    try {
      const { data, error } = await supabase
          .from('mstc_auctions')
          .select('*')
          .eq('asset_status', 'completed') // Guarantees consultants only view rows with ready, uncorrupted local files
          .order('opening_date', { ascending: false })
          .limit(limitCount);

      if (error) throw error;
      return ((data as MstcSanitizedAuction[]) || []).map(item => {
        const { category, subcategory } = mapRawCategory(item.category_name);
        return {
          ...item,
          category_name: `${category} | ${subcategory}`
        };
      });
    } catch (error) {
      console.error('Failed processing analytics baseline query maps:', error);
      return [];
    }
  }, 'verifiedConsultantFeed')
};
