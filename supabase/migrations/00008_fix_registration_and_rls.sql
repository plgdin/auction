-- ============================================================================
-- Migration 00008: Fix Registration & Organization RLS Policies
-- Enables the signup trigger and client to successfully create and link organizations.
-- ============================================================================

-- Ensure Row Level Security is active on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 1. Allow anyone to insert organizations during signup
DROP POLICY IF EXISTS "Allow anon/authenticated insertion" ON public.organizations;
CREATE POLICY "Allow anon/authenticated insertion" ON public.organizations
    FOR INSERT
    WITH CHECK (true);

-- 2. Allow users to view their own organization
DROP POLICY IF EXISTS "Allow users to view their own organization" ON public.organizations;
CREATE POLICY "Allow users to view their own organization" ON public.organizations
    FOR SELECT
    USING (
        id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

-- 3. Allow users to update their own organization
DROP POLICY IF EXISTS "Allow users to update their own organization" ON public.organizations;
CREATE POLICY "Allow users to update their own organization" ON public.organizations
    FOR UPDATE
    USING (
        id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

-- 4. Ensure profiles allows inserts for the trigger role
DROP POLICY IF EXISTS "Allow anon/authenticated insertion on profiles" ON public.profiles;
CREATE POLICY "Allow anon/authenticated insertion on profiles" ON public.profiles
    FOR INSERT
    WITH CHECK (true);

-- 5. Re-create the signup trigger function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    'buyer' -- default role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Re-create the auto-organization function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.auto_create_organization()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  IF NEW.organization_id IS NULL THEN
    INSERT INTO public.organizations (name, contact_email) 
    VALUES (COALESCE(NEW.first_name || ' ' || NEW.last_name || ' Org', 'Default Org'), 'placeholder@example.com')
    RETURNING id INTO new_org_id;
    
    NEW.organization_id := new_org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
