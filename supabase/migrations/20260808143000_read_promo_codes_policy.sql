-- Allow anyone to read promo codes
CREATE POLICY "Anyone can view promo codes"
ON public.promo_codes
FOR SELECT
USING (true);
