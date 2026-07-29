-- Migration: Prevent non-admin users from modifying their own or other users' roles in the profiles table.
-- This mitigates privilege escalation / Broken Authorization Check vulnerabilities.

CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the role is being changed
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- If the update is triggered by a client session (auth.uid() is set)
    IF auth.uid() IS NOT NULL THEN
      -- Only allow the update if the executing user has admin or superadmin privileges
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
      ) THEN
        RAISE EXCEPTION 'Access Denied: You do not have permissions to modify user roles.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS enforce_profile_role_update ON public.profiles;

-- Create trigger
CREATE TRIGGER enforce_profile_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_role_update();
