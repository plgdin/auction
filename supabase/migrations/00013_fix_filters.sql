-- Migration: Fix RPC Filters
-- 1. Updates hybrid_search_mstc_catalog to add p_is_reauction
-- 2. Fixes p_has_images and p_has_docs logic to properly parse JSON instead of failing on valid catalogs

-- 1. Drop the old hybrid search function since we are changing the signature
DROP FUNCTION IF EXISTS hybrid_search_mstc_catalog(text,vector,text[],text[],text[],text[],text[],text,text,boolean,boolean,numeric,numeric,integer,integer);

-- 2. Create the fixed Hybrid Search Function
CREATE OR REPLACE FUNCTION hybrid_search_mstc_catalog(
  p_search_query TEXT,
  p_embedding vector(384) DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_subcategories TEXT[] DEFAULT NULL,
  p_locations TEXT[] DEFAULT NULL,
  p_sellers TEXT[] DEFAULT NULL,
  p_regional_offices TEXT[] DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_has_images BOOLEAN DEFAULT NULL,
  p_has_docs BOOLEAN DEFAULT NULL,
  p_min_pre_bid NUMERIC DEFAULT NULL,
  p_max_pre_bid NUMERIC DEFAULT NULL,
  p_is_reauction BOOLEAN DEFAULT NULL,
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
  is_reauction BOOLEAN,
  search_rank REAL,
  semantic_similarity REAL,
  total_count BIGINT
) AS $$
DECLARE
  v_tsquery tsquery;
  v_rrf_k INT := 60; 
