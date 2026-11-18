-- =========================================================
-- Auction money + timing alignment with the frontend
-- =========================================================
-- Seller commission: 10% of the full winning bid, GST inclusive.
-- Winner payment deadline: 5 minutes after the auction closes.
-- Anti-snipe: a bid in the last 30 seconds extends the auction by 30 seconds.
-- =========================================================

-- =========================================================
-- 1. SETTINGS
-- =========================================================
insert into public.platform_settings (key, value, description)
values
  ('platform_commission_pct', '10'::jsonb, 'Seller commission on the full winning bid (GST inclusive)'),
  ('auction_payment_deadline_minutes', '5'::jsonb, 'Winner payment deadline in minutes'),
  ('auction_anti_snipe_seconds', '30'::jsonb, 'Extension length in seconds'),
  ('auction_anti_snipe_trigger_seconds', '30'::jsonb, 'A bid inside this window triggers anti-sniping')
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

-- =========================================================
-- 2. PAYMENT DEADLINE FUNCTION
-- =========================================================
-- Winner must pay within the configured minutes (fallback 5).
-- p_ends_at is kept for signature compatibility but is no longer used.
-- The function now reads platform_settings, so it must be stable (not immutable).
create or replace function public.auction_payment_deadline(p_ends_at timestamptz)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_minutes integer;
begin
  select nullif(value #>> '{}', '')::integer
  into v_minutes
  from public.platform_settings
  where key = 'auction_payment_deadline_minutes';

  return now() + make_interval(mins => coalesce(v_minutes, 5));
end;
$$;

grant execute on function public.auction_payment_deadline(timestamptz) to anon, authenticated;

-- =========================================================
-- 3. LEGACY SELLER COMMISSION HELPERS
-- =========================================================
-- platform_fee_paise is the SELLER COMMISSION helper used by seller
-- settlements, not the flat Rs.10 buyer platform fee. It now returns
-- 10% of the subtotal (GST inclusive), rounded down to paise.
create or replace function public.platform_fee_paise(p_subtotal_paise integer)
returns integer
language sql
immutable
as $$
  select floor(greatest(0, coalesce(p_subtotal_paise, 0))::numeric * 10 / 100)::integer;
$$;

-- Seller payout = subtotal minus the 10% GST-inclusive seller commission.
create or replace function public.seller_payout_paise(p_subtotal_paise integer)
returns integer
language sql
immutable
as $$
  select greatest(0, coalesce(p_subtotal_paise, 0) - public.platform_fee_paise(p_subtotal_paise));
$$;

grant execute on function public.platform_fee_paise(integer) to anon, authenticated;
grant execute on function public.seller_payout_paise(integer) to anon, authenticated;
