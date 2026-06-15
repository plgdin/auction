import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listCatalogs() {
  const { data: files, error } = await supabase.storage
    .from('auction_documents')
    .list('mstc-catalogs', { limit: 100 });
  
  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${files?.length || 0} catalogs:`);
  for (const f of files || []) {
    console.log(`- ${f.name} (${f.metadata?.size || 0} bytes)`);
  }
}

listCatalogs();