BEGIN
  IF p_search_query IS NOT NULL AND trim(p_search_query) != '' THEN
    v_tsquery := websearch_to_tsquery('english', p_search_query);
  ELSE
    v_tsquery := NULL;
  END IF;

  RETURN QUERY
  WITH filtered_candidates AS (
    SELECT
      m.id, m.mstc_auction_number, m.seller_name, m.category_name, m.location, 
      m.opening_date, m.closing_date, m.sanitized_document_path, m.raw_materials_text, m.asset_status, m.is_reauction,
      -- Text Rank
      CASE WHEN v_tsquery IS NOT NULL THEN
        ts_rank_cd(
          setweight(to_tsvector('english', coalesce(m.category_name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(m.mstc_auction_number, '')), 'A') ||
          setweight(to_tsvector('english', CASE WHEN m.is_reauction THEN 'reauction' ELSE '' END), 'A') ||
          setweight(to_tsvector('english', coalesce(m.seller_name, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(m.raw_materials_text, '')), 'C'),
          v_tsquery
        )
      ELSE 0.0 END AS t_rank,
      -- Vector Similarity
      CASE WHEN p_embedding IS NOT NULL AND m.embedding IS NOT NULL THEN
        1 - (m.embedding <=> p_embedding)
      ELSE 0.0 END AS v_sim
    FROM mstc_auctions m
    WHERE
      m.asset_status = 'completed'
      AND (
        (v_tsquery IS NULL AND p_embedding IS NULL) OR
        (
          v_tsquery IS NOT NULL AND
          (
            setweight(to_tsvector('english', coalesce(m.category_name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(m.mstc_auction_number, '')), 'A') ||
            setweight(to_tsvector('english', CASE WHEN m.is_reauction THEN 'reauction' ELSE '' END), 'A') ||
            setweight(to_tsvector('english', coalesce(m.seller_name, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(m.raw_materials_text, '')), 'C')
          ) @@ v_tsquery
        ) OR
        (
          p_embedding IS NOT NULL AND m.embedding IS NOT NULL AND
          (1 - (m.embedding <=> p_embedding)) > 0.1
        )
      )
      -- Apply Array Filters
      AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR split_part(m.category_name, ' | ', 1) = ANY(p_categories))
      AND (p_subcategories IS NULL OR array_length(p_subcategories, 1) IS NULL OR split_part(m.category_name, ' | ', 2) = ANY(p_subcategories))
      AND (p_locations IS NULL OR array_length(p_locations, 1) IS NULL OR m.location = ANY(p_locations))
      AND (p_sellers IS NULL OR array_length(p_sellers, 1) IS NULL OR m.seller_name = ANY(p_sellers))
      AND (
        p_regional_offices IS NULL OR array_length(p_regional_offices, 1) IS NULL OR 
        EXISTS (
          SELECT 1 FROM unnest(p_regional_offices) office 
          WHERE m.mstc_auction_number ILIKE 'MSTC/' || office || '/%'
        )
      )
      AND (p_start_date IS NULL OR m.opening_date >= p_start_date::TIMESTAMPTZ)
      AND (p_end_date IS NULL OR m.opening_date <= p_end_date::TIMESTAMPTZ)
      AND (p_is_reauction IS NULL OR m.is_reauction = p_is_reauction)
      AND (
        p_has_images IS NULL OR p_has_images = FALSE OR
        (
          m.raw_materials_text IS NOT NULL 
          AND m.raw_materials_text LIKE '%"extracted_images":%' 
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(
              CASE 
                WHEN m.raw_materials_text LIKE '{%}' AND m.raw_materials_text LIKE '%"extracted_images":%' 
                THEN (m.raw_materials_text::jsonb)->'extracted_images' 
                ELSE '[]'::jsonb 
              END
            ) AS img
            WHERE img NOT ILIKE '%.pdf' AND img NOT ILIKE '%_catalog_page_%' AND img NOT ILIKE '%mstc-previews/%'
          )
        )
      )
      AND (
        p_has_docs IS NULL OR p_has_docs = FALSE OR
        (
          m.sanitized_document_path IS NOT NULL OR 
          (
             m.raw_materials_text IS NOT NULL AND (
               m.raw_materials_text ILIKE '%.pdf%' OR
               m.raw_materials_text ILIKE '%"docs":%' OR
               m.raw_materials_text ILIKE '%"documents":%'
             )
          )
        )
      )
      -- Apply Price Constraints
      AND (
        p_min_pre_bid IS NULL OR 
        coalesce(extract_numeric_from_json(m.raw_materials_text, 'depositDetails', 'preBidDdg'), 0) >= p_min_pre_bid
      )
      AND (
        p_max_pre_bid IS NULL OR 
        coalesce(extract_numeric_from_json(m.raw_materials_text, 'depositDetails', 'preBidDdg'), 0) <= p_max_pre_bid
      )
  ),
  ranked_candidates AS (
    SELECT *,
      CASE WHEN t_rank > 0 THEN ROW_NUMBER() OVER (ORDER BY t_rank DESC) ELSE 100000 END AS text_rank_num,
      CASE WHEN v_sim > 0 THEN ROW_NUMBER() OVER (ORDER BY v_sim DESC) ELSE 100000 END AS vector_rank_num
    FROM filtered_candidates
  ),
  rrf_scored AS (
    SELECT *,
      (
        CASE WHEN text_rank_num < 100000 THEN 1.0 / (v_rrf_k + text_rank_num) ELSE 0.0 END +
        CASE WHEN vector_rank_num < 100000 THEN 1.0 / (v_rrf_k + vector_rank_num) ELSE 0.0 END
      ) AS rrf_score
    FROM ranked_candidates
  )
  SELECT
    r.id,
    r.mstc_auction_number::TEXT,
    r.seller_name::TEXT,
    r.category_name::TEXT,
    r.location::TEXT,
    r.opening_date,
    r.closing_date,
    r.sanitized_document_path::TEXT,
    r.raw_materials_text::TEXT,
    r.asset_status::TEXT AS status,
    r.is_reauction::BOOLEAN,
    r.t_rank::REAL AS search_rank,
    r.v_sim::REAL AS semantic_similarity,
    COUNT(*) OVER()::BIGINT AS total_count
  FROM rrf_scored r
  ORDER BY
    (CASE WHEN p_search_query IS NOT NULL AND r.mstc_auction_number ILIKE '%' || p_search_query || '%' THEN 1000.0 ELSE r.rrf_score END) DESC,
    r.opening_date DESC
  LIMIT p_limit
  OFFSET GREATEST(0, (p_page - 1) * p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
