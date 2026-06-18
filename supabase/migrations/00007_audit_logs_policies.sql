-- ============================================================================
-- Migration 00007: Audit Logs RLS Policies
-- Enables clients to insert activity logs, while restricting read access to Admins.
-- ============================================================================

-- Ensure Row Level Security is enabled on public.audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone (authenticated or anonymous) to insert logs
CREATE POLICY "Anyone can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Allow only administrators and superadministrators to read audit logs
CREATE POLICY "Admins can view all audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles AS p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
        )
    );
