-- Migration: Create metalmandi_live_rates table
-- 1. Create table
-- 2. Enable RLS
-- 3. Define access policies

CREATE TABLE IF NOT EXISTS public.metalmandi_live_rates (
    id TEXT PRIMARY KEY,
    metal_type TEXT NOT NULL,
    grade_name TEXT NOT NULL,
    price_per_kg NUMERIC NOT NULL,
    price_change_percent NUMERIC NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.metalmandi_live_rates ENABLE ROW LEVEL SECURITY;

-- Allow public read access (necessary for real-time customer consulting valuations)
CREATE POLICY "Allow public read access on metalmandi_live_rates" ON public.metalmandi_live_rates
    FOR SELECT USING (true);

-- Allow full access for authenticated/service role (necessary for background scraper upserts)
CREATE POLICY "Allow service role complete access on metalmandi_live_rates" ON public.metalmandi_live_rates
    FOR ALL USING (true);
