-- Drop the broken SELECT policy that suffers from silent recursion filtering
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate it using the secure, recursion-free is_admin() function
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING ( public.is_admin() );
