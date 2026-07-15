-- Migration: Update get_mstc_filter_options to read categories from category_daily_stats
-- Even if an auction is out of the system, the category information remains

CREATE OR REPLACE FUNCTION get_mstc_filter_options()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'categories', (
      SELECT coalesce(json_agg(DISTINCT split_part(category_name, ' | ', 1)), '[]'::json) 
      FROM category_daily_stats 
      WHERE category_name IS NOT NULL
    ),
    'subcategories', (
      SELECT coalesce(json_object_agg(main_cat, subcats), '{}'::json) 
      FROM (
        SELECT split_part(category_name, ' | ', 1) as main_cat, json_agg(DISTINCT split_part(category_name, ' | ', 2)) as subcats
        FROM category_daily_stats
        WHERE category_name LIKE '% | %'
        GROUP BY split_part(category_name, ' | ', 1)
      ) t
    ),
    'sellers', (
      SELECT coalesce(json_agg(DISTINCT seller_name), '[]'::json) 
      FROM mstc_auctions 
      WHERE asset_status = 'completed' AND seller_name IS NOT NULL
    ),
    'locations', (
      SELECT coalesce(json_agg(DISTINCT location), '[]'::json) 
      FROM mstc_auctions 
      WHERE asset_status = 'completed' AND location IS NOT NULL
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
