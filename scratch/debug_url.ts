import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

dotenv.config({ path: path.resolve('.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path')
    .eq('asset_status', 'completed')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const record of data || []) {
    console.log('Auction Number:', record.mstc_auction_number);
    console.log('Sanitized Path:', record.sanitized_document_path);
    
    // Let's try downloading
    try {
      const res = await fetch(record.sanitized_document_path);
      console.log('Direct Fetch Status:', res.status);
    } catch (e: any) {
      console.log('Direct Fetch Error:', e.message);
    }

    try {
      const encoded = encodeURI(record.sanitized_document_path);
      console.log('Encoded Path:', encoded);
      const res = await fetch(encoded);
      console.log('Encoded Fetch Status:', res.status);
    } catch (e: any) {
      console.log('Encoded Fetch Error:', e.message);
    }

    try {
      // Let's see if we should download via Supabase storage client instead
      // Extract bucket name and path from the URL
      // Sanitized path is usually: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const url = new URL(record.sanitized_document_path);
      const parts = url.pathname.split('/storage/v1/object/public/');
      if (parts.length > 1) {
        const bucketAndPath = parts[1];
        const firstSlash = bucketAndPath.indexOf('/');
        const bucket = bucketAndPath.substring(0, firstSlash);
        const filePath = bucketAndPath.substring(firstSlash + 1);
        console.log(`Trying Supabase Storage client download. Bucket: ${bucket}, Path: ${filePath}`);
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(filePath);
          
        if (downloadError) {
          console.log('Supabase download error:', downloadError.message);
        } else {
          console.log('Supabase download success! Size:', fileData.size);
        }
      }
    } catch (e: any) {
      console.log('Supabase Download logic error:', e.message);
    }
    console.log('-----------------------------------');
  }
}

run();
