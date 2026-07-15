-- Add document_url column to baanknet_auctions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'baanknet_auctions'
        AND column_name = 'document_url'
    ) THEN
        ALTER TABLE public.baanknet_auctions ADD COLUMN document_url TEXT;
    END IF;
END $$;

-- Re-grant SELECT permissions to anon and authenticated roles
GRANT SELECT ON public.baanknet_auctions TO anon;
GRANT SELECT ON public.baanknet_auctions TO authenticated;
GRANT ALL ON public.baanknet_auctions TO service_role;
