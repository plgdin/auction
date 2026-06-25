import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnhtcswiteuiggaipzvj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHRjc3dpdGV1aWdnYWlwenZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzUyMzEsImV4cCI6MjA5NjY1MTIzMX0.EGlVZLTE4Porq_xz5ZRwGb9PF_KrDT0NzElLKDSiKCY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  const { data, error } = await supabase.rpc('hybrid_search_mstc_catalog', {
    p_search_query: null,
    p_embedding: null,
    p_category_filter: null,
    p_subcategory_filter: null,
    p_location_filter: null,
    p_seller_filter: null,
    p_start_date: null,
    p_end_date: null,
    p_has_images: null,
    p_has_docs: null,
    p_min_pre_bid: null,
    p_max_pre_bid: null,
    p_page: 1,
    p_limit: 12
  });
  console.log('RPC count:', data?.length);
  console.log('RPC error:', error);
}

testRpc();
