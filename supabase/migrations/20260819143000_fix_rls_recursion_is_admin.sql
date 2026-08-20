-- Migration: Fix RLS Infinite Recursion using SECURITY DEFINER is_admin() function
-- Resolves HTTP 500 errors when fetching audit_logs, mstc_auctions, and scraper tables.

-- 1. Ensure public.is_admin() is robust, SECURITY DEFINER, with clean search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execution to authenticated & anon
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- 2. Fix audit_logs RLS Policies (Drop direct subquery policies that cause 500 recursion)
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view and manage all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow service role full access on audit_logs" ON public.audit_logs;

-- Allow insert by any authenticated user or service
CREATE POLICY "Anyone can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Allow admins to view and manage audit logs via is_admin()
CREATE POLICY "Admins can view and manage all audit logs"
    ON public.audit_logs
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Allow service role full access
CREATE POLICY "Allow service role full access on audit_logs"
    ON public.audit_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Fix mstc_auctions RLS Policies
DROP POLICY IF EXISTS "Admins can manage MSTC auctions" ON public.mstc_auctions;
CREATE POLICY "Admins can manage MSTC auctions"
    ON public.mstc_auctions
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. Fix gem_auctions RLS Policies
DROP POLICY IF EXISTS "Allow admin access on GeM auctions" ON public.gem_auctions;
CREATE POLICY "Allow admin access on GeM auctions"
    ON public.gem_auctions
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. Fix gem_bids RLS Policies
DROP POLICY IF EXISTS "Allow admin access on GeM bids" ON public.gem_bids;
CREATE POLICY "Allow admin access on GeM bids"
    ON public.gem_bids
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Fix baanknet_auctions RLS Policies
DROP POLICY IF EXISTS "Allow admin access on BaankNet auctions" ON public.baanknet_auctions;
CREATE POLICY "Allow admin access on BaankNet auctions"
    ON public.baanknet_auctions
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
