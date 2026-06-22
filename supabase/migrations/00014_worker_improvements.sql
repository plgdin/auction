-- Migration 00014: Worker improvements (atomic claim and ocr cache)

CREATE TABLE IF NOT EXISTS ocr_cache (
    buffer_hash TEXT PRIMARY KEY,
    ocr_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on ocr_cache
ALTER TABLE ocr_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access on ocr_cache
DROP POLICY IF EXISTS "Allow public read access on ocr_cache" ON ocr_cache;
CREATE POLICY "Allow public read access on ocr_cache" ON ocr_cache
    FOR SELECT USING (true);

-- Allow complete access to service role / background workers
DROP POLICY IF EXISTS "Allow service role complete access on ocr_cache" ON ocr_cache;
CREATE POLICY "Allow service role complete access on ocr_cache" ON ocr_cache
    FOR ALL USING (true);

-- Claim function for atomic batch queue processing
CREATE OR REPLACE FUNCTION claim_mstc_auctions_batch(
  p_worker_id TEXT,
  p_batch_size INT,
  p_max_retry_count INT
) RETURNS TABLE (
  id UUID,
  mstc_auction_number TEXT,
  source_pdf_url TEXT,
  retry_count INT,
  category_name TEXT,
  seller_name TEXT,
  location TEXT,
  raw_materials_text TEXT,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE mstc_auctions
  SET asset_status = 'processing',
      updated_at = NOW(),
      error_log = 'Claimed by worker ' || p_worker_id
  WHERE mstc_auctions.id IN (
    SELECT m.id
    FROM mstc_auctions m
    WHERE (m.asset_status = 'pending' OR m.asset_status = 'failed')
      AND m.retry_count < p_max_retry_count
      -- Cooldown exponential backoff logic:
      -- retry 1: 1 min, retry 2: 5 min, retry 3: 15 min, >=4: 30 min
      AND (m.retry_count = 0 OR m.updated_at IS NULL OR NOW() - m.updated_at >= CASE 
          WHEN m.retry_count = 1 THEN interval '1 minute'
          WHEN m.retry_count = 2 THEN interval '5 minutes'
          WHEN m.retry_count = 3 THEN interval '15 minutes'
          ELSE interval '30 minutes'
      END)
    ORDER BY m.updated_at ASC NULLS FIRST
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING 
    mstc_auctions.id,
    mstc_auctions.mstc_auction_number::TEXT,
    mstc_auctions.source_pdf_url,
    mstc_auctions.retry_count,
    mstc_auctions.category_name::TEXT,
    mstc_auctions.seller_name::TEXT,
    mstc_auctions.location::TEXT,
    mstc_auctions.raw_materials_text::TEXT,
    mstc_auctions.updated_at;
END;
$$ SECURITY DEFINER;
