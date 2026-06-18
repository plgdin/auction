-- Fix authentication triggers and security definers
-- Ensure search_path is set to public for functions executed by triggers

-- 1. Update handle_new_user with proper search_path and explicit cast
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    'buyer'::public.user_role
  );
  RETURN new;
END;
$$;

-- 2. Update auto_create_organization with proper search_path and explicit schema
CREATE OR REPLACE FUNCTION public.auto_create_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
BEGIN
  IF NEW.organization_id IS NULL THEN
    -- Build a safe name without throwing errors on NULL
    org_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    IF org_name = '' THEN
      org_name := 'Default';
    END IF;
    org_name := org_name || ' Org';

    INSERT INTO public.organizations (name, contact_email) 
    VALUES (org_name, 'placeholder@example.com')
    RETURNING id INTO new_org_id;
    
    NEW.organization_id := new_org_id;
  END IF;
  RETURN NEW;
END;
$$;
