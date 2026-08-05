-- =============================================================================
-- Trigger to send welcome email when a user becomes confirmed
-- Runs after INSERT or UPDATE on auth.users
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_signup_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_api_url TEXT;
  v_api_secret TEXT;
  v_should_send BOOLEAN := false;
BEGIN
  -- Determine if welcome email should be sent (TG_OP is only accessible inside the function body)
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

  PERFORM extensions.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'user_id', NEW.id::TEXT
    )::TEXT,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_secret
    )::JSONB
  );

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to execute after confirmation or insert
CREATE OR REPLACE TRIGGER on_auth_user_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_signup_welcome_email();
