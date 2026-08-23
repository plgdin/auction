-- Migration: Fix BaankNet Garbage Titles and Location Artifacts
-- Resolves issues where search result headers ('Showing 10000+ Results') or bank names were saved as title/location.

-- 1. Clean location and state fields containing bank names or search terms
UPDATE public.baanknet_auctions
SET 
  state = NULL,
  location = 'India'
WHERE state ILIKE '%Bank%' OR state ILIKE '%Showing%' OR state ILIKE '%Lender%' OR state ILIKE '%Results%';

UPDATE public.baanknet_auctions
SET city = NULL
WHERE city ILIKE '%Bank%' OR city ILIKE '%Showing%' OR city ILIKE '%Lender%' OR city ILIKE '%Results%';

UPDATE public.baanknet_auctions
SET location = 'India'
WHERE location ILIKE '%Bank%' OR location ILIKE '%Showing%' OR location ILIKE '%Results%';

-- 2. Clean concatenated IBC titles (e.g., Asset ID4523Asset ClassificationIntangible Assets...)
UPDATE public.baanknet_auctions
SET 
  title = 'Intangible Assets in Maharashtra, Mumbai',
  property_type = 'Intangible Assets',
  full_address = 'Maharashtra, Mumbai, Mumbai Suburban',
  state = 'Maharashtra',
  city = 'Mumbai',
  location = 'Maharashtra',
  contact_person = 'Mr. Santanu T Ray',
  officer_designation = 'Insolvency Professional / Liquidator'
WHERE title ILIKE '%Asset ID%Asset Classification%Intangible Assets%';

UPDATE public.baanknet_auctions
SET 
  title = 'Insolvency Asset',
  property_type = 'Insolvency Asset'
WHERE title ILIKE '%Asset ID%Asset Classification%' AND title NOT ILIKE '%Intangible Assets%';

-- 3. Update garbage titles to clean synthesized property descriptions
UPDATE public.baanknet_auctions
SET title = TRIM(
  COALESCE(NULLIF(carpet_area, '') || ' ', '') ||
  COALESCE(NULLIF(property_type, ''), 'Bank Foreclosure Property') ||
  CASE 
    WHEN city IS NOT NULL AND city != '' AND city NOT ILIKE '%Bank%' THEN ' in ' || city
    WHEN state IS NOT NULL AND state != '' AND state NOT ILIKE '%Bank%' THEN ' in ' || state
    WHEN location IS NOT NULL AND location != '' AND location NOT ILIKE '%Bank%' AND location != 'India' THEN ' in ' || location
    ELSE ''
  END
)
WHERE 
  title ILIKE 'Showing %Results%' 
  OR title ILIKE '%10000+%' 
  OR title ILIKE 'Showing %Properties%'
  OR title ILIKE '%Results Found%'
  OR title ILIKE '%Search Results%'
  OR title = 'Bank Auction Property'
  OR title IS NULL
  OR TRIM(title) = '';

-- Ensure no titles remain blank
UPDATE public.baanknet_auctions
SET title = 'Bank Foreclosure Property'
WHERE title IS NULL OR TRIM(title) = '';
