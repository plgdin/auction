-- Reorder FAQ items to place the affiliation disclaimer card at the top
-- Shift existing mstc category display_orders by 1
UPDATE public.faq_items 
SET display_order = display_order + 1 
WHERE category = 'mstc' AND display_order >= 1;

-- Update the affiliation disclaimer to be at the top of 'mstc'
UPDATE public.faq_items
SET category = 'mstc', display_order = 1, question = 'Is Lelam affiliated with MSTC India or any government agency?'
WHERE question ILIKE '%affiliated%with%MSTC%';
