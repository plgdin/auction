-- ============================================================================
-- Migration 00006: Audit Fixes
-- Addresses RLS gaps, mock user issues, and adds missing tables
-- ============================================================================

-- Fix 1: Add RLS to financial tables
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emd_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions" ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet transactions" ON wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own EMD transactions" ON emd_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own EMD transactions" ON emd_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own payment receipts" ON payment_receipts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payment receipts" ON payment_receipts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fix 2: Drop restrictive CHECK constraint on emd_transactions to allow future expansions
ALTER TABLE emd_transactions DROP CONSTRAINT IF EXISTS emd_transactions_check;

-- Fix 3: Auto-create organization for new profiles to enable seller flow
-- If a user signs up but doesn't have an organization, we create a default one.
CREATE OR REPLACE FUNCTION auto_create_organization()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  IF NEW.organization_id IS NULL THEN
    INSERT INTO organizations (name, contact_email) 
    VALUES (COALESCE(NEW.first_name || ' ' || NEW.last_name || ' Org', 'Default Org'), 'placeholder@example.com')
    RETURNING id INTO new_org_id;
    
    NEW.organization_id := new_org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create org before profile is inserted
DROP TRIGGER IF EXISTS trg_auto_create_organization ON profiles;
CREATE TRIGGER trg_auto_create_organization
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE PROCEDURE auto_create_organization();

-- Retroactively create organizations for existing profiles without one
DO $$
DECLARE
  r RECORD;
  new_org_id UUID;
BEGIN
  FOR r IN SELECT id, first_name, last_name FROM profiles WHERE organization_id IS NULL LOOP
    INSERT INTO organizations (name) VALUES (COALESCE(r.first_name || ' ' || r.last_name || ' Org', 'Default Org')) RETURNING id INTO new_org_id;
    UPDATE profiles SET organization_id = new_org_id WHERE id = r.id;
  END LOOP;
END;
$$;

-- Fix 4: User Documents Table (for Document Vault KYC)
CREATE TABLE IF NOT EXISTS user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    document_type VARCHAR(100) DEFAULT 'kyc',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own documents" ON user_documents FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_user_documents_updated_at BEFORE UPDATE ON user_documents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Fix 5: User Notification Preferences Table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    email_bids BOOLEAN DEFAULT true,
    email_tenders BOOLEAN DEFAULT true,
    email_marketing BOOLEAN DEFAULT false,
    push_outbid BOOLEAN DEFAULT true,
    push_system BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notification preferences" ON user_notification_preferences FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON user_notification_preferences FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
