-- =============================================================================
-- Migration: WhatsApp Messages Admin RLS Policies
-- Grants full read and manage access to authenticated administrators
-- =============================================================================

CREATE POLICY "Admins can view all whatsapp messages"
    ON public.whatsapp_messages
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can manage all whatsapp messages"
    ON public.whatsapp_messages
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
