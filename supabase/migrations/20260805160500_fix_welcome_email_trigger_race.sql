-- =============================================================================
-- Fix Welcome Email trigger race condition by renaming the trigger to run
-- AFTER public.profiles is inserted, and passing parameters directly to the API
-- to avoid uncommitted database transaction reads.
-- =============================================================================

-- Drop the old trigger that fired prematurely due to alphabetical sorting
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Recreate function with direct parameter parsing and atomic internal updates
CREATE OR REPLACE FUNCTION public.notify_signup_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
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
  v_api_url := current_setting('app.settings.signup_email_url', true);
  
  -- Fallback: dynamically construct from transactional URL if not explicitly configured
  IF v_api_url IS NULL THEN
    v_api_url := current_setting('app.settings.transactional_email_url', true);
    IF v_api_url IS NOT NULL THEN
      v_api_url := replace(v_api_url, '/api/send-transactional-email', '/api/send-signup-email');
    END IF;
  END IF;

  v_api_secret := current_setting('app.settings.internal_api_secret', true);

  IF v_api_url IS NULL OR v_api_secret IS NULL THEN
    RAISE WARNING '[notify_signup_welcome_email] Missing app.settings.signup_email_url or internal_api_secret. Email not sent.';
    RETURN NEW;
  END IF;

  -- Mark as sent in public.profiles (atomic update within transaction)
  UPDATE public.profiles
  SET welcome_email_sent = true
  WHERE id = NEW.id;

  -- Send HTTP post with email and first_name directly to prevent DB query latency / race conditions
  PERFORM extensions.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'user_id', NEW.id::TEXT,
      'email', NEW.email,
      'first_name', COALESCE(v_first_name, '')
    )::TEXT,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )::JSONB
  );

  RETURN NEW;
END;
$$;

-- Create the new trigger with a name starting with 'trg_'
-- (Alphabetically, 'on_auth_user_created' fires first, ensuring profiles row is inserted before this trigger runs)
CREATE OR REPLACE TRIGGER trg_on_auth_user_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_signup_welcome_email();
