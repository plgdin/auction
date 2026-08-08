-- Change discount_percent to allow decimal values (NUMERIC)
ALTER TABLE public.promo_codes 
ALTER COLUMN discount_percent TYPE NUMERIC 
USING discount_percent::NUMERIC;
