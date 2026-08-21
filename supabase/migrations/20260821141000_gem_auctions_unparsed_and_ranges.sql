-- Migration: Add unparsed flags, min/max price range columns, and remove hardcoded defaults from gem_auctions

-- Make date and location columns nullable / drop default 'India' and default 'live'
ALTER TABLE public.gem_auctions
  ALTER COLUMN auction_start_date DROP NOT NULL,
  ALTER COLUMN auction_end_date DROP NOT NULL,
  ALTER COLUMN location DROP NOT NULL,
  ALTER COLUMN location DROP DEFAULT,
  ALTER COLUMN auction_status DROP DEFAULT;

-- Add price range min/max and unparsed tracking flags
ALTER TABLE public.gem_auctions
  ADD COLUMN IF NOT EXISTS reserve_price_value_min NUMERIC,
  ADD COLUMN IF NOT EXISTS reserve_price_value_max NUMERIC,
  ADD COLUMN IF NOT EXISTS start_date_unparsed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_date_unparsed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_unparsed BOOLEAN DEFAULT false;

-- Create indexes on new numeric price columns for filtering
CREATE INDEX IF NOT EXISTS idx_gem_auctions_price_min ON public.gem_auctions (reserve_price_value_min);
CREATE INDEX IF NOT EXISTS idx_gem_auctions_price_max ON public.gem_auctions (reserve_price_value_max);
