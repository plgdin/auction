-- Make the auction_documents bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'auction_documents';

-- Drop policies if they exist (to be safe)
DROP POLICY IF EXISTS "Allow authenticated users to read auction_documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to auction_documents" ON storage.objects;

-- Create policy to allow authenticated users to read/download objects from auction_documents
CREATE POLICY "Allow authenticated users to read auction_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'auction_documents');

-- Create policy to allow authenticated users to upload objects to auction_documents
CREATE POLICY "Allow authenticated users to upload to auction_documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'auction_documents');
