-- Migration for Ultimate Hybrid Search
-- 1. Enable pgvector and pg_trgm extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add embedding column to mstc_auctions if it doesn't exist
ALTER TABLE mstc_auctions ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 3. Create index for fast vector searches
CREATE INDEX IF NOT EXISTS mstc_auctions_embedding_idx ON mstc_auctions USING hnsw (embedding vector_cosine_ops);

-- 4. Create Materialized View for "Did you mean?" typo correction
CREATE MATERIALIZED VIEW IF NOT EXISTS search_dictionary AS
SELECT word FROM ts_stat('SELECT to_tsvector(''simple'', coalesce(category_name, '''') || '' '' || coalesce(seller_name, '''') || '' '' || coalesce(raw_materials_text, '''')) FROM public.mstc_auctions');

CREATE INDEX IF NOT EXISTS trgm_idx_search_dictionary ON search_dictionary USING gin (word gin_trgm_ops);

-- Function to refresh the dictionary
CREATE OR REPLACE FUNCTION refresh_search_dictionary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_dictionary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create suggest_search_correction RPC
CREATE OR REPLACE FUNCTION suggest_search_correction(p_query TEXT)
RETURNS TEXT AS $$
DECLARE
  v_word TEXT;
  v_corrected_query TEXT := '';
  v_best_match TEXT;
BEGIN
  -- Very simple word-by-word correction for typo tolerance
  FOR v_word IN SELECT unnest(regexp_split_to_array(lower(p_query), '\s+'))
  LOOP
    -- Find closest word in dictionary using Trigram similarity
    SELECT word INTO v_best_match
    FROM search_dictionary
    ORDER BY word <-> v_word
    LIMIT 1;

    -- If distance is close enough (similarity > 0.4 usually means distance < 0.6)
    IF v_best_match IS NOT NULL AND (v_best_match <-> v_word) < 0.6 THEN
      v_corrected_query := v_corrected_query || ' ' || v_best_match;
    ELSE
      v_corrected_query := v_corrected_query || ' ' || v_word;
    END IF;
  END LOOP;
  
  RETURN trim(v_corrected_query);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Helper function to extract pre_bid safely from JSON
CREATE OR REPLACE FUNCTION extract_numeric_from_json(json_text TEXT, key1 TEXT, key2 TEXT)
RETURNS NUMERIC AS $$
DECLARE
  extracted_val TEXT;
BEGIN
  -- Safety check
  IF json_text IS NULL OR json_text = '' THEN RETURN NULL; END IF;
  
  BEGIN
    extracted_val := (json_text::jsonb -> key1 ->> key2);
    IF extracted_val IS NULL THEN RETURN NULL; END IF;
    -- Remove non-numeric chars except decimal
    extracted_val := regexp_replace(extracted_val, '[^0-9.]', '', 'g');
    RETURN NULLIF(extracted_val, '')::NUMERIC;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL; -- JSON parsing failed
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Drop existing search function (both old 12-param and new 14-param versions)
DROP FUNCTION IF EXISTS hybrid_search_mstc_catalog(text,vector,text,text,text,text,text,text,boolean,boolean,integer,integer);
DROP FUNCTION IF EXISTS hybrid_search_mstc_catalog(text,vector,text,text,text,text,text,text,boolean,boolean,numeric,numeric,integer,integer);

-- 8. Create the Ultimate Hybrid Search Function using Reciprocal Rank Fusion
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
  p_min_pre_bid NUMERIC DEFAULT NULL,
  p_max_pre_bid NUMERIC DEFAULT NULL,
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
  v_rrf_k INT := 60; -- Standard RRF constant
BEGIN
  -- Switch to websearch_to_tsquery for natural language parsing (supports "quotes" and -exclusions)
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
      -- Apply Price Constraints using our robust helper function
      AND (p_min_pre_bid IS NULL OR extract_numeric_from_json(m.raw_materials_text, 'depositDetails', 'preBidDdg') >= p_min_pre_bid)
      AND (p_max_pre_bid IS NULL OR extract_numeric_from_json(m.raw_materials_text, 'depositDetails', 'preBidDdg') <= p_max_pre_bid)
  ),
  ranked_candidates AS (
    SELECT *,
      -- Only assign row numbers if the rank is greater than 0, else push them to the bottom
      CASE WHEN t_rank > 0 THEN ROW_NUMBER() OVER (ORDER BY t_rank DESC) ELSE 100000 END AS text_rank_num,
      CASE WHEN v_sim > 0 THEN ROW_NUMBER() OVER (ORDER BY v_sim DESC) ELSE 100000 END AS vector_rank_num
    FROM filtered_candidates
  ),
  rrf_scored AS (
    SELECT *,
      -- Compute Reciprocal Rank Fusion Score
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
    -- If it's a direct ID match, force it to the top by cheating the order
    (CASE WHEN p_search_query IS NOT NULL AND r.mstc_auction_number ILIKE '%' || p_search_query || '%' THEN 1000.0 ELSE r.rrf_score END) DESC,
    r.opening_date DESC
  LIMIT p_limit
  OFFSET GREATEST(0, (p_page - 1) * p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
