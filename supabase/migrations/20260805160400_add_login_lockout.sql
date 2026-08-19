-- =============================================================================
-- Login brute-force lockout columns and functions
-- =============================================================================

-- Add login tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL;

-- 1. Check if user is locked out (public anon RPC)
CREATE OR REPLACE FUNCTION public.check_login_lockout(p_email TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = auth, public
AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
BEGIN
  SELECT p.locked_until INTO v_locked_until
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE u.email = p_email;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN v_locked_until;
  END IF;

  RETURN NULL;
END;
$$;

-- 2. Increment failed logins (public anon RPC, only increments up to lockout)
CREATE OR REPLACE FUNCTION public.record_failed_login(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = auth, public
AS $$
DECLARE
  v_user_id UUID;
  v_failed_count INTEGER;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET failed_login_count = failed_login_count + 1
    WHERE id = v_user_id
    RETURNING failed_login_count INTO v_failed_count;

    IF v_failed_count >= 5 THEN
      UPDATE public.profiles
      SET locked_until = now() + interval '15 minutes'
      WHERE id = v_user_id;
    END IF;
  END IF;
END;
$$;

-- 3. Reset failed logins on successful authentication (authenticated RPC)
CREATE OR REPLACE FUNCTION public.reset_failed_logins()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET failed_login_count = 0,
      locked_until = NULL
  WHERE id = auth.uid();
END;
$$;
