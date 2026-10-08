-- Migration: Add extended BaankNet property and borrower details
-- Supports all fields from BaankNet Property Listing detail views:
-- Borrower address, ownership capacity, EMD start datetime, facing, nearest transport hub, property summary

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS borrower_address TEXT,
    ADD COLUMN IF NOT EXISTS ownership_role TEXT,
    ADD COLUMN IF NOT EXISTS emd_start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS facing TEXT,
    ADD COLUMN IF NOT EXISTS nearest_station TEXT,
    ADD COLUMN IF NOT EXISTS property_summary TEXT;

COMMENT ON COLUMN public.baanknet_auctions.borrower_address IS 'Registered address of the borrower or guarantor';
COMMENT ON COLUMN public.baanknet_auctions.ownership_role IS 'Ownership capacity (e.g. Borrower, Guarantor, Mortgagor)';
COMMENT ON COLUMN public.baanknet_auctions.emd_start_date IS 'Start datetime for EMD deposit submission window';
COMMENT ON COLUMN public.baanknet_auctions.facing IS 'Cardinal orientation / facing of the property (e.g. East, West, North, South)';
COMMENT ON COLUMN public.baanknet_auctions.nearest_station IS 'Nearest airport, railway station, bus stand or metro station for transit connectivity';
COMMENT ON COLUMN public.baanknet_auctions.property_summary IS 'High-level property summary (e.g. Commercial Building, Residential Flat)';

GRANT SELECT ON public.baanknet_auctions TO anon;
GRANT SELECT ON public.baanknet_auctions TO authenticated;
GRANT ALL ON public.baanknet_auctions TO service_role;
