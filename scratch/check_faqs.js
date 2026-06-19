import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: faqs, error } = await supabase
    .from('faq_items')
    .select('id, question, category, display_order, is_active')
    .order('display_order', { ascending: true });
  if (error) {
    console.error("Error fetching faqs:", error);
  } else {
    console.log(`FAQs: ${JSON.stringify(faqs, null, 2)}`);
  }
}

check();
