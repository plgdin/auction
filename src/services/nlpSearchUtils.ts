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
  'emd', 'bid', 'bids', 'biud', 'deposit', 'deposits', 'required', 'requireds',
  'amount', 'amounts', 'cost', 'costs', 'budget',
  'product', 'products', 'stuff', 'thing', 'things', 'item', 'items'
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

  // Domain specific normalizations
  q = q.replace(/\bcustom\b/g, 'customs');
  q = q.replace(/\bcfs\b/g, 'customs cfs');

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
    // Only remove the specific numbers that are part of the price constraint
    // For example, if constraint value is 50000, we should remove "50k", "50000", "50,000", "0.5 lakh"
    // To be safe and not over-engineer, we'll remove the common price keywords and operators,
    // and rely on regex to match currency patterns rather than all numbers.
    const priceNumberPattern = /₹?\s*\d[\d\.,]*\s*(?:lakhs?|lacs?|lac|laksh?|l|crores?|crs?|thousands?|k)\b/gi;
    result = result.replace(priceNumberPattern, ' ');

    // Also remove raw numbers preceded or followed by price keywords (emd, prebid, rs, etc)
    const rawPricePattern = /(?:pre\s*bid|pre-bid|prebid|emd|deposit|price|value|rs|rupees|amount|cost)\s*(?:of|is|at|\=)?\s*(?:under|below|less|above|over|more)?\s*₹?\s*([\d\.,]+)/gi;
    result = result.replace(rawPricePattern, ' ');

    result = result.replace(/\b(under|below|less\s+than|less|above|over|more\s+than|more|equal\s+to|equal|is|of)\b/gi, ' ');
    result = result.replace(/\b(pre\s*bid|pre-bid|prebid|emd|deposit|price|value|rs|rupees|amount|cost)\b/gi, ' ');
    result = result.replace(/[<>=]/g, ' ');
  }

  return result.replace(/\s+/g, ' ').trim();
}

export interface DateConstraint {
  startDate: string | null;
  endDate: string | null;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseDateConstraint(query: string): DateConstraint | null {
  let q = query.toLowerCase();
  q = q.replace(/auguest/g, 'august');

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (q.includes('today')) {
    startDate = new Date(now);
    endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 1);
  } else if (q.includes('tomorrow')) {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() + 1);
    endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 2);
  } else if (q.includes('this week')) {
    startDate = new Date(now);
    endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7 - endDate.getDay());
  } else if (q.includes('next week')) {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() + 7 - startDate.getDay());
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  } else if (q.includes('this month')) {
    startDate = new Date(currentYear, currentMonth, 1);
    endDate = new Date(currentYear, currentMonth + 1, 1);
  } else if (q.includes('next month')) {
    startDate = new Date(currentYear, currentMonth + 1, 1);
    endDate = new Date(currentYear, currentMonth + 2, 1);
  } else {
    const relMatch = q.match(/(in|within|next|after|from)\s+(\d+)\s+(day|days|week|weeks|month|months)/i);
    if (relMatch) {
      const prep = relMatch[1].toLowerCase();
      const num = parseInt(relMatch[2], 10);
      const unit = relMatch[3].toLowerCase();
      
      startDate = new Date(now);
      
      if (prep === 'after' || prep === 'from') {
        if (unit.startsWith('day')) startDate.setDate(startDate.getDate() + num);
        else if (unit.startsWith('week')) startDate.setDate(startDate.getDate() + num * 7);
        else if (unit.startsWith('month')) startDate.setMonth(startDate.getMonth() + num);
        endDate = null;
      } else {
        endDate = new Date(now);
        if (unit.startsWith('day')) endDate.setDate(endDate.getDate() + num);
        else if (unit.startsWith('week')) endDate.setDate(endDate.getDate() + num * 7);
        else if (unit.startsWith('month')) endDate.setMonth(endDate.getMonth() + num);
      }
    } else {
      const monthRegex = new RegExp(`\\b(${MONTHS.join('|')}|${MONTHS_SHORT.join('|')})\\b`, 'i');
      const dateRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\b/i;

      const hasMonth = q.match(monthRegex);
      if (hasMonth) {
        const monthStr = hasMonth[1].toLowerCase();
        let monthIdx = MONTHS.indexOf(monthStr);
        if (monthIdx === -1) monthIdx = MONTHS_SHORT.indexOf(monthStr);

        let targetYear = currentYear;
        if (monthIdx < currentMonth) targetYear++;

        const hasDate = q.match(dateRegex);
        if (hasDate) {
          const day = parseInt(hasDate[1], 10);
          startDate = new Date(targetYear, monthIdx, day);
          endDate = new Date(targetYear, monthIdx, day + 1);
        } else {
          startDate = new Date(targetYear, monthIdx, 1);
          endDate = new Date(targetYear, monthIdx + 1, 1);
        }
      }
    }
  }

  if (!startDate && !endDate) return null;

  return {
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
  };
}

export function cleanQueryFromDateConstraint(query: string): string {
  let result = query.toLowerCase();
  result = result.replace(/auguest/g, 'august');
  result = result.replace(/\b(today|tomorrow|this week|next week|this month|next month)\b/g, ' ');
  result = result.replace(/\b(in|within|next|after|from)\s+(\d+)\s+(day|days|week|weeks|month|months)\b/g, ' ');
  result = result.replace(/\b(happening|coming|closing|starting|ending)\b/g, ' ');
  result = result.replace(/\b(on)\b/g, ' ');

  const monthRegex = new RegExp(`\\b(${MONTHS.join('|')}|${MONTHS_SHORT.join('|')})\\b`, 'g');
  const dateRegex = /\b(\d{1,2})(st|nd|rd|th)?\b/g;

  if (result.match(monthRegex)) {
    result = result.replace(monthRegex, ' ');
    result = result.replace(dateRegex, ' ');
  }

  // Preserve original casing slightly better by returning what's left. (Lowercase is acceptable here).
  return result.replace(/\s+/g, ' ').trim();
}

export function removeStopWords(query: string): string {
  if (!query) return '';
  const tokens = query.split(/\s+/);
  const filtered = tokens.filter(t => {
    const clean = t.toLowerCase().replace(/[^a-z0-9\-]/g, '');
    if (!clean) return false;
    return !STOP_WORDS.has(clean);
  });
  return filtered.join(' ').trim();
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

