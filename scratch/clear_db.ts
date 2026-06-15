import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const BUCKET_NAME = 'auction_documents';
const FOLDERS = ['mstc-catalogs', 'mstc-previews', 'mstc-extracted-images'];

async function deleteStorageFolderContents(folder: string) {
  let hasMore = true;
  let totalDeleted = 0;

  while (hasMore) {
    console.log(`Listing files in storage folder "${folder}" (Offset 0, total deleted so far: ${totalDeleted})...`);
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

    if (listError) {
      console.error(`Error listing folder "${folder}":`, listError.message);
      break;
    }

    if (!files || files.length === 0) {
      console.log(`No more files found in storage folder "${folder}".`);
      break;
    }

    const paths = files
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => `${folder}/${file.name}`);

    if (paths.length === 0) {
      console.log(`No actual files left in storage folder "${folder}".`);
      break;
    }

    console.log(`Deleting ${paths.length} files from storage folder "${folder}"...`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(paths);

    if (deleteError) {
      console.error(`Error executing delete batch in "${folder}":`, deleteError.message);
      break;
    }

    totalDeleted += paths.length;

    // If we listed fewer than 1000, we've reached the end of the folder
    if (files.length < 1000) {
      hasMore = false;
    }

    // Brief timeout to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`Finished clearing storage folder "${folder}". Total deleted: ${totalDeleted}\n`);
}

async function clearAll() {
  console.log('--- Wiping Supabase Storage Files (Paginated) ---');
  for (const folder of FOLDERS) {
    await deleteStorageFolderContents(folder);
  }

  console.log('--- Recreating Empty Folder Placeholders ---');
  for (const folder of FOLDERS) {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`${folder}/.emptyFolderPlaceholder`, Buffer.from(''), {
        contentType: 'text/plain',
        upsert: true
      });
    if (error) {
      console.error(`Failed to recreate empty folder "${folder}":`, error.message);
    } else {
      console.log(`Recreated folder "${folder}".`);
    }
  }

  console.log('\n--- Wiping Database Rows ---');
  console.log('Deleting all records from mstc_auctions...');
  const { error: dbError } = await supabase
    .from('mstc_auctions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (dbError) {
    console.error('Failed to clear database table:', dbError.message);
  } else {
    console.log('Successfully cleared all records from mstc_auctions.');
  }
}

export { clearAll };

// Run automatically if this is the main entry file
const isMain = process.argv[1] && (
  process.argv[1].endsWith('clear_db.ts') || 
  process.argv[1].endsWith('clear_db.js')
);

if (isMain) {
  clearAll();
}
