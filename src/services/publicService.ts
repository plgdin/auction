import { supabase } from '../lib/supabase';
import type { ContactMessage, FaqItem, Announcement, NewsUpdate } from '../types/database.types';

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

  async getActiveFaqs(): Promise<FaqItem[]> {
    const { data, error } = await supabase
      .from('faq_items')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching FAQs:', error);
      return [];
    }
    return data;
  },

  async getActiveAnnouncements(limit: number = 5): Promise<Announcement[]> {
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
  },

  async getPublishedNews(limit: number = 10): Promise<NewsUpdate[]> {
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
}

const SYNONYM_MAP: Record<string, string[]> = {
  boat: ['boats', 'vessel', 'vessels', 'ship', 'ships', 'watercraft', 'craft', 'marine'],
  boats: ['boat', 'vessel', 'vessels', 'ship', 'ships', 'watercraft', 'craft', 'marine'],
  ship: ['ships', 'vessel', 'vessels', 'boat', 'boats', 'marine'],
  ships: ['ship', 'vessel', 'vessels', 'boat', 'boats', 'marine'],
  vessel: ['vessels', 'ship', 'ships', 'boat', 'boats', 'marine'],
  vessels: ['vessel', 'ship', 'ships', 'boat', 'boats', 'marine'],
  engine: ['engines', 'motor', 'motors'],
  engines: ['engine', 'motor', 'motors'],
  motor: ['motors', 'engine', 'engines'],
  motors: ['motor', 'engine', 'engines'],
  generator: ['generators', 'genset', 'gensets', 'dg set', 'dg sets', 'alternator'],
  generators: ['generator', 'genset', 'gensets', 'dg set', 'dg sets', 'alternator'],
  anchor: ['anchors', 'chain', 'mooring'],
  anchors: ['anchor', 'chain', 'mooring'],
  copper: ['non-ferrous', 'brass', 'bronze', 'cable', 'winding', 'wire'],
  aluminum: ['non-ferrous', 'alloy', 'cable', 'wire'],
  steel: ['ferrous', 'iron', 'plate', 'structure', 'pipe', 'channel', 'ms'],
  iron: ['ferrous', 'steel', 'scrap', 'metal'],
  parts: ['component', 'spare', 'equipment', 'fitting', 'accessory', 'spares', 'components', 'fittings', 'accessories', 'part'],
  part: ['component', 'spare', 'equipment', 'fitting', 'accessory', 'spares', 'components', 'fittings', 'accessories', 'parts'],
  hull: ['plate', 'steel', 'structure', 'vessel', 'deck', 'salvage', 'hulls'],
  hulls: ['plate', 'steel', 'structure', 'vessel', 'deck', 'salvage', 'hull'],
  salvage: ['scrap', 'decommissioned', 'unserviceable', 'condemned', 'waste'],
  scrap: ['salvage', 'unserviceable', 'condemned', 'waste', 'disposal'],
  car: ['cars', 'automobile', 'automobiles', 'vehicle', 'vehicles', 'four-wheeler', 'four-wheelers', 'bus', 'buses', 'truck', 'trucks', 'lorry', 'lorries', 'dumper', 'tipper'],
  cars: ['car', 'automobile', 'automobiles', 'vehicle', 'vehicles', 'four-wheeler', 'four-wheelers', 'bus', 'buses', 'truck', 'trucks', 'lorry', 'lorries', 'dumper', 'tipper'],
  bus: ['buses', 'omnibus', 'coach', 'coaches'],
  buses: ['bus', 'omnibus', 'coach', 'coaches'],
  truck: ['trucks', 'lorry', 'lorries', 'dumper', 'tipper'],
  trucks: ['truck', 'lorry', 'lorries', 'dumper', 'tipper'],
  wire: ['cable', 'conductor', 'winding', 'electrical', 'wires'],
  wires: ['cable', 'conductor', 'winding', 'electrical', 'wire'],
  cable: ['wire', 'conductor', 'winding', 'electrical', 'cables'],
  cables: ['wire', 'conductor', 'winding', 'electrical', 'cable'],
  'four-wheeler': ['four-wheelers', 'car', 'cars', 'automobile', 'automobiles'],
  'two-wheeler': ['two-wheelers', 'motorcycle', 'motorcycles', 'scooter', 'scooters', 'bike', 'bikes'],
};

