-- Migration: Add missing GeM bids columns for ministry, organisation, department, and address details
-- Ensures complete intelligence from GeM BidPlus cards is preserved in public.gem_bids.

ALTER TABLE public.gem_bids
    ADD COLUMN IF NOT EXISTS ministry TEXT,
    ADD COLUMN IF NOT EXISTS organisation TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS full_address TEXT,
    ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'India',
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS pincode TEXT;

-- Create indexes for efficient filtering and searching
CREATE INDEX IF NOT EXISTS idx_gem_bids_ministry ON public.gem_bids (ministry);
CREATE INDEX IF NOT EXISTS idx_gem_bids_organisation ON public.gem_bids (organisation);
CREATE INDEX IF NOT EXISTS idx_gem_bids_city ON public.gem_bids (city);
CREATE INDEX IF NOT EXISTS idx_gem_bids_state ON public.gem_bids (state);

-- Column comments
COMMENT ON COLUMN public.gem_bids.ministry IS 'Authoritative Ministry extracted from GeM Bid Department & Address block';
COMMENT ON COLUMN public.gem_bids.organisation IS 'Authoritative Organisation extracted from GeM Bid Department & Address block';
COMMENT ON COLUMN public.gem_bids.department IS 'Department level extracted from GeM Bid Department & Address block';
COMMENT ON COLUMN public.gem_bids.full_address IS 'Full physical address extracted from GeM Bid Department & Address block';
COMMENT ON COLUMN public.gem_bids.location IS 'Location / City fallback for GeM Bid';
COMMENT ON COLUMN public.gem_bids.city IS 'Parsed city name for GeM Bid';
COMMENT ON COLUMN public.gem_bids.state IS 'Parsed state name for GeM Bid';
COMMENT ON COLUMN public.gem_bids.pincode IS 'Postal pincode for GeM Bid';
