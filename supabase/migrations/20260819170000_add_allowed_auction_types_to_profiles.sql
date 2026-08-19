-- Add allowed_auction_types to public.profiles
-- This enables granular admin-level access control over which auction portals (MSTC, BaankNet, GeM Bids, GeM Forward Auctions, GeM PBP, Custom) each user can access.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS allowed_auction_types text[] DEFAULT ARRAY['mstc'];

-- Comment for documentation
COMMENT ON COLUMN public.profiles.allowed_auction_types IS 'Array of auction source keys that the user is permitted to view and interact with: mstc, baanknet, gem_bids, gem_auctions, gem_pbp, custom';
