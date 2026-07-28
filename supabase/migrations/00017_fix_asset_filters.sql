-- Migration: Fix Asset Document vs Image Filters
-- Problem: p_has_docs matched ANY .pdf string in raw_materials_text, so photo PDFs
--          (photo_abc.pdf, image_lot1.pdf) were treated as "asset documents".
--          p_has_images missed lot-level images stored in items[].images.
-- Fix:     Parse JSONB properly, exclude photo/image/catalog PDF filenames from
--          the documents filter. Check lot-level images for the images filter.
--          Mirrors client-side hasConfirmedAssetDocuments() logic exactly.

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
      m.updated_at,
      CASE WHEN v_tsquery IS NOT NULL THEN
        ts_rank_cd(m.fts_doc, v_tsquery)
      ELSE 0.0 END AS t_rank,
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
          m.fts_doc @@ v_tsquery
        ) OR
        (
          p_embedding IS NOT NULL AND m.embedding IS NOT NULL AND
          (1 - (m.embedding <=> p_embedding)) > 0.85
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
      -- ═══════════════════════════════════════════════════════════════════
      -- FIX: p_has_images — check extracted_images (top-level) AND items[].images (lot-level)
      -- ═══════════════════════════════════════════════════════════════════
      AND (
        p_has_images IS NULL OR p_has_images = FALSE OR
        (
          m.raw_materials_text IS NOT NULL 
          AND m.raw_materials_text LIKE '{%}'
          AND (
            -- Check top-level extracted_images for actual image URLs (not PDFs, not catalog pages, not previews)
            (
              m.raw_materials_text LIKE '%"extracted_images":%'
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                  (m.raw_materials_text::jsonb)->'extracted_images'
                ) AS img
                WHERE img NOT ILIKE '%.pdf'
                  AND img NOT ILIKE '%_catalog_page_%'
                  AND img NOT ILIKE '%mstc-previews/%'
              )
            )
            OR
            -- Check lot-level images: items[].images arrays
            (
              m.raw_materials_text LIKE '%"items":%'
              AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  (m.raw_materials_text::jsonb)->'items'
                ) AS lot
                WHERE jsonb_typeof(lot->'images') = 'array'
                  AND jsonb_array_length(lot->'images') > 0
              )
            )
          )
        )
      )
      -- ═══════════════════════════════════════════════════════════════════
      -- FIX: p_has_docs — parse items[].attachments JSONB, exclude photo/image/catalog PDFs
      -- Mirrors client-side hasConfirmedAssetDocuments() logic exactly.
      -- A "document" is a .pdf attachment whose filename does NOT contain
      -- photo, image, pic, picture, catalog, or preview.
      -- ═══════════════════════════════════════════════════════════════════
      AND (
        p_has_docs IS NULL OR p_has_docs = FALSE OR
        (
          m.raw_materials_text IS NOT NULL
          AND m.raw_materials_text LIKE '{%}'
          AND (
            -- 1. Parser-computed boolean flag & documents array (fast & dynamic)
            (m.raw_materials_text::jsonb)->>'hasAssetDocuments' = 'true'
            OR coalesce(jsonb_array_length((m.raw_materials_text::jsonb)->'documents'), 0) > 0
            OR
            -- 2. Fallback for legacy scraped records without top-level flags
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE WHEN m.raw_materials_text LIKE '%"items":%' THEN (m.raw_materials_text::jsonb)->'items' ELSE '[]'::jsonb END
              ) AS lot,
              LATERAL jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(lot->'attachments') = 'array' THEN lot->'attachments' ELSE '[]'::jsonb END
              ) AS att_name
              WHERE lower(att_name) LIKE '%.pdf%'
                AND lower(att_name) NOT LIKE 'photo%'
                AND lower(att_name) NOT LIKE 'image%'
                AND lower(att_name) NOT LIKE 'img%'
                AND lower(att_name) NOT LIKE 'pic%'
                AND lower(att_name) NOT LIKE '%catalog_page%'
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
    WHERE v_tsquery IS NULL OR t_rank >= 2.0 OR v_sim > 0.85
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
    (CASE WHEN p_search_query IS NOT NULL AND (
      r.mstc_auction_number ILIKE '%' || p_search_query || '%'
      OR r.seller_name ILIKE '%' || p_search_query || '%'
      OR r.category_name ILIKE '%' || p_search_query || '%'
    ) THEN 1000.0 ELSE r.rrf_score END) DESC,
    r.updated_at DESC
  LIMIT p_limit
  OFFSET GREATEST(0, (p_page - 1) * p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
