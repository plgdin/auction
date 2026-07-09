import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnhtcswiteuiggaipzvj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHRjc3dpdGV1aWdnYWlwenZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzUyMzEsImV4cCI6MjA5NjY1MTIzMX0.EGlVZLTE4Porq_xz5ZRwGb9PF_KrDT0NzElLKDSiKCY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in other DB mstc_auctions:', Object.keys(data[0]));
    const { count } = await supabase
      .from('mstc_auctions')
      .select('*', { count: 'exact', head: true });
    console.log('Total auctions in other DB:', count);
  } else {
    console.log('No records found in other DB.');
  }
}

run();
