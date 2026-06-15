import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('raw_materials_text, source_pdf_url')
    .ilike('mstc_auction_number', '%13932%')
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  if (data && data.length > 0) {
    // Let's print any raw text we parsed from the document itself if stored.
    // Oh, wait! The raw text is not in a database column.
    // Let's download the PDF from source_pdf_url and parse its text using pdf-parse!
    const pdfUrl = data[0].source_pdf_url;
    console.log('PDF URL:', pdfUrl);
    
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(pdfUrl);
    const buffer = await res.buffer();
    
    const pdfParse = (await import('pdf-parse')).default;
    const parsed = await pdfParse(buffer);
    console.log('--- PDF TEXT ---');
    console.log(parsed.text.slice(0, 3000));
  }
}

run().catch(console.error);
