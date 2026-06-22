export const SYNONYM_MAP: Record<string, string[]> = {
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

// Build Inverted Synonym Map
export const INVERTED_SYNONYM_MAP: Record<string, string[]> = {};
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

export const CONCEPT_MAP: Record<string, string[]> = {
  chemistry: ['Chemicals'],
  chemical: ['Chemicals'],
  chemicals: ['Chemicals'],
  estate: ['Immovable Property'],
  metallurgy: ['Metal'],
};

export const STOP_WORDS = new Set([
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
  'mstc', 'price', 'range', 'lakh', 'lakhs', 'crore', 'crores', 'rs', 'rupees', 'value',
  'emd', 'bid', 'bids', 'biud', 'deposit', 'deposits', 'required', 'requireds'
]);

export const GENERIC_KEYWORDS = new Set([
  'parts', 'part', 'component', 'components', 'spare', 'spares',
  'equipment', 'equipments', 'scrap', 'scraps', 'salvage', 'waste',
  'condemned', 'unserviceable', 'fitting', 'fittings', 'accessory',
  'accessories', 'material', 'materials', 'item', 'items'
]);

export function getLevenshteinDistance(a: string, b: string): number {
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

export function getInflections(word: string): string[] {
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

export function extractTokens(text: string): string[] {
  if (!text) return [];
  const lowercase = text.toLowerCase();
  
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

export function findClosestKeyword(token: string, knownKeywords: Set<string>): string | null {
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

export function cleanQueryPriceTypos(query: string): string {
  if (!query) return '';
  let q = query.toLowerCase();

  // Unified EMD/Bid terms
  q = q.replace(/\bpre\s*biud\b/g, 'pre bid');
  q = q.replace(/\bpre-biud\b/g, 'pre-bid');
  q = q.replace(/\bbiud\b/g, 'bid');
  q = q.replace(/\bprebid\b/g, 'pre bid');
  q = q.replace(/\bpre-bid\b/g, 'pre bid');
  q = q.replace(/\brequried\b/g, 'required');

  // Operators swap if operator comes before the field, e.g. "under prebid of 25000" -> "prebid under 25000"
  q = q.replace(/\b(under|below|above|over|less\s+than|more\s+than)\s+(pre\s*bid|pre-bid|prebid|emd|deposit|price|value)\s*(?:of|is|at|\=)?\s*/g, '$2 $1 ');

  // Standardize double prepositions, e.g. "of under", "of below", "of less than" -> "under"
  q = q.replace(/\bof\s+(under|below|less\s+than)\b/g, 'under');
  q = q.replace(/\bof\s+(above|over|more\s+than)\b/g, 'above');

  // Unified Multipliers
  q = q.replace(/\blaksh\b/g, 'lakh');

  return q;
}

export interface PriceConstraint {
  field: 'total_value' | 'pre_bid' | 'either';
  operator: 'less' | 'greater' | 'equal';
  value: number;
}

export function parsePriceConstraint(query: string): PriceConstraint | null {
  const cleaned = cleanQueryPriceTypos(query);
  let q = cleaned.toLowerCase();
  
  // Replace mathematical operators with spaces around them
  q = q.replace(/<=/g, ' under ');
  q = q.replace(/>=/g, ' above ');
  q = q.replace(/</g, ' under ');
  q = q.replace(/>/g, ' above ');
  q = q.replace(/=/g, ' of ');

  // Regex to match a number followed by a multiplier (k, lakh, cr, etc.)
  const multiplierRegex = /(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|lac|laksh?|l|crores?|crs?|thousands?|k)\b/gi;
  
  let usedMultiplier = false;
  q = q.replace(multiplierRegex, (_match, numStr, mult) => {
    let val = parseFloat(numStr);
    const m = mult.toLowerCase();
    if (m.startsWith('lakh') || m.startsWith('lac') || m.startsWith('laks') || m.startsWith('laksh') || m === 'l') {
      val *= 100000;
      usedMultiplier = true;
    } else if (m.startsWith('crore') || m.startsWith('cr')) {
      val *= 10000000;
      usedMultiplier = true;
    } else if (m.startsWith('thousand') || m === 'k') {
      val *= 1000;
      usedMultiplier = true;
    }
    return val.toString();
  });

  const numMatch = q.match(/₹?\s*(\d+)/);
  if (!numMatch) return null;
  const value = parseInt(numMatch[1], 10);
  
  const hasPriceWord = /(pre\s*bid|pre-bid|emd|deposit|price|value)/i.test(q);
  const hasOpWord = /(under|below|less|above|over|more)/i.test(q);
  
  // If no explicit price/operator words and no multiplier/currency, ignore unless it's a very round large number
  if (!hasPriceWord && !hasOpWord && !usedMultiplier && !q.includes('₹')) {
    if (value < 10000 || value % 1000 !== 0) {
      return null;
    }
  }

  let field: 'pre_bid' | 'total_value' | 'either' = 'either';
  if (/(pre\s*bid|pre-bid|emd|deposit)/i.test(q)) {
    field = 'pre_bid';
  } else if (/(price|value)/i.test(q)) {
    field = 'total_value';
  } else if (value < 200000 && !cleaned.includes('lakh') && !cleaned.includes('lac') && !cleaned.includes('crore') && !cleaned.includes(' l') && !cleaned.includes(' cr')) {
    field = 'pre_bid'; // default small values to pre_bid
  }

  let operator: 'less' | 'greater' | 'equal' = 'equal';
  if (/(above|over|more)/i.test(q)) {
    operator = 'greater';
  } else if (/(below|under|less)/i.test(q)) {
    operator = 'less';
  } else if (usedMultiplier) {
    operator = 'less'; // fallback for queries like "cars 50k" -> "cars under 50k"
  }

  return { field, operator, value };
}

export function cleanQueryFromPriceConstraint(query: string): string {
  let result = cleanQueryPriceTypos(query);
  const constraint = parsePriceConstraint(query);
  
  if (constraint) {
    const numberPattern = /₹?\s*[\d\.,]+\s*(?:lakhs?|lacs?|lac|laksh?|l|crores?|crs?|thousands?|k)?\b/gi;
    result = result.replace(numberPattern, ' ');
    result = result.replace(/\b(under|below|less\s+than|less|above|over|more\s+than|more|equal\s+to|equal|is|of)\b/gi, ' ');
    result = result.replace(/\b(pre\s*bid|pre-bid|prebid|emd|deposit|price|value)\b/gi, ' ');
    result = result.replace(/[<>=]/g, ' ');
  }
  
  return result.replace(/\s+/g, ' ').trim();
}

export function filterCompoundComponents(tokens: string[]): string[] {
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

export const matchWholeWord = (text: string, term: string): boolean => {
  const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}(s|es)?\\b`, 'i');
  return regex.test(text);
};

export function buildTaxonomyFromCategories(categories: any[]): {
  categoryKeywords: Record<string, string[]>;
  subcategoryKeywords: Record<string, string[]>;
} {
  const categoryKeywords: Record<string, string[]> = {};
  const subcategoryKeywords: Record<string, string[]> = {};

  // Seed with CONCEPT_MAP
  for (const [conceptWord, catList] of Object.entries(CONCEPT_MAP)) {
    categoryKeywords[conceptWord] = [...catList];
  }

  const catMap = new Map(categories.map(c => [c.id, c]));

  for (const cat of categories) {
    if (!cat.name) continue;
    if (cat.parent_id) {
      // It's a subcategory
      const parent = catMap.get(cat.parent_id);
      const parentName = parent ? parent.name : '';
      
      const subTokens = extractTokens(cat.name);
      for (const token of subTokens) {
        if (!subcategoryKeywords[token]) {
          subcategoryKeywords[token] = [];
        }
        if (parentName && !subcategoryKeywords[token].includes(parentName)) {
          subcategoryKeywords[token].push(parentName);
        }
      }
    } else {
      // It's a main category
      const mainTokens = extractTokens(cat.name);
      for (const token of mainTokens) {
        if (!categoryKeywords[token]) {
          categoryKeywords[token] = [];
        }
        if (!categoryKeywords[token].includes(cat.name)) {
          categoryKeywords[token].push(cat.name);
        }
      }
    }
  }

  return { categoryKeywords, subcategoryKeywords };
}

