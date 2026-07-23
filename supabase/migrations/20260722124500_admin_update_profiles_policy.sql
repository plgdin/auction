-- Add policy to allow admins to update all user profiles
-- This is required so admins can change user roles from the User Management dashboard

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
  );
