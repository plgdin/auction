-- Migration: Add location_daily_stats table for region-centric analytics
-- Companion to category_daily_stats, adding a location dimension

CREATE TABLE IF NOT EXISTS location_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    location TEXT NOT NULL,
    category_name TEXT NOT NULL,
    items_added INTEGER DEFAULT 0,
    UNIQUE(date, location, category_name)
);

-- Enable RLS
ALTER TABLE location_daily_stats ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone
CREATE POLICY "Allow read access to location_daily_stats" ON location_daily_stats
    FOR SELECT USING (true);

-- Allow service role full access for background worker writes
CREATE POLICY "Allow service role write to location_daily_stats" ON location_daily_stats
    FOR ALL USING (true);

-- RPC function to get location-centric analytics (auction distribution by region + category)
CREATE OR REPLACE FUNCTION get_location_analytics()
RETURNS TABLE(location TEXT, category_name TEXT, total_auctions BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        COALESCE(m.location, 'India') as location,
        COALESCE(m.category_name, 'Uncategorized') as category_name,
        COUNT(*) as total_auctions
    FROM mstc_auctions m
    WHERE m.asset_status = 'completed'
    GROUP BY m.location, m.category_name
    ORDER BY total_auctions DESC;
$$;

-- RPC function to get daily location trends (for time-series charts)
CREATE OR REPLACE FUNCTION get_location_daily_trends(
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE(date DATE, location TEXT, items_added BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        s.date,
        s.location,
        SUM(s.items_added)::BIGINT as items_added
    FROM location_daily_stats s
    WHERE s.date >= CURRENT_DATE - p_days
    GROUP BY s.date, s.location
    ORDER BY s.date ASC, items_added DESC;
$$;
