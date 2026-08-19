-- Migration: Enhance document attachments and corrigendum tracking for GeM and BaankNet

-- 1. Add document_urls and corrigendum_urls to gem_bids
ALTER TABLE public.gem_bids
    ADD COLUMN IF NOT EXISTS document_urls TEXT[],
    ADD COLUMN IF NOT EXISTS corrigendum_urls TEXT[];

-- 2. Add document_urls to gem_auctions
ALTER TABLE public.gem_auctions
    ADD COLUMN IF NOT EXISTS document_urls TEXT[];

-- 3. Update comments
COMMENT ON COLUMN public.gem_bids.document_urls IS 'Array of all downloadable bid document links, ATC files, and technical specifications';
COMMENT ON COLUMN public.gem_bids.corrigendum_urls IS 'Array of all published Corrigendum amendment PDF documents for this bid';
COMMENT ON COLUMN public.gem_auctions.document_urls IS 'Array of all attached auction notice documents, lot schedules, and NIT terms';
