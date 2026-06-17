import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Re-implement the query expansion logic locally to test it without bundling
const SYNONYM_MAP: Record<string, string[]> = {
  boat: ['vessel', 'ship', 'barge', 'watercraft', 'hull', 'marine', 'craft', 'tug', 'boats'],
  boats: ['vessel', 'ship', 'barge', 'watercraft', 'hull', 'marine', 'craft', 'tug', 'boat'],
  ship: ['vessel', 'boat', 'barge', 'marine', 'vessels', 'ships', 'tug'],
  ships: ['vessel', 'boat', 'barge', 'marine', 'vessels', 'ship', 'tug'],
  vessel: ['ship', 'boat', 'barge', 'marine', 'vessels', 'ships'],
  vessels: ['ship', 'boat', 'barge', 'marine', 'vessel', 'ships'],
  engine: ['motor', 'propulsion', 'generator', 'machinery', 'genset', 'engines', 'motors'],
  engines: ['motor', 'propulsion', 'generator', 'machinery', 'genset', 'engine', 'motors'],
  motor: ['engine', 'propulsion', 'generator', 'machinery', 'genset', 'engines', 'motors'],
  motors: ['engine', 'propulsion', 'generator', 'machinery', 'genset', 'engines', 'motor'],
  anchor: ['chain', 'winch', 'windlass', 'mooring', 'tackle', 'anchors'],
  anchors: ['chain', 'winch', 'windlass', 'mooring', 'tackle', 'anchor'],
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
  truck: ['vehicle', 'car', 'bus', 'transport', 'wheel', 'axle', 'lorry', 'trucks'],
  trucks: ['vehicle', 'car', 'bus', 'transport', 'wheel', 'axle', 'lorry', 'truck'],
  wire: ['cable', 'conductor', 'winding', 'electrical', 'wires'],
  wires: ['cable', 'conductor', 'winding', 'electrical', 'wire'],
  cable: ['wire', 'conductor', 'winding', 'electrical', 'cables'],
  cables: ['wire', 'conductor', 'winding', 'electrical', 'cable'],
};

function expandQueryToTsQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
    
  if (tokens.length === 0) return '';
  
  const expandedTokens = tokens.map(token => {
    const synonyms = SYNONYM_MAP[token];
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

// Test cases
const testQueries = [
  'boat parts',
  'old ship engines',
  'anchor scrap',
  'rusted hull',
  'copper wire'
];

console.log('=== Layman Search Query Expansion Verification ===\n');

testQueries.forEach(q => {
  console.log(`Original User Query: "${q}"`);
  console.log(`Expanded TSQuery:    "${expandQueryToTsQuery(q)}"\n`);
});

// Database check fallback
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('NOTE: Database credentials missing. Skipping live database query checks.');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runLiveTests() {
  console.log('=== Live Database Layman Search Queries ===\n');
  for (const q of testQueries) {
    const formattedQuery = expandQueryToTsQuery(q);
    console.log(`Querying DB for: "${q}" -> formatted as: "${formattedQuery}"`);
    
    const { data, error } = await supabase.rpc('search_mstc_catalog_v2', {
      p_search_query: formattedQuery || null
    });
    
    if (error) {
      console.error(`  Error running RPC for "${q}":`, error.message);
    } else {
      console.log(`  Results returned: ${data?.length || 0}`);
      if (data && data.length > 0) {
        data.slice(0, 3).forEach((item: any, idx: number) => {
          console.log(`    [${idx + 1}] Rank: ${item.search_rank?.toFixed(4)} | Num: ${item.mstc_auction_number}`);
          console.log(`        Category: ${item.category_name} | Location: ${item.location}`);
          console.log(`        Seller: ${item.seller_name}`);
        });
      }
    }
    console.log('------------------------------------------------------------\n');
  }
}

runLiveTests().catch(console.error);
