-- Create market_indices table
CREATE TABLE IF NOT EXISTS public.market_indices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    default_price NUMERIC NOT NULL,
    default_multiplier NUMERIC NOT NULL,
    current_price NUMERIC NOT NULL,
    current_multiplier NUMERIC NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    is_custom BOOLEAN NOT NULL DEFAULT false,
    is_pricing_disabled BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for market_indices
ALTER TABLE public.market_indices ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users (so the valuation engine can read)
CREATE POLICY "Allow authenticated read access on market_indices"
    ON public.market_indices FOR SELECT
    TO authenticated
    USING (true);

-- Allow full access for admin users
CREATE POLICY "Allow admin full access on market_indices"
    ON public.market_indices FOR ALL
    TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin'));


-- Create market_price_history table
CREATE TABLE IF NOT EXISTS public.market_price_history (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    commodity_id TEXT NOT NULL REFERENCES public.market_indices(id) ON DELETE CASCADE,
    commodity_name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    multiplier NUMERIC NOT NULL,
    updated_by TEXT NOT NULL
);

-- Enable RLS for market_price_history
ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

-- Allow read access for admin users
CREATE POLICY "Allow admin read access on market_price_history"
    ON public.market_price_history FOR SELECT
    TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin'));

-- Allow insert access for admin users
CREATE POLICY "Allow admin insert access on market_price_history"
    ON public.market_price_history FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin'));

-- Allow delete access for admin users (for wiping history)
CREATE POLICY "Allow admin delete access on market_price_history"
    ON public.market_price_history FOR DELETE
    TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin'));
