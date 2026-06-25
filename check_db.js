import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnhtcswiteuiggaipzvj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHRjc3dpdGV1aWdnYWlwenZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzUyMzEsImV4cCI6MjA5NjY1MTIzMX0.EGlVZLTE4Porq_xz5ZRwGb9PF_KrDT0NzElLKDSiKCY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { count, error } = await supabase
    .from('mstc_auctions')
    .select('*', { count: 'exact', head: true })
    .eq('asset_status', 'completed');
    
  console.log('Total completed auctions:', count);
  console.log('Error:', error);

  const { count: allCount } = await supabase
    .from('mstc_auctions')
    .select('*', { count: 'exact', head: true });
    
  console.log('Total auctions (all statuses):', allCount);
}

checkDb();
