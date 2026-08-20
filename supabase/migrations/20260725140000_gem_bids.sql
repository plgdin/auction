-- Migration: Create gem_bids table for Government e-Marketplace (GeM) Procurement Bids

CREATE TABLE IF NOT EXISTS public.gem_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- GeM Bid identifiers
    bid_number TEXT UNIQUE NOT NULL,
    ra_number TEXT,

    -- Listing details
    items TEXT NOT NULL,
    quantity TEXT,

    -- Department details
    department_name TEXT,

    -- Dates
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,

    -- Status and source
    status TEXT DEFAULT 'live',
    document_url TEXT,
    ra_document_url TEXT,
    category_name TEXT DEFAULT 'Government | Procurement',
    raw_description TEXT,

    -- Processing status
    processing_status TEXT DEFAULT 'completed',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.gem_bids ENABLE ROW LEVEL SECURITY;

-- Public read access for consulting dashboards
CREATE POLICY "Allow public read access on GeM bids"
    ON public.gem_bids
    FOR SELECT USING (true);

-- Service role / background worker full access
CREATE POLICY "Allow service role complete access on GeM bids"
    ON public.gem_bids
    FOR ALL USING (true);

-- Admin access for authenticated users with admin role
CREATE POLICY "Allow admin access on GeM bids"
    ON public.gem_bids
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_gem_bids_status
    ON public.gem_bids (status);

CREATE INDEX IF NOT EXISTS idx_gem_bids_number
    ON public.gem_bids (bid_number);

CREATE INDEX IF NOT EXISTS idx_gem_bids_end_date
    ON public.gem_bids (end_date);

CREATE INDEX IF NOT EXISTS idx_gem_bids_created_at
    ON public.gem_bids (created_at);

-- Full-text search vector column
ALTER TABLE public.gem_bids
    ADD COLUMN IF NOT EXISTS fts_doc tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(bid_number, '') || ' ' ||
            coalesce(ra_number, '') || ' ' ||
            coalesce(items, '') || ' ' ||
            coalesce(department_name, '') || ' ' ||
            coalesce(raw_description, '')
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_gem_bids_fts
    ON public.gem_bids USING GIN (fts_doc);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gem_bids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gem_bids_updated_at
    BEFORE UPDATE ON public.gem_bids
    FOR EACH ROW
    EXECUTE FUNCTION update_gem_bids_updated_at();
