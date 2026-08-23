-- Migration: Add extended intelligence fields to baanknet_auctions
-- Financial, Legal Due Diligence, Geospatial, Contacts, IBC/NCLT, and Document OCR

-- ─── 1. Financial & Bidding Rules ───────────────────────────────────────────
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS emd_amount_value NUMERIC;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS bid_increment_amount NUMERIC;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS bid_increment_text TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS tender_fee_text TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS tender_fee_value NUMERIC;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS outstanding_dues_text TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS outstanding_dues_value NUMERIC;

-- ─── 2. Payment & Remittance Details ─────────────────────────────────────────
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS emd_account_number TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS emd_account_ifsc TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS emd_bank_name TEXT;

-- ─── 3. Legal, Title & Due Diligence ─────────────────────────────────────────
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS cersai_id TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS title_type TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS encumbrances_text TEXT;

-- ─── 4. Branch & Officer Contacts ────────────────────────────────────────────
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS branch_name TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS officer_designation TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS officer_email TEXT;

-- ─── 5. Geospatial & Boundary Details ────────────────────────────────────────
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS latitude NUMERIC;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS longitude NUMERIC;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS map_url TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS boundaries JSONB;

-- ─── 6. IBC / NCLT Insolvency Specifics ──────────────────────────────────────
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS corporate_debtor_name TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS corporate_debtor_cin TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS liquidator_reg_no TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS liquidator_email TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS nclt_bench TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS nclt_case_no TEXT;

ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS process_memo_url TEXT;

-- ─── 7. Notice Document OCR / Extracted Text ──────────────────────────────────
ALTER TABLE public.baanknet_auctions
    ADD COLUMN IF NOT EXISTS extracted_pdf_text TEXT;

-- ─── 8. Performance Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_baanknet_emd_value
    ON public.baanknet_auctions (emd_amount_value);

CREATE INDEX IF NOT EXISTS idx_baanknet_cersai_id
    ON public.baanknet_auctions (cersai_id);

CREATE INDEX IF NOT EXISTS idx_baanknet_title_type
    ON public.baanknet_auctions (title_type);

CREATE INDEX IF NOT EXISTS idx_baanknet_branch_name
    ON public.baanknet_auctions (branch_name);

CREATE INDEX IF NOT EXISTS idx_baanknet_corporate_debtor_cin
    ON public.baanknet_auctions (corporate_debtor_cin);

-- Re-grant access
GRANT SELECT ON public.baanknet_auctions TO anon;
GRANT SELECT ON public.baanknet_auctions TO authenticated;
GRANT ALL ON public.baanknet_auctions TO service_role;
