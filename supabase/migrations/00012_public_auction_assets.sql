-- Allow anonymous users to view auction catalog PDFs, previews, and extracted images
-- This fixes the bug where signed-out users cannot see the auction images or download the catalog
-- We strictly limit this to the scraper-generated folders to protect KYC documents stored in the root.

CREATE POLICY "Allow anon to read auction assets"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'auction_documents' 
  AND (
    name ILIKE 'mstc-extracted-images/%' OR 
    name ILIKE 'mstc-catalogs/%' OR 
    name ILIKE 'mstc-previews/%'
  )
);
