-- Enable authenticated administrators and superadministrators to perform all operations on mstc_auctions
CREATE POLICY "Admins can manage MSTC auctions"
ON public.mstc_auctions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
);

-- Ensure Admins have full access to audit logs (in case it wasn't fully granted)
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view and manage all audit logs"
ON public.audit_logs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
);
