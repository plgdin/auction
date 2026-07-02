-- Migration: Custom Synonyms, Fuzzy Dictionary, and Vector Threshold Fix
-- 1. Create search_synonyms table for custom acronym definitions
-- 2. Materialize the search_dictionary for pg_trgm fuzzy matching
-- 3. Upgrade suggest_search_correction to cascade through synonyms and fuzzy matching
-- 4. Fix hybrid_search_mstc_catalog by raising vector threshold from 0.1 to 0.6 to prevent statement timeouts

-- 1. Custom Synonyms Table
CREATE TABLE IF NOT EXISTS search_synonyms (
    abbreviation TEXT PRIMARY KEY,
    expansion TEXT NOT NULL
);

INSERT INTO search_synonyms (abbreviation, expansion) VALUES
    ('csf', 'customs'),
    ('veh', 'vehicle'),
    ('veh.', 'vehicle'),
    ('vehic', 'vehicle'),
    ('mty', 'empty'),
    ('mtrl', 'material'),
    ('equip', 'equipment'),
    ('mach', 'machinery'),
    ('qty', 'quantity')
ON CONFLICT (abbreviation) DO UPDATE SET expansion = EXCLUDED.expansion;

-- 2. Materialized Dictionary for Fuzzy Matching
DROP MATERIALIZED VIEW IF EXISTS search_dictionary CASCADE;
CREATE MATERIALIZED VIEW search_dictionary AS
SELECT word FROM ts_stat('SELECT to_tsvector(''simple'', coalesce(category_name, '''') || '' '' || coalesce(seller_name, '''') || '' '' || coalesce(raw_materials_text, '''')) FROM public.mstc_auctions');

CREATE INDEX IF NOT EXISTS trgm_idx_search_dictionary ON search_dictionary USING gin (word gin_trgm_ops);

-- Function to refresh the dictionary
CREATE OR REPLACE FUNCTION refresh_search_dictionary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_dictionary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Updated Suggestion RPC (Synonyms + Fuzzy)
CREATE OR REPLACE FUNCTION suggest_search_correction(p_query TEXT)
RETURNS TEXT AS $$
DECLARE
  v_word TEXT;
  v_corrected_query TEXT := '';
  v_best_match TEXT;
  v_synonym TEXT;
BEGIN
  -- Split query into words
  FOR v_word IN SELECT unnest(string_to_array(lower(p_query), ' ')) LOOP
    
    -- 1. Check Synonym Table first
    SELECT expansion INTO v_synonym FROM search_synonyms WHERE abbreviation = v_word;
    
    IF v_synonym IS NOT NULL THEN
      v_corrected_query := v_corrected_query || ' ' || v_synonym;
      CONTINUE;
    END IF;

    -- 2. Fuzzy match against search_dictionary (pg_trgm)
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


-- 4. Re-declare hybrid_search_mstc_catalog with updated vector threshold
DROP FUNCTION IF EXISTS hybrid_search_mstc_catalog(text,vector,text[],text[],text[],text[],text[],text,text,boolean,boolean,numeric,numeric,boolean,integer,integer);

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
          (1 - (m.embedding <=> p_embedding)) > 0.6   -- <---- CRITICAL TIMEOUT FIX (Was 0.1)
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
