CREATE TABLE IF NOT EXISTS category_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    category_name TEXT NOT NULL,
    items_added INTEGER DEFAULT 0,
    UNIQUE(date, category_name)
);

-- Enable RLS
ALTER TABLE category_daily_stats ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone (or authenticated users)
CREATE POLICY "Allow read access to category_daily_stats" ON category_daily_stats
    FOR SELECT USING (true);

-- Create a highly optimized RPC function to get current totals without 1000 row limit
CREATE OR REPLACE FUNCTION get_current_category_totals()
RETURNS TABLE(category_name TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        COALESCE(category_name, 'Uncategorized') as category_name, 
        COUNT(*) as count 
    FROM mstc_auctions 
    GROUP BY COALESCE(category_name, 'Uncategorized')
    ORDER BY count DESC;
$$;
