-- Migration: Deep Intelligence Fields for BaankNet & GeM Scrapers
-- Adds columns for OCR-extracted intelligence, preview images, property classification,
-- valuation data, document classification, and re-auction detection.

-- ═══ BaankNet Deep Intelligence Columns ══════════════════════════════════════

ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS property_classification text;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS carpet_area_sqft numeric;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS land_area_sqft numeric;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS valuation_amount numeric;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS valuation_date date;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS valuer_name text;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS distress_value numeric;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS sarfaesi_section text;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS possession_type text;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS possession_date date;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS document_classification jsonb DEFAULT '[]';
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS is_reauction boolean DEFAULT false;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS original_auction_id text;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS documents_archived_at timestamptz;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS survey_number text;
ALTER TABLE baanknet_auctions ADD COLUMN IF NOT EXISTS encumbrance_summary text;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_baanknet_property_classification
  ON baanknet_auctions (property_classification)
  WHERE property_classification IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_baanknet_is_reauction
  ON baanknet_auctions (is_reauction)
  WHERE is_reauction = true;

CREATE INDEX IF NOT EXISTS idx_baanknet_valuation_amount
  ON baanknet_auctions (valuation_amount)
  WHERE valuation_amount IS NOT NULL;

-- ═══ GeM Deep Intelligence Columns ══════════════════════════════════════════

ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS extracted_pdf_text text;
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS is_reauction boolean DEFAULT false;
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS original_auction_id text;
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS documents_archived boolean DEFAULT false;
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS documents_archived_at timestamptz;
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS discovered_api_attachments jsonb DEFAULT '[]';
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS boq_items jsonb DEFAULT '[]';
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS inspection_date text;
ALTER TABLE gem_auctions ADD COLUMN IF NOT EXISTS inspection_location text;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_gem_is_reauction
  ON gem_auctions (is_reauction)
  WHERE is_reauction = true;

CREATE INDEX IF NOT EXISTS idx_gem_documents_archived
  ON gem_auctions (documents_archived)
  WHERE documents_archived = false;
