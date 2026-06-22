-- Migration for Hybrid Search
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to mstc_auctions
ALTER TABLE mstc_auctions ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 3. Create index for fast vector searches
CREATE INDEX IF NOT EXISTS mstc_auctions_embedding_idx ON mstc_auctions USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION hybrid_search_mstc_catalog(
  p_search_query TEXT,
  p_embedding vector(384) DEFAULT NULL,
  p_category_filter TEXT DEFAULT NULL,
  p_subcategory_filter TEXT DEFAULT NULL,
  p_location_filter TEXT DEFAULT NULL,
  p_seller_filter TEXT DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_has_images BOOLEAN DEFAULT NULL,
  p_has_docs BOOLEAN DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_limit INT DEFAULT 12
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
  search_rank REAL,
  semantic_similarity REAL,
  total_count BIGINT
) AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    v_tsquery := to_tsquery('english', p_search_query);
  ELSE
    v_tsquery := NULL;
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.mstc_auction_number::TEXT,
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
    END AS search_rank,
    CASE 
      WHEN p_embedding IS NOT NULL AND m.embedding IS NOT NULL THEN
        1 - (m.embedding <=> p_embedding)
      ELSE 0.0
    END AS semantic_similarity,
    COUNT(*) OVER() AS total_count
  FROM mstc_auctions m
  WHERE 
    m.asset_status = 'completed'
    AND (
      (v_tsquery IS NULL AND p_embedding IS NULL) OR
      (
        v_tsquery IS NOT NULL AND 
        (
          setweight(to_tsvector('english', coalesce(m.category_name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(m.seller_name, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(m.mstc_auction_number, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(m.raw_materials_text, '')), 'C')
        ) @@ v_tsquery
      ) OR
      (
        p_embedding IS NOT NULL AND 
        m.embedding IS NOT NULL AND
        (1 - (m.embedding <=> p_embedding)) > 0.1
      )
    )
    AND (p_category_filter IS NULL OR m.category_name = p_category_filter OR m.category_name LIKE p_category_filter || ' | %')
    AND (p_subcategory_filter IS NULL OR m.category_name LIKE '% | ' || p_subcategory_filter)
    AND (p_location_filter IS NULL OR m.location = p_location_filter)
    AND (p_seller_filter IS NULL OR m.seller_name = p_seller_filter)
    AND (p_start_date IS NULL OR m.opening_date >= p_start_date::TIMESTAMPTZ)
    AND (p_end_date IS NULL OR m.opening_date <= p_end_date::TIMESTAMPTZ)
    AND (
      p_has_images IS NULL OR p_has_images = FALSE OR 
      (m.raw_materials_text ILIKE '%"extracted_images":%' AND m.raw_materials_text NOT ILIKE '%_catalog_page_%' AND m.raw_materials_text NOT ILIKE '%mstc-previews/%')
    )
    AND (
      p_has_docs IS NULL OR p_has_docs = FALSE OR
      (m.sanitized_document_path IS NOT NULL OR m.raw_materials_text ILIKE '%.pdf%')
    )
  ORDER BY 
    (
      CASE WHEN v_tsquery IS NOT NULL THEN
        ts_rank_cd(
          setweight(to_tsvector('english', coalesce(m.category_name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(m.seller_name, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(m.mstc_auction_number, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(m.raw_materials_text, '')), 'C'),
          v_tsquery
        ) * 1.5
      ELSE 0.0 END
      +
      CASE WHEN p_embedding IS NOT NULL AND m.embedding IS NOT NULL THEN
        (1 - (m.embedding <=> p_embedding)) * 1.0
      ELSE 0.0 END
    ) DESC,
    m.opening_date DESC
  LIMIT p_limit
  OFFSET GREATEST(0, (p_page - 1) * p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
