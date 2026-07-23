-- First, drop the old policy that might be failing silently
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create a secure, RLS-bypassing function to reliably check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Create the new, bulletproof policy using the function
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING ( public.is_admin() );
