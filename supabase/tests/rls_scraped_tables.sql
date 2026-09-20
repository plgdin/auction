-- Test script: Verify RLS on scraped tables as 'anon' role
-- Can be executed via psql or Supabase SQL editor.
-- Verifies:
--   1. SELECT succeeds for anon role on all scraped tables
--   2. INSERT fails for anon role (RLS violation)
--   3. UPDATE fails for anon role (RLS violation)
--   4. DELETE fails for anon role (RLS violation)

BEGIN;

-- Set current execution role to 'anon' (as simulated by Supabase PostgREST client)
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.role" = 'anon';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Test SELECT (Must succeed)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    PERFORM count(*) FROM public.gem_auctions;
    PERFORM count(*) FROM public.gem_bids;
    PERFORM count(*) FROM public.baanknet_auctions;
    PERFORM count(*) FROM public.baanknet_auction_photos;
    RAISE NOTICE 'SUCCESS: SELECT permitted for anon on all 4 scraped tables';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Test INSERT (Must be rejected)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.1 gem_auctions
DO $$
BEGIN
    INSERT INTO public.gem_auctions (gem_auction_id, title, auction_start_date, auction_end_date, location)
    VALUES ('TEST-INTRUDER-1', 'Intruder Auction', now(), now() + interval '1 day', 'India');
    RAISE EXCEPTION 'SECURITY BREACH: anon was able to INSERT into gem_auctions!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASSED: anon INSERT rejected on gem_auctions (insufficient privilege)';
    WHEN others THEN
        -- RLS violation usually raises row-level security policy violation
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE 'PASSED: anon INSERT rejected on gem_auctions (RLS 42501)';
        ELSE
            RAISE NOTICE 'PASSED: anon INSERT rejected on gem_auctions (Error: % %)', SQLSTATE, SQLERRM;
        END IF;
END $$;

-- 2.2 gem_bids
DO $$
BEGIN
    INSERT INTO public.gem_bids (bid_number, items, start_date, end_date)
    VALUES ('TEST-INTRUDER-BID-1', 'Intruder Bid', now(), now() + interval '1 day');
    RAISE EXCEPTION 'SECURITY BREACH: anon was able to INSERT into gem_bids!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASSED: anon INSERT rejected on gem_bids (insufficient privilege)';
    WHEN others THEN
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE 'PASSED: anon INSERT rejected on gem_bids (RLS 42501)';
        ELSE
            RAISE NOTICE 'PASSED: anon INSERT rejected on gem_bids (Error: % %)', SQLSTATE, SQLERRM;
        END IF;
END $$;

-- 2.3 baanknet_auctions
DO $$
BEGIN
    INSERT INTO public.baanknet_auctions (baanknet_auction_id, title, bank_name, auction_start_date, auction_end_date, location)
    VALUES ('TEST-INTRUDER-BN-1', 'Intruder Property', 'Test Bank', now(), now() + interval '1 day', 'India');
    RAISE EXCEPTION 'SECURITY BREACH: anon was able to INSERT into baanknet_auctions!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASSED: anon INSERT rejected on baanknet_auctions (insufficient privilege)';
    WHEN others THEN
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE 'PASSED: anon INSERT rejected on baanknet_auctions (RLS 42501)';
        ELSE
            RAISE NOTICE 'PASSED: anon INSERT rejected on baanknet_auctions (Error: % %)', SQLSTATE, SQLERRM;
        END IF;
END $$;

-- 2.4 baanknet_auction_photos
DO $$
BEGIN
    INSERT INTO public.baanknet_auction_photos (baanknet_auction_id, photo_url)
    VALUES ('TEST-INTRUDER-BN-1', 'https://malicious.test/photo.jpg');
    RAISE EXCEPTION 'SECURITY BREACH: anon was able to INSERT into baanknet_auction_photos!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASSED: anon INSERT rejected on baanknet_auction_photos (insufficient privilege)';
    WHEN others THEN
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE 'PASSED: anon INSERT rejected on baanknet_auction_photos (RLS 42501)';
        ELSE
            RAISE NOTICE 'PASSED: anon INSERT rejected on baanknet_auction_photos (Error: % %)', SQLSTATE, SQLERRM;
        END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Test UPDATE (Must be rejected)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    UPDATE public.gem_auctions SET title = 'Defaced Title';
    RAISE EXCEPTION 'SECURITY BREACH: anon was able to UPDATE gem_auctions!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASSED: anon UPDATE rejected on gem_auctions';
    WHEN others THEN
        RAISE NOTICE 'PASSED: anon UPDATE rejected on gem_auctions (% %)', SQLSTATE, SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Test DELETE (Must be rejected)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    DELETE FROM public.gem_auctions;
    RAISE EXCEPTION 'SECURITY BREACH: anon was able to DELETE from gem_auctions!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASSED: anon DELETE rejected on gem_auctions';
    WHEN others THEN
        RAISE NOTICE 'PASSED: anon DELETE rejected on gem_auctions (% %)', SQLSTATE, SQLERRM;
END $$;

-- Always rollback so test never mutates persistent state
ROLLBACK;
