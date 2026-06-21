-- ============================================================================
-- Migration 00014: Fix Infinite Recursion in Profiles Policy
-- Replaces the recursive RLS policy with a SECURITY DEFINER function.
-- ============================================================================

-- Drop the recursive policy from migration 000051
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a security definer function to check admin status without triggering RLS on profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the policy using the security definer function to break the infinite loop
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING ( public.is_admin() );
