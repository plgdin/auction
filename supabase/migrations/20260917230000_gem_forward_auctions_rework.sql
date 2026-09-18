-- Migration: Add missing GeM forward auction columns for business rules, inspection, and URLs
-- Ensures 100% of GeM portal intelligence is preserved without column drops.

ALTER TABLE public.gem_auctions
    ADD COLUMN IF NOT EXISTS bid_increment_amount NUMERIC,
    ADD COLUMN IF NOT EXISTS office_zone TEXT,
    ADD COLUMN IF NOT EXISTS rules_url TEXT,
    ADD COLUMN IF NOT EXISTS doc_page_url TEXT,
    ADD COLUMN IF NOT EXISTS extend_time_last_bid_min INTEGER,
    ADD COLUMN IF NOT EXISTS extend_time_by_min INTEGER,
    ADD COLUMN IF NOT EXISTS auto_extension_mode TEXT,
    ADD COLUMN IF NOT EXISTS emd_in_favour_of TEXT;

-- Create indexes for efficient filtering and searching
CREATE INDEX IF NOT EXISTS idx_gem_auctions_office_zone ON public.gem_auctions (office_zone);
CREATE INDEX IF NOT EXISTS idx_gem_auctions_bid_increment ON public.gem_auctions (bid_increment_amount);

-- Column comments
COMMENT ON COLUMN public.gem_auctions.bid_increment_amount IS 'Authoritative minimum bid increment value in INR from Business Rules';
COMMENT ON COLUMN public.gem_auctions.office_zone IS 'Sub-department / Unit / Office Zone level in the administrative hierarchy';
COMMENT ON COLUMN public.gem_auctions.rules_url IS 'Portal URL to the authoritative Business Rules configuration page';
COMMENT ON COLUMN public.gem_auctions.doc_page_url IS 'Portal URL to the Download Document page';
COMMENT ON COLUMN public.gem_auctions.extend_time_last_bid_min IS 'Window in minutes before close where a valid bid triggers auto-extension';
COMMENT ON COLUMN public.gem_auctions.extend_time_by_min IS 'Duration in minutes by which the auction extends on a late bid';
COMMENT ON COLUMN public.gem_auctions.auto_extension_mode IS 'Auto extension mode description (e.g. Unlimited Auto Extension)';
COMMENT ON COLUMN public.gem_auctions.emd_in_favour_of IS 'Designation / Account in favour of which EMD payment must be drawn';
