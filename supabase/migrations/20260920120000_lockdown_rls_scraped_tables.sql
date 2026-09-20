-- Migration: Lock down RLS on scraped data tables (Prompt 0)
-- Drops permissive policies that were created without "TO service_role" (which defaulted to PUBLIC),
-- preventing unauthorized INSERT/UPDATE/DELETE by anon or standard authenticated users.
-- The service_role bypasses RLS natively in Supabase.

-- 1. GeM Auctions
DROP POLICY IF EXISTS "Allow service role complete access on GeM" ON public.gem_auctions;

-- 2. GeM Bids
DROP POLICY IF EXISTS "Allow service role complete access on GeM bids" ON public.gem_bids;

-- 3. BaankNet Auctions
DROP POLICY IF EXISTS "Allow service role complete access on BaankNet" ON public.baanknet_auctions;

-- 4. BaankNet Photos
DROP POLICY IF EXISTS "Allow service role access on BaankNet photos" ON public.baanknet_auction_photos;

-- 5. MSTC Auctions
DROP POLICY IF EXISTS "Allow service role complete access" ON public.mstc_auctions;
DROP POLICY IF EXISTS "Allow service role complete access on MSTC" ON public.mstc_auctions;

-- 6. OCR Cache
DROP POLICY IF EXISTS "Allow service role complete access on ocr_cache" ON public.ocr_cache;

-- 7. Metalmandi Live Rates
DROP POLICY IF EXISTS "Allow service role complete access on metalmandi_live_rates" ON public.metalmandi_live_rates;
DROP POLICY IF EXISTS "Allow service role complete access on metalmandi" ON public.metalmandi_live_rates;

-- 8. Location Daily Stats
DROP POLICY IF EXISTS "Allow service role write to location_daily_stats" ON public.location_daily_stats;
DROP POLICY IF EXISTS "Allow service role complete access on location stats" ON public.location_daily_stats;
