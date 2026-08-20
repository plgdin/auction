-- Migration: Create gem_auctions table for Government e-Marketplace (GeM) Forward Auctions

CREATE TABLE IF NOT EXISTS public.gem_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- GeM Portal identifiers
    gem_auction_id TEXT UNIQUE NOT NULL,

    -- Listing details
    title TEXT NOT NULL,
    reserve_price_text TEXT,
    reserve_price_value NUMERIC,

    -- Organization details
    ministry TEXT,
    department TEXT,
    organisation TEXT,

    -- Location
    state TEXT,
    city TEXT,
    pincode TEXT,
    full_address TEXT,
    location TEXT NOT NULL DEFAULT 'India',

    -- Dates
    auction_start_date TIMESTAMPTZ NOT NULL,
    auction_end_date TIMESTAMPTZ NOT NULL,

    -- Status and source
    auction_status TEXT DEFAULT 'live',
    source_url TEXT,
    document_url TEXT,
    category_name TEXT DEFAULT 'Government | Auction',
    raw_description TEXT,

    -- Processing status (always 'completed' since no PDF parsing is needed)
    asset_status TEXT DEFAULT 'completed',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.gem_auctions ENABLE ROW LEVEL SECURITY;

-- Public read access for consulting dashboards
CREATE POLICY "Allow public read access on GeM auctions"
    ON public.gem_auctions
    FOR SELECT USING (true);

-- Service role / background worker full access
CREATE POLICY "Allow service role complete access on GeM"
    ON public.gem_auctions
    FOR ALL USING (true);

-- Admin access for authenticated users with admin role
CREATE POLICY "Allow admin access on GeM auctions"
    ON public.gem_auctions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_gem_auction_status
    ON public.gem_auctions (auction_status);

CREATE INDEX IF NOT EXISTS idx_gem_organisation
    ON public.gem_auctions (organisation);

CREATE INDEX IF NOT EXISTS idx_gem_state
    ON public.gem_auctions (state);

CREATE INDEX IF NOT EXISTS idx_gem_end_date
    ON public.gem_auctions (auction_end_date);

CREATE INDEX IF NOT EXISTS idx_gem_created_at
    ON public.gem_auctions (created_at);

-- Full-text search vector column
ALTER TABLE public.gem_auctions
    ADD COLUMN IF NOT EXISTS fts_doc tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(title, '') || ' ' ||
            coalesce(organisation, '') || ' ' ||
            coalesce(ministry, '') || ' ' ||
            coalesce(state, '') || ' ' ||
            coalesce(city, '') || ' ' ||
            coalesce(full_address, '') || ' ' ||
            coalesce(raw_description, '')
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_gem_fts
    ON public.gem_auctions USING GIN (fts_doc);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gem_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gem_updated_at
    BEFORE UPDATE ON public.gem_auctions
    FOR EACH ROW
    EXECUTE FUNCTION update_gem_updated_at();
