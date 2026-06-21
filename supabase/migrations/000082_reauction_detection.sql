-- ============================================================================
-- Migration 00008: Re-auction Detection
-- Adds columns to track re-auctions and links to original parent auctions.
-- ============================================================================

ALTER TABLE public.mstc_auctions 
ADD COLUMN IF NOT EXISTS is_reauction BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_auction_number TEXT,
ADD COLUMN IF NOT EXISTS parent_auction_id UUID REFERENCES public.mstc_auctions(id) ON DELETE SET NULL;

-- Update the search function to include the new columns
DROP FUNCTION IF EXISTS search_mstc_catalog(TEXT, TEXT);
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
  status TEXT,
  is_reauction BOOLEAN,
  original_auction_number TEXT,
  parent_auction_id UUID
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
    m.asset_status AS status,
    m.is_reauction,
    m.original_auction_number,
    m.parent_auction_id
  FROM mstc_auctions m
  WHERE 
    (search_query = '' OR 
     m.mstc_auction_number ILIKE '%' || search_query || '%' OR 
     m.seller_name ILIKE '%' || search_query || '%' OR 
     m.raw_materials_text ILIKE '%' || search_query || '%')
    AND (category_filter IS NULL OR m.category_name = category_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
