-- Migration: Add full fidelity details to gem_auctions
-- Captures 100% of GeM Forward Auction Portal data: EMD, schedules, rules, contacts, reference numbers

ALTER TABLE public.gem_auctions
    ADD COLUMN IF NOT EXISTS emd_amount NUMERIC,
    ADD COLUMN IF NOT EXISTS emd_mode TEXT,
    ADD COLUMN IF NOT EXISTS emd_start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS emd_end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reference_no TEXT,
    ADD COLUMN IF NOT EXISTS seller_name TEXT,
    ADD COLUMN IF NOT EXISTS contact_email TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS bidding_access TEXT,
    ADD COLUMN IF NOT EXISTS item_wise_time TEXT,
    ADD COLUMN IF NOT EXISTS auto_extension TEXT,
    ADD COLUMN IF NOT EXISTS bidding_template TEXT,
    ADD COLUMN IF NOT EXISTS detailed_description TEXT,
    ADD COLUMN IF NOT EXISTS items_schedule JSONB,
    ADD COLUMN IF NOT EXISTS corrigendum_urls TEXT[];

-- Indexes for efficient filtering and searching
CREATE INDEX IF NOT EXISTS idx_gem_auctions_emd_amount ON public.gem_auctions (emd_amount);
CREATE INDEX IF NOT EXISTS idx_gem_auctions_reference_no ON public.gem_auctions (reference_no);
CREATE INDEX IF NOT EXISTS idx_gem_auctions_district ON public.gem_auctions (district);
CREATE INDEX IF NOT EXISTS idx_gem_auctions_items_schedule ON public.gem_auctions USING gin (items_schedule);

-- Column documentation
COMMENT ON COLUMN public.gem_auctions.emd_amount IS 'Earnest Money Deposit (EMD) requirement in INR';
COMMENT ON COLUMN public.gem_auctions.emd_mode IS 'EMD deposit payment method (e.g. Offline, Online)';
COMMENT ON COLUMN public.gem_auctions.emd_start_date IS 'Start date for EMD fee submission';
COMMENT ON COLUMN public.gem_auctions.emd_end_date IS 'Closing deadline for EMD fee submission';
COMMENT ON COLUMN public.gem_auctions.reference_no IS 'Official department tender/auction reference number';
COMMENT ON COLUMN public.gem_auctions.seller_name IS 'Authorized seller / auctioneer officer designation and name';
COMMENT ON COLUMN public.gem_auctions.contact_email IS 'Extracted direct officer contact email';
COMMENT ON COLUMN public.gem_auctions.contact_phone IS 'Extracted direct officer contact phone numbers';
COMMENT ON COLUMN public.gem_auctions.district IS 'Official district extracted from Project Location table';
COMMENT ON COLUMN public.gem_auctions.bidding_access IS 'Bidding access constraint (e.g. Open, Restricted)';
COMMENT ON COLUMN public.gem_auctions.item_wise_time IS 'Whether auction bidding runs sequentially per item';
COMMENT ON COLUMN public.gem_auctions.auto_extension IS 'Bidding window auto-extension rules';
COMMENT ON COLUMN public.gem_auctions.bidding_template IS 'Official bidding template categorization';
COMMENT ON COLUMN public.gem_auctions.detailed_description IS 'Complete narrative auction detail, terms, and lifting instructions';
COMMENT ON COLUMN public.gem_auctions.items_schedule IS 'Structured JSON array of schedule of lots/items (item_no, item_name, quantity, purchased_year, brand_name, specs)';
COMMENT ON COLUMN public.gem_auctions.corrigendum_urls IS 'Array of official corrigendum amendment document URLs';
