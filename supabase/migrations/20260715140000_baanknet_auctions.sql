-- Migration: Create baanknet_auctions table for PSB Alliance Bank Asset Auction Network
-- This stores bank-seized property auctions scraped from baanknet.com

CREATE TABLE IF NOT EXISTS public.baanknet_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- BaankNet identifiers
    baanknet_auction_id TEXT UNIQUE NOT NULL,
    bank_property_id TEXT,

    -- Listing details
    title TEXT NOT NULL,
    property_type TEXT,
    reserve_price_text TEXT,
    reserve_price_value NUMERIC,
    bank_name TEXT NOT NULL,

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
    auction_status TEXT DEFAULT 'upcoming',
    source_url TEXT,
    category_name TEXT DEFAULT 'Real Estate | Bank Property',
    raw_description TEXT,

    -- Processing status (always 'completed' since no PDF processing is needed)
    asset_status TEXT DEFAULT 'completed',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.baanknet_auctions ENABLE ROW LEVEL SECURITY;

-- Public read access for consulting dashboards
CREATE POLICY "Allow public read access on BaankNet auctions"
    ON public.baanknet_auctions
    FOR SELECT USING (true);

-- Service role / background worker full access
CREATE POLICY "Allow service role complete access on BaankNet"
    ON public.baanknet_auctions
    FOR ALL USING (true);

-- Admin access for authenticated users with admin role
CREATE POLICY "Allow admin access on BaankNet auctions"
    ON public.baanknet_auctions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_baanknet_auction_status
    ON public.baanknet_auctions (auction_status);

CREATE INDEX IF NOT EXISTS idx_baanknet_bank_name
    ON public.baanknet_auctions (bank_name);

CREATE INDEX IF NOT EXISTS idx_baanknet_state
    ON public.baanknet_auctions (state);

CREATE INDEX IF NOT EXISTS idx_baanknet_property_type
    ON public.baanknet_auctions (property_type);

CREATE INDEX IF NOT EXISTS idx_baanknet_reserve_price
    ON public.baanknet_auctions (reserve_price_value);

CREATE INDEX IF NOT EXISTS idx_baanknet_end_date
    ON public.baanknet_auctions (auction_end_date);

CREATE INDEX IF NOT EXISTS idx_baanknet_created_at
    ON public.baanknet_auctions (created_at);

-- Full-text search vector column
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS fts_doc tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(title, '') || ' ' ||
            coalesce(bank_name, '') || ' ' ||
            coalesce(state, '') || ' ' ||
            coalesce(city, '') || ' ' ||
            coalesce(property_type, '') || ' ' ||
            coalesce(full_address, '') || ' ' ||
            coalesce(raw_description, '')
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_baanknet_fts
    ON public.baanknet_auctions USING GIN (fts_doc);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_baanknet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_baanknet_updated_at
    BEFORE UPDATE ON public.baanknet_auctions
    FOR EACH ROW
    EXECUTE FUNCTION update_baanknet_updated_at();
