import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listFiles() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error(error);
    return;
  }

  for (const bucket of buckets || []) {
    console.log(`\n=================== Bucket: ${bucket.name} ===================`);
    const { data: files, error: filesError } = await supabase.storage
      .from(bucket.name)
      .list('', { limit: 100 });
    
    if (filesError) {
      console.error(filesError);
      continue;
    }
    
    for (const f of files || []) {
      console.log(`- ${f.name} (size: ${f.metadata?.size || 0} bytes)`);
      if (f.id === undefined) {
        // It's a folder, list subfiles
        const { data: subfiles } = await supabase.storage
          .from(bucket.name)
          .list(f.name, { limit: 100 });
        for (const sf of subfiles || []) {
          console.log(`  * ${f.name}/${sf.name} (size: ${sf.metadata?.size || 0} bytes)`);
        }
      }
    }
  }
}

listFiles();
