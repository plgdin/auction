-- ============================================================================
-- Migration 00012: FAQ Items RLS Policies
-- Enables RLS on faq_items, allowing public SELECT and restricting write operations to Admins.
-- ============================================================================

-- Ensure Row Level Security is enabled on public.faq_items
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent duplicates
DROP POLICY IF EXISTS "Anyone can view FAQs" ON public.faq_items;
DROP POLICY IF EXISTS "Admins can manage FAQs" ON public.faq_items;

-- 1. Allow anyone (authenticated or anonymous) to view FAQ items
CREATE POLICY "Anyone can view FAQs"
    ON public.faq_items
    FOR SELECT
    USING (true);

-- 2. Allow only administrators and superadministrators to write (insert, update, delete) FAQ items
CREATE POLICY "Admins can manage FAQs"
    ON public.faq_items
    FOR ALL
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
