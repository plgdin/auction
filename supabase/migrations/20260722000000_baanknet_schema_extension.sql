-- Migration: Extend baanknet_auctions with detail-page fields and create photos table
-- Supports three auction modules: eAuction PSB, Property Listings, IBC eAuction

-- ─── New Columns on baanknet_auctions ────────────────────────────────────────

-- Which portal module this listing came from
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS auction_module TEXT DEFAULT 'eauction_psb';

-- Property physical attributes
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS carpet_area TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS carpet_area_sqft NUMERIC;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS furnishing TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS possession_status TEXT;

-- Legal action type: SARFAESI / IBC / DRT
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS action_type TEXT;

-- Finer location granularity
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS district TEXT;

-- Inspection window
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS inspection_start_date TIMESTAMPTZ;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS inspection_end_date TIMESTAMPTZ;

-- EMD deadline
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS emd_end_date TIMESTAMPTZ;

-- Borrower / defaulter info
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS borrower_name TEXT;

-- Extended description from detail page
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS property_description TEXT;

-- Multiple borrower/guarantor names & document URLs
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS borrower_names TEXT[];

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS document_urls TEXT[];

-- EMD raw text & contact details
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS emd_amount_text TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS contact_person TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Cross-module deduplication fingerprint
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS dedup_fingerprint TEXT;

-- Photo metadata
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS photo_count INTEGER DEFAULT 0;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Index on auction_module for module-specific queries
CREATE INDEX IF NOT EXISTS idx_baanknet_auction_module
    ON public.baanknet_auctions (auction_module);

-- Index on action_type for SARFAESI/IBC/DRT filtering
CREATE INDEX IF NOT EXISTS idx_baanknet_action_type
    ON public.baanknet_auctions (action_type);

-- Index on district for location drilling
CREATE INDEX IF NOT EXISTS idx_baanknet_district
    ON public.baanknet_auctions (district);

-- Index on dedup_fingerprint for cross-module deduplication
CREATE INDEX IF NOT EXISTS idx_baanknet_dedup_fingerprint
    ON public.baanknet_auctions (dedup_fingerprint);

-- ─── Photos Table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.baanknet_auction_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baanknet_auction_id TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    storage_path TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT fk_baanknet_auction_photos_auction
        FOREIGN KEY (baanknet_auction_id)
        REFERENCES public.baanknet_auctions(baanknet_auction_id)
        ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.baanknet_auction_photos ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access on BaankNet photos"
    ON public.baanknet_auction_photos
    FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Allow service role access on BaankNet photos"
    ON public.baanknet_auction_photos
    FOR ALL USING (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_baanknet_photos_auction_id
    ON public.baanknet_auction_photos (baanknet_auction_id);

CREATE INDEX IF NOT EXISTS idx_baanknet_photos_display_order
    ON public.baanknet_auction_photos (baanknet_auction_id, display_order);

-- Grants
GRANT SELECT ON public.baanknet_auction_photos TO anon;
GRANT SELECT ON public.baanknet_auction_photos TO authenticated;
GRANT ALL ON public.baanknet_auction_photos TO service_role;