// 1. Build an Inverted Synonym Map at startup
const INVERTED_SYNONYM_MAP: Record<string, string[]> = {};
for (const [key, synList] of Object.entries(SYNONYM_MAP)) {
  const allSyns = new Set<string>([key, ...synList]);
  allSyns.forEach(syn => {
    if (!INVERTED_SYNONYM_MAP[syn]) {
      INVERTED_SYNONYM_MAP[syn] = [];
    }
    allSyns.forEach(s => {
      if (!INVERTED_SYNONYM_MAP[syn].includes(s)) {
        INVERTED_SYNONYM_MAP[syn].push(s);
      }
    });
  });
}

const CONCEPT_MAP: Record<string, string[]> = {
  chemistry: ['Chemicals'],
  chemical: ['Chemicals'],
  chemicals: ['Chemicals'],
  estate: ['Immovable Property'],
  metallurgy: ['Metal'],
};

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

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what',
  'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did',
  'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
  'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
  'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 's', 't', 'can', 'will', 'just', 'should', 'now', 'need', 'wants',
  'want', 'show', 'me', 'find', 'get', 'search', 'buy', 'purchase', 'looking', 'look',
  'please', 'give', 'list', 'display', 'auctions', 'auction', 'scrap', 'scraps', 'government',
  'mstc', 'price', 'range', 'lakh', 'lakhs', 'crore', 'crores', 'rs', 'rupees', 'value'
]);

function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

const GENERIC_KEYWORDS = new Set([
  'parts', 'part', 'component', 'components', 'spare', 'spares',
  'equipment', 'equipments', 'scrap', 'scraps', 'salvage', 'waste',
  'condemned', 'unserviceable', 'fitting', 'fittings', 'accessory',
  'accessories', 'material', 'materials', 'item', 'items'
]);

function getInflections(word: string): string[] {
  const inflections = new Set<string>([word]);
  
  if (word.endsWith('ies')) {
    inflections.add(word.slice(0, -3) + 'y');
  } else if (word.endsWith('y')) {
    inflections.add(word.slice(0, -1) + 'ies');
  }
  
  if (word.endsWith('es')) {
    inflections.add(word.slice(0, -2));
    inflections.add(word.slice(0, -1));
  } else if (word.endsWith('s') && !word.endsWith('ss')) {
    inflections.add(word.slice(0, -1));
  } else {
    if (!word.endsWith('s')) {
      inflections.add(word + 's');
      if (/(s|sh|ch|x|z)$/i.test(word)) {
        inflections.add(word + 'es');
      }
    }
  }
  
  return Array.from(inflections).filter(w => w.length > 1);
}

function extractTokens(text: string): string[] {
  if (!text) return [];
  const lowercase = text.toLowerCase();
  
  // Split by spaces or hyphens to get individual words
  const words = lowercase
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .split(/[\s\-]+/)
    .filter(Boolean);
    
  const tokens = new Set<string>();
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    const inflections = getInflections(word);
    for (const inf of inflections) {
      if (!STOP_WORDS.has(inf)) {
        tokens.add(inf);
      }
    }
  }
  
  // Capture compound expressions
  const compounds = [
    { pattern: /two\s*wheelers?/g, token: 'two-wheeler' },
    { pattern: /four\s*wheelers?/g, token: 'four-wheeler' },
    { pattern: /three\s*wheelers?/g, token: 'three-wheeler' }
  ];
  
  for (const comp of compounds) {
    if (comp.pattern.test(lowercase)) {
      tokens.add(comp.token);
    }
  }
  
  return Array.from(tokens);
}

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

function findClosestKeyword(token: string, knownKeywords: Set<string>): string | null {
  let bestMatch: string | null = null;
  let minDistance = Infinity;

  for (const keyword of knownKeywords) {
    const dist = getLevenshteinDistance(token, keyword);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = keyword;
    }
  }

  if (bestMatch) {
    if (minDistance === 0) return bestMatch;
    // Allow 1 typo for words of length >= 3
    if (bestMatch.length >= 3 && minDistance <= 1) return bestMatch;
    // Allow 2 typos only for long words (length >= 7 and token length >= 7)
    if (bestMatch.length >= 7 && token.length >= 7 && minDistance <= 2) return bestMatch;
  }

  return null;
}

