-- =============================================================================
-- Migration: Create public.app_settings table and update trigger functions
-- to avoid database privilege errors (permission denied to ALTER DATABASE)
-- =============================================================================

-- 1. Create settings storage table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for security (hide credentials from anonymous or standard authenticated users)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to see and manage settings
DROP POLICY IF EXISTS "Admins can view and edit settings" ON public.app_settings;
CREATE POLICY "Admins can view and edit settings" ON public.app_settings
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles AS p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
        )
    );

-- 2. Insert placeholders (these must be updated with your actual URLs and token)
INSERT INTO public.app_settings (key, value) VALUES
  ('transactional_email_url', 'https://YOUR_VERCEL_APP_URL.vercel.app/api/send-transactional-email'),
  ('signup_email_url', 'https://YOUR_VERCEL_APP_URL.vercel.app/api/send-signup-email'),
  ('internal_api_secret', 'YOUR_SECRET_TOKEN_HERE')
ON CONFLICT (key) DO NOTHING;


-- 3. Update notify_outbid_email to read from app_settings
CREATE OR REPLACE FUNCTION notify_outbid_email()
RETURNS TRIGGER AS $$
DECLARE
  v_api_url TEXT;
  v_api_secret TEXT;
BEGIN
  SELECT value INTO v_api_url FROM public.app_settings WHERE key = 'transactional_email_url';
  SELECT value INTO v_api_secret FROM public.app_settings WHERE key = 'internal_api_secret';

  IF v_api_url IS NULL OR v_api_secret IS NULL THEN
    RAISE WARNING '[notify_outbid_email] Missing credentials in app_settings. Email not sent.';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'type', 'outbid_alert',
      'payload', jsonb_build_object(
        'bidder_id', OLD.bidder_id::TEXT,
        'auction_id', OLD.auction_id::TEXT
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net;


-- 4. Update notify_bid_confirmation_email to read from app_settings
CREATE OR REPLACE FUNCTION notify_bid_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  v_api_url TEXT;
  v_api_secret TEXT;
BEGIN
  SELECT value INTO v_api_url FROM public.app_settings WHERE key = 'transactional_email_url';
  SELECT value INTO v_api_secret FROM public.app_settings WHERE key = 'internal_api_secret';

  IF v_api_url IS NULL OR v_api_secret IS NULL THEN
    RAISE WARNING '[notify_bid_confirmation_email] Missing credentials in app_settings. Email not sent.';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'type', 'bid_confirmation',
      'payload', jsonb_build_object(
        'bidder_id', NEW.bidder_id::TEXT,
        'auction_id', NEW.auction_id::TEXT,
        'amount', NEW.amount
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net;


-- 5. Update notify_deposit_receipt_email to read from app_settings
CREATE OR REPLACE FUNCTION notify_deposit_receipt_email()
RETURNS TRIGGER AS $$
DECLARE
  v_api_url TEXT;
  v_api_secret TEXT;
BEGIN
  SELECT value INTO v_api_url FROM public.app_settings WHERE key = 'transactional_email_url';
  SELECT value INTO v_api_secret FROM public.app_settings WHERE key = 'internal_api_secret';

  IF v_api_url IS NULL OR v_api_secret IS NULL THEN
    RAISE WARNING '[notify_deposit_receipt_email] Missing credentials in app_settings. Email not sent.';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'type', 'emd_receipt',
      'payload', jsonb_build_object(
        'user_id', NEW.user_id::TEXT,
        'amount', NEW.amount,
        'reference_id', COALESCE(NEW.reference_id, NEW.id::TEXT)
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net;


-- 6. Update notify_signup_welcome_email to read from app_settings
CREATE OR REPLACE FUNCTION public.notify_signup_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, net
AS $$
DECLARE
  v_api_url TEXT;
  v_api_secret TEXT;
  v_should_send BOOLEAN := false;
  v_welcome_sent BOOLEAN;
  v_first_name TEXT;
BEGIN
  -- Determine if welcome email should be sent
  IF TG_OP = 'INSERT' THEN
    IF NEW.email_confirmed_at IS NOT NULL THEN
      v_should_send := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
      v_should_send := true;
    END IF;
  END IF;

  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  -- Check if already sent in public.profiles
  SELECT welcome_email_sent, first_name 
  INTO v_welcome_sent, v_first_name
  FROM public.profiles 
  WHERE id = NEW.id;

  -- Default values if not found or null
  IF v_welcome_sent IS NULL THEN
    v_welcome_sent := false;
  END IF;
  IF v_first_name IS NULL THEN
    v_first_name := NEW.raw_user_meta_data->>'first_name';
  END IF;

  -- If already sent, do nothing
  IF v_welcome_sent THEN
    RETURN NEW;
  END IF;

  -- Read signup url configuration setting
  SELECT value INTO v_api_url FROM public.app_settings WHERE key = 'signup_email_url';
  
  -- Fallback: dynamically construct from transactional URL if not explicitly configured
  IF v_api_url IS NULL THEN
    SELECT value INTO v_api_url FROM public.app_settings WHERE key = 'transactional_email_url';
    IF v_api_url IS NOT NULL THEN
      v_api_url := replace(v_api_url, '/api/send-transactional-email', '/api/send-signup-email');
    END IF;
  END IF;

  SELECT value INTO v_api_secret FROM public.app_settings WHERE key = 'internal_api_secret';

  IF v_api_url IS NULL OR v_api_secret IS NULL THEN
    RAISE WARNING '[notify_signup_welcome_email] Missing credentials in app_settings. Email not sent.';
    RETURN NEW;
  END IF;

  -- Mark as sent in public.profiles (atomic update within transaction)
  UPDATE public.profiles
  SET welcome_email_sent = true
  WHERE id = NEW.id;

  -- Send HTTP post with email and first_name directly to prevent DB query latency / race conditions
  PERFORM net.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'user_id', NEW.id::TEXT,
      'email', NEW.email,
      'first_name', COALESCE(v_first_name, '')
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )
  );

  RETURN NEW;
END;
$$;
