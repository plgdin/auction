import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnhtcswiteuiggaipzvj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHRjc3dpdGV1aWdnYWlwenZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzUyMzEsImV4cCI6MjA5NjY1MTIzMX0.EGlVZLTE4Porq_xz5ZRwGb9PF_KrDT0NzElLKDSiKCY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { renderAndExtractPdfPages } from './scraper/utils/pdfUtils.js';

async function run() {
  console.log('Querying auction 19651...');
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .like('mstc_auction_number', '%19651')
    .limit(1);

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  if (data && data.length > 0) {
    const record = data[0];
    console.log('Sanitized Document Path:', record.sanitized_document_path);

    // Download PDF from Supabase Storage using client
    let fileData;
    try {
      const url = new URL(record.sanitized_document_path);
      const parts = url.pathname.split("/storage/v1/object/public/");
      if (parts.length <= 1) {
        console.warn(`Invalid storage path format`);
        return;
      }
      const bucketAndPath = parts[1];
      const firstSlash = bucketAndPath.indexOf("/");
      const bucket = bucketAndPath.substring(0, firstSlash);
      const filePath = bucketAndPath.substring(firstSlash + 1);

      const { data: dData, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(filePath);

      if (downloadError) {
        console.warn(`Failed to download PDF: ${downloadError.message}`);
        return;
      }
      fileData = dData;
    } catch (e: any) {
      console.error(`Error initiating download:`, e.message);
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const pages = await renderAndExtractPdfPages(buffer, 5);
    const cleanText = pages.map((p, idx) => `--- PAGE ${idx + 1} ---\n${p.text}`).join("\n");
    
    console.log('--- RAW EXTRACTED TEXT FROM PDF ---');
    console.log(cleanText);
    console.log('-----------------------------------');
  } else {
    console.log('No records found for 19651.');
  }
}

run();
