-- Migration to create the Layman's Search RPC function
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION search_mstc_catalog_v2(
  p_search_query TEXT,
  p_category_filter TEXT DEFAULT NULL,
  p_subcategory_filter TEXT DEFAULT NULL,
  p_location_filter TEXT DEFAULT NULL,
  p_seller_filter TEXT DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL
)
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
  search_rank REAL
) AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- Convert query to tsquery if provided, otherwise NULL
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    -- Expects query to be pre-formatted with & and | operators from TypeScript
    v_tsquery := to_tsquery('english', p_search_query);
  ELSE
    v_tsquery := NULL;
  END IF;

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
    CASE 
      WHEN v_tsquery IS NOT NULL THEN
        ts_rank_cd(
          setweight(to_tsvector('english', coalesce(m.category_name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(m.seller_name, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(m.mstc_auction_number, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(m.raw_materials_text, '')), 'C'),
          v_tsquery
        )
      ELSE 0.0
    END AS search_rank
  FROM mstc_auctions m
  WHERE 
    m.asset_status = 'completed'
    AND (
      v_tsquery IS NULL OR
      (
        setweight(to_tsvector('english', coalesce(m.category_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(m.seller_name, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(m.mstc_auction_number, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(m.raw_materials_text, '')), 'C')
      ) @@ v_tsquery
    )
    AND (p_category_filter IS NULL OR m.category_name = p_category_filter OR m.category_name LIKE p_category_filter || ' | %')
    AND (p_subcategory_filter IS NULL OR m.category_name LIKE '% | ' || p_subcategory_filter)
    AND (p_location_filter IS NULL OR m.location = p_location_filter)
    AND (p_seller_filter IS NULL OR m.seller_name = p_seller_filter)
    AND (p_start_date IS NULL OR m.opening_date >= p_start_date::TIMESTAMPTZ)
    AND (p_end_date IS NULL OR m.opening_date <= p_end_date::TIMESTAMPTZ)
  ORDER BY 
    CASE WHEN v_tsquery IS NOT NULL THEN 1 ELSE 0 END DESC,
    search_rank DESC,
    m.opening_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
