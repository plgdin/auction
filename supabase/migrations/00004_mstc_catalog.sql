-- Migration to create the MSTC Auctions catalog table and search function
CREATE TABLE IF NOT EXISTS mstc_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mstc_auction_number TEXT UNIQUE NOT NULL,
    seller_name TEXT NOT NULL,
    category_name TEXT NOT NULL,
    location TEXT DEFAULT 'India',
    opening_date TIMESTAMPTZ NOT NULL,
    closing_date TIMESTAMPTZ NOT NULL,
    source_pdf_url TEXT NOT NULL,
    raw_materials_text TEXT,
    asset_status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    sanitized_document_path TEXT,
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE mstc_auctions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to completed/all records for consulting dashboards
CREATE POLICY "Allow public read access on MSTC auctions" ON mstc_auctions
    FOR SELECT USING (true);

-- Allow all operations for authenticated service roles or background workers
CREATE POLICY "Allow service role complete access" ON mstc_auctions
    FOR ALL USING (true);

-- Search Function (RPC) for MSTC Catalog
CREATE OR REPLACE FUNCTION search_mstc_catalog(search_query TEXT, category_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  mstc_auction_number TEXT,
  seller_name TEXT,
  category_name TEXT,
  location TEXT,
  opening_date TIMESTAMPTZ,
  closing_date TIMESTAMPTZ,
  sanitized_document_path TEXT,
  raw_materials_text TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.mstc_auction_number,
    m.seller_name,
    m.category_name,
    m.location,
    m.opening_date,
    m.closing_date,
    m.sanitized_document_path,
    m.raw_materials_text,
    m.asset_status AS status
  FROM mstc_auctions m
  WHERE 
    (search_query = '' OR 
     m.mstc_auction_number ILIKE '%' || search_query || '%' OR 
     m.seller_name ILIKE '%' || search_query || '%' OR 
     m.raw_materials_text ILIKE '%' || search_query || '%')
    AND (category_filter IS NULL OR m.category_name = category_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
