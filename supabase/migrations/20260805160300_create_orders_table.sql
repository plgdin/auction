-- =============================================================================
-- Create orders table to prevent payment replay / double redemption attacks
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(255) PRIMARY KEY, -- razorpay order_id
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id VARCHAR(100) NOT NULL,
    billing_cycle VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'created', -- 'created', 'verified'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Select policy: Users can select their own orders
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin policy: Admins can do everything
CREATE POLICY "Admins can manage all orders" ON public.orders
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles AS p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
        )
    );