interface PriceConstraint {
  field: 'total_value' | 'pre_bid';
  operator: 'less' | 'greater' | 'equal';
  value: number;
}

function estimateAuctionValues(item: MstcSanitizedAuction): { preBid: number; totalValue: number } {
  let preBid = 50000; // default fallback
  let totalValue = 500000; // default fallback (preBid * 10)
  
  const shortId = item.mstc_auction_number.split('/').pop() || item.id.substring(0, 8);
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
        let emdVal = parsed.depositDetails?.emd || '';
        let preBidDdg = parsed.depositDetails?.preBidDdg || '';
        
        let parsedPreBid = 0;
        const preBidClean = preBidDdg.replace(/,/g, '');
        const preBidMatch = preBidClean.match(/₹?\s*(\d+(\.\d+)?)/);
        if (preBidMatch) {
          parsedPreBid = parseFloat(preBidMatch[1]);
        }
        
        let emdPercent = 0.1; // fallback is 10%
        const emdMatch = emdVal.match(/([\d\.]+)\s*%/);
        if (emdMatch) {
          emdPercent = parseFloat(emdMatch[1]) / 100;
        }
        
        if (parsedPreBid > 100) {
          preBid = parsedPreBid;
          if (emdPercent > 0 && emdPercent <= 1) {
            totalValue = parsedPreBid / emdPercent;
          } else {
            totalValue = parsedPreBid * 10;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return { preBid, totalValue };
}

function parsePriceConstraint(query: string): PriceConstraint | null {
  const normalizedQuery = query.toLowerCase();
  const pattern = /(?:(pre\s*bid|pre-bid|emd|deposit|price|value)\s+(?:(below|under|less\s+than|above|over|more\s+than|equal\s+to|is|of|\=)\s+)?)₹?\s*([\d\.,]+)\s*(lakh|lakhs|crore|crores|thousand|k)?|(?:(below|under|less\s+than|above|over|more\s+than|equal\s+to|is|of|\=)\s+)₹?\s*([\d\.,]+)\s*(lakh|lakhs|crore|crores|thousand|k)?/i;
  const match = normalizedQuery.match(pattern);
  if (!match) return null;
  
  let fieldWord = '';
  let opWord = '';
  let numStr = '';
  let multiplierWord = '';
  
  if (match[3] !== undefined) {
    fieldWord = match[1] ? match[1].toLowerCase().replace(/\s/g, '') : '';
    opWord = match[2] ? match[2].toLowerCase() : '';
    numStr = match[3].replace(/,/g, '');
    multiplierWord = match[4] ? match[4].toLowerCase() : '';
  } else {
    opWord = match[5] ? match[5].toLowerCase() : '';
    numStr = match[6].replace(/,/g, '');
    multiplierWord = match[7] ? match[7].toLowerCase() : '';
  }
  
  let value = parseFloat(numStr);
  if (isNaN(value)) return null;
  
  if (multiplierWord.startsWith('lakh')) {
    value *= 100000;
  } else if (multiplierWord.startsWith('crore')) {
    value *= 10000000;
  } else if (multiplierWord === 'thousand' || multiplierWord === 'k') {
    value *= 1000;
  }
  
  let field: 'total_value' | 'pre_bid' = 'total_value';
  if (fieldWord.includes('pre') || fieldWord.includes('emd') || fieldWord.includes('deposit')) {
    field = 'pre_bid';
  } else if (value < 200000 && !normalizedQuery.includes('lakh') && !normalizedQuery.includes('crore')) {
    field = 'pre_bid';
  }

  let operator: 'less' | 'greater' | 'equal' = 'equal';
  if (opWord.includes('below') || opWord.includes('under') || opWord.includes('less')) {
    operator = 'less';
  } else if (opWord.includes('above') || opWord.includes('over') || opWord.includes('more')) {
    operator = 'greater';
  }
  return { field, operator, value };
}

function cleanQueryFromPriceConstraint(query: string): string {
  const pattern = /(?:(pre\s*bid|pre-bid|emd|deposit|price|value)\s+(?:(below|under|less\s+than|above|over|more\s+than|equal\s+to|is|of|\=)\s+)?)₹?\s*([\d\.,]+)\s*(lakh|lakhs|crore|crores|thousand|k)?|(?:(below|under|less\s+than|above|over|more\s+than|equal\s+to|is|of|\=)\s+)₹?\s*([\d\.,]+)\s*(lakh|lakhs|crore|crores|thousand|k)?/gi;
  return query.replace(pattern, ' ').trim();
}

function filterCompoundComponents(tokens: string[]): string[] {
  const result = new Set<string>(tokens);
  
  if (result.has('four-wheeler')) {
    result.delete('four');
    result.delete('fours');
    result.delete('wheeler');
    result.delete('wheelers');
  }
  if (result.has('two-wheeler')) {
    result.delete('two');
    result.delete('twos');
    result.delete('wheeler');
    result.delete('wheelers');
  }
  if (result.has('three-wheeler')) {
    result.delete('three');
    result.delete('threes');
    result.delete('wheeler');
    result.delete('wheelers');
  }
  
  return Array.from(result);
}

function expandQueryToTsQuery(query: string): string {
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

export const MstcSearchService = {
  /**
   * Client-side layman search fallback when Supabase RPC is not deployed.
   */
  async searchClientSide(
    query: string,
    filters?: { category?: string; subcategory?: string; seller?: string; location?: string; startDate?: string; endDate?: string }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      let queryBuilder = supabase
        .from('mstc_auctions')
        .select('*')
        .eq('asset_status', 'completed');

      if (filters?.category && filters?.subcategory) {
        queryBuilder = queryBuilder.eq('category_name', `${filters.category} | ${filters.subcategory}`);
      } else if (filters?.category) {
        queryBuilder = queryBuilder.ilike('category_name', `${filters.category} | %`);
      }
      
      if (filters?.seller) {
        queryBuilder = queryBuilder.eq('seller_name', filters.seller);
      }
      
      if (filters?.location) {
        queryBuilder = queryBuilder.eq('location', filters.location);
      }

      if (filters?.startDate) {
        queryBuilder = queryBuilder.gte('opening_date', filters.startDate);
      }
      if (filters?.endDate) {
        queryBuilder = queryBuilder.lte('opening_date', filters.endDate);
      }

      // Fetch items to apply client-side filtering and sorting
      const { data, error } = await queryBuilder
        .order('opening_date', { ascending: false })
        .limit(1000);

      if (error) throw error;
      if (!data) return [];

      if (!query) {
        return data as MstcSanitizedAuction[];
      }

      // Extract price constraint and clean query first
      const priceConstraint = parsePriceConstraint(query);
      const cleanedQuery = cleanQueryFromPriceConstraint(query);

      // Tokenize and normalize query (including compound expressions)
      const extractedTokensList = extractTokens(cleanedQuery);
      const rawTokens = filterCompoundComponents(extractedTokensList);

      if (rawTokens.length === 0) {
        return data as MstcSanitizedAuction[];
      }

      // 1. Build Taxonomy dynamically from search data
      const { categoryKeywords, subcategoryKeywords } = buildTaxonomy(data as MstcSanitizedAuction[]);

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

      // Helper for whole-word boundary matching (allows basic English plurals like -s or -es)
      const matchWholeWord = (text: string, term: string): boolean => {
        const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}(s|es)?\\b`, 'i');
        return regex.test(text);
      };

      const scoredData = data.map(item => {
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
          const { preBid, totalValue } = estimateAuctionValues(item);
          const compareVal = priceConstraint.field === 'pre_bid' ? preBid : totalValue;
          if (compareVal > 0) {
            if (priceConstraint.operator === 'less' && compareVal > priceConstraint.value) {
              return { item, score: 0 };
            }
            if (priceConstraint.operator === 'greater' && compareVal < priceConstraint.value) {
              return { item, score: 0 };
            }
            if (priceConstraint.operator === 'equal' && compareVal !== priceConstraint.value) {
              return { item, score: 0 };
            }
          }
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
          const catLevel = categoryKeywords[token];
          if (catLevel && catLevel.includes(mainCategory)) {
            score += 30; // Category level match bonus
            tokenMatched = true;
          }

          // A2. Normal Text/Synonym Matching:
          if (!tokenMatched) {
            const synonyms = [token, ...(INVERTED_SYNONYM_MAP[token] || [])];
            for (const term of synonyms) {
              if (matchWholeWord(subcategory, term)) {
                score += 15;
                tokenMatched = true;
              }
              if (matchWholeWord(seller, term) || matchWholeWord(num, term)) {
                score += 5;
                tokenMatched = true;
              }
              if (matchWholeWord(rawText, term)) {
                score += 3;
                tokenMatched = true;
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
        .map(d => d.item)
        .slice(0, 200) as MstcSanitizedAuction[];
    } catch (error) {
      console.error('Client-side layman search failed:', error);
      return [];
    }
  },

  /**
   * High-speed catalog search engine filtering through clean, deduplicated snapshots with Layman's search
   */
  async searchMarketplaceCatalog(
    query: string,
    filters?: { category?: string; subcategory?: string; seller?: string; location?: string; startDate?: string; endDate?: string }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      const formattedQuery = query ? expandQueryToTsQuery(query) : '';

      const { data, error } = await supabase.rpc('search_mstc_catalog_v2', {
        p_search_query: formattedQuery || null,
        p_category_filter: filters?.category || null,
        p_subcategory_filter: filters?.subcategory || null,
        p_location_filter: filters?.location || null,
        p_seller_filter: filters?.seller || null,
        p_start_date: filters?.startDate || null,
        p_end_date: filters?.endDate || null
      });

      if (error) {
        // Handle RPC missing errors gracefully by falling back to client-side search
        if (error.code === 'P0001' || (error as any).status === 404 || error.message?.includes('does not exist')) {
          console.warn('RPC search_mstc_catalog_v2 not found in remote DB. Falling back to client-side search.');
          return MstcSearchService.searchClientSide(query, filters);
        }
        throw error;
      }
      return (data as MstcSanitizedAuction[]) || [];
    } catch (error) {
      console.warn('RPC search failed, falling back to client-side search:', error);
      return MstcSearchService.searchClientSide(query, filters);
    }
  },

  /**
   * Fetches unique filter options (State/Location, Category, Seller) from the database
   */
  async getMstcFilterOptions(): Promise<{
    categories: string[];
    subcategories: Record<string, string[]>;
    sellers: string[];
    locations: string[];
  }> {
    try {
      const { data, error } = await supabase
        .from('mstc_auctions')
        .select('category_name, seller_name, location')
        .eq('asset_status', 'completed'); // Match filter dropdown choices with visible completed catalogs
      
      if (error) throw error;
      
      const categories = new Set<string>();
      const subcategoriesMap: Record<string, Set<string>> = {};
      const sellers = new Set<string>();
      const locations = new Set<string>();
      
      data?.forEach(row => {
        if (row.category_name) {
          const parts = row.category_name.split(' | ');
          const cat = parts[0].trim();
          const sub = parts[1]?.trim();
          
          categories.add(cat);
          if (sub) {
            if (!subcategoriesMap[cat]) {
              subcategoriesMap[cat] = new Set<string>();
            }
            subcategoriesMap[cat].add(sub);
          }
        }
        if (row.seller_name) sellers.add(row.seller_name);
        if (row.location) locations.add(row.location);
      });

      const subcategories: Record<string, string[]> = {};
      for (const [cat, subSet] of Object.entries(subcategoriesMap)) {
        subcategories[cat] = Array.from(subSet).sort();
      }
      
      return {
        categories: Array.from(categories).sort(),
        subcategories,
        sellers: Array.from(sellers).sort(),
        locations: Array.from(locations).sort()
      };
    } catch (error) {
      console.error('Failed to fetch MSTC filter options:', error);
      return { categories: [], subcategories: {}, sellers: [], locations: [] };
    }
  },

  /**
   * Fetches verified, fully processed feeds for consultant analytics modules
   */
  async fetchVerifiedConsultantFeed(limitCount: number = 15): Promise<MstcSanitizedAuction[]> {
    try {
      const { data, error } = await supabase
        .from('mstc_auctions')
        .select('*')
        .eq('asset_status', 'completed') // Guarantees consultants only view rows with ready, uncorrupted local files
        .order('opening_date', { ascending: false })
        .limit(limitCount);

      if (error) throw error;
      return (data as MstcSanitizedAuction[]) || [];
    } catch (error) {
      console.error('Failed processing analytics baseline query maps:', error);
      return [];
    }
  }
};
