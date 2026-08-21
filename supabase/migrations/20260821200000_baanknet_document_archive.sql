-- Migration: Add document archiving and storage mirror columns to baanknet_auctions
-- Allows baanknetAssetWorker to mirror external notice PDFs to Supabase Storage

-- 1. Add documents_archived and stored_document_urls to baanknet_auctions
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS documents_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS stored_document_urls TEXT[] DEFAULT '{}'::TEXT[];

-- 2. Partial index on unarchived rows for fast queue queries in baanknetAssetWorker
CREATE INDEX IF NOT EXISTS idx_baanknet_unarchived_documents
    ON public.baanknet_auctions (documents_archived)
    WHERE documents_archived = FALSE;

-- 3. Comments
COMMENT ON COLUMN public.baanknet_auctions.documents_archived IS 'Indicates whether all auction notice documents have been successfully mirrored to Supabase Storage';
COMMENT ON COLUMN public.baanknet_auctions.stored_document_urls IS 'Array of permanent Supabase Storage public URLs for mirrored notice PDFs';

-- 4. Re-grant permissions
GRANT SELECT ON public.baanknet_auctions TO anon;
GRANT SELECT ON public.baanknet_auctions TO authenticated;
GRANT ALL ON public.baanknet_auctions TO service_role;
