-- =============================================================================
-- Transactional email triggers via pg_net
-- Fires HTTP POSTs to /api/send-transactional-email on bid/wallet events
-- =============================================================================

-- pg_net is available by default on Supabase hosted instances
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Helper: resolve the API base URL from Supabase vault or hardcode
-- We store the endpoint URL and secret in vault for security.
-- If vault is not set up, the trigger functions will read from
-- the hardcoded defaults below which should be overridden in production.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. OUTBID ALERT
-- Fires when a bid's status changes from 'active' to 'outbid'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_outbid_email()
RETURNS TRIGGER AS $$
DECLARE
  v_api_url TEXT;
  v_api_secret TEXT;
BEGIN
  -- Read config from environment (set via Supabase Dashboard > Database > Extensions > Secrets)
  -- Fallback: these must be set in production
  v_api_url := current_setting('app.settings.transactional_email_url', true);
  v_api_secret := current_setting('app.settings.internal_api_secret', true);

  IF v_api_url IS NULL OR v_api_secret IS NULL THEN
    RAISE WARNING '[notify_outbid_email] Missing app.settings.transactional_email_url or internal_api_secret. Email not sent.';
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'type', 'outbid_alert',
      'payload', jsonb_build_object(
        'bidder_id', OLD.bidder_id::TEXT,
        'auction_id', OLD.auction_id::TEXT
      )
    )::TEXT,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )::JSONB
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_outbid_email
AFTER UPDATE ON public.bids
FOR EACH ROW
WHEN (OLD.status = 'active' AND NEW.status = 'outbid')
EXECUTE FUNCTION notify_outbid_email();

-- ---------------------------------------------------------------------------
-- 2. BID CONFIRMATION
-- Fires when a new bid is inserted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_bid_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  v_api_url TEXT;
  v_api_secret TEXT;
BEGIN
  v_api_url := current_setting('app.settings.transactional_email_url', true);
  v_api_secret := current_setting('app.settings.internal_api_secret', true);

  IF v_api_url IS NULL OR v_api_secret IS NULL THEN
    RAISE WARNING '[notify_bid_confirmation_email] Missing app.settings. Email not sent.';
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'type', 'bid_confirmation',
      'payload', jsonb_build_object(
        'bidder_id', NEW.bidder_id::TEXT,
        'auction_id', NEW.auction_id::TEXT,
        'amount', NEW.amount
      )
    )::TEXT,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )::JSONB
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_bid_confirmation_email
AFTER INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION notify_bid_confirmation_email();

-- ---------------------------------------------------------------------------
-- 3. WALLET DEPOSIT RECEIPT
-- Fires when a completed deposit is inserted into wallet_transactions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_deposit_receipt_email()
RETURNS TRIGGER AS $$
DECLARE
  v_api_url TEXT;
  v_api_secret TEXT;
BEGIN
  v_api_url := current_setting('app.settings.transactional_email_url', true);
  v_api_secret := current_setting('app.settings.internal_api_secret', true);

  IF v_api_url IS NULL OR v_api_secret IS NULL THEN
    RAISE WARNING '[notify_deposit_receipt_email] Missing app.settings. Email not sent.';
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'type', 'emd_receipt',
      'payload', jsonb_build_object(
        'user_id', NEW.user_id::TEXT,
        'amount', NEW.amount,
        'reference_id', COALESCE(NEW.reference_id, NEW.id::TEXT)
      )
    )::TEXT,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )::JSONB
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_deposit_receipt_email
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW
WHEN (NEW.transaction_type = 'deposit' AND NEW.status = 'completed')
EXECUTE FUNCTION notify_deposit_receipt_email();
