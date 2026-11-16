-- ============================================================================
-- Migration: 20260109000000_offer_counter_negotiations.sql
-- Adds counter-offer amount, message, and counter_offered status to offers table
-- Enhances counter_offer and respond_to_offer RPCs for two-way negotiation
-- ============================================================================

alter table public.offers add column if not exists counter_amount_paise integer;
alter table public.offers add column if not exists counter_message text;
alter table public.offers add column if not exists last_counter_by text check (last_counter_by in ('seller', 'buyer'));

-- 1. Counter-offer RPC (Buyer or Seller can counter)
create or replace function public.counter_offer(
  p_offer_id uuid,
  p_counter_amount_paise integer,
  p_message text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers%rowtype;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if p_counter_amount_paise <= 0 then raise exception 'Enter a valid counter offer amount'; end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;

  if v_offer.status not in ('pending', 'counter_offered') then
    raise exception 'This offer can no longer be countered';
  end if;

  if v_offer.seller_id = v_uid then
    -- Seller counters buyer's offer
    update public.offers
    set
      status = 'counter_offered',
      counter_amount_paise = p_counter_amount_paise,
      counter_message = nullif(trim(p_message), ''),
      last_counter_by = 'seller',
      expires_at = now() + interval '48 hours'
    where id = p_offer_id;

    perform public.notify_user(
      v_offer.buyer_id,
      'offer_countered',
      'Counter-offer received',
      'The seller sent a counter-offer of ₹' || (p_counter_amount_paise / 100)::text || '.',
      jsonb_build_object('href', '#/account?tab=offers')
    );

  elsif v_offer.buyer_id = v_uid then
    -- Buyer counters seller's counter
    update public.offers
    set
      status = 'pending',
      amount_paise = p_counter_amount_paise,
      counter_amount_paise = null,
      message = nullif(trim(p_message), ''),
      last_counter_by = 'buyer',
      expires_at = now() + interval '48 hours'
    where id = p_offer_id;

    perform public.notify_user(
      v_offer.seller_id,
      'offer_countered',
      'Buyer counter-offer received',
      'The buyer sent a counter-offer of ₹' || (p_counter_amount_paise / 100)::text || '.',
      jsonb_build_object('href', '#/seller?tab=offers')
    );
  else
    raise exception 'Unauthorized to counter this offer';
  end if;
end;
$$;

revoke all on function public.counter_offer(uuid, integer, text) from public;
grant execute on function public.counter_offer(uuid, integer, text) to authenticated;

-- 2. Update respond_to_offer to support buyer accepting seller's counter offer
create or replace function public.respond_to_offer(
  p_offer_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_product public.products%rowtype;
  v_hours integer := 24;
  v_is_seller boolean;
  v_final_amount integer;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.status not in ('pending', 'counter_offered') then
    raise exception 'This offer is no longer open for responses';
  end if;

  v_is_seller := (v_offer.seller_id = v_uid);

  -- Only seller can respond to pending offers (or buyer counters)
  -- Only buyer can respond to seller's counter-offer
  if v_offer.status = 'counter_offered' and v_offer.last_counter_by = 'seller' then
    if v_offer.buyer_id <> v_uid and not public.is_admin() then
      raise exception 'Only the buyer can respond to this counter-offer';
    end if;
    v_final_amount := coalesce(v_offer.counter_amount_paise, v_offer.amount_paise);
  else
    if not v_is_seller and not public.is_admin() then
      raise exception 'Only the seller can respond to this offer';
    end if;
    v_final_amount := v_offer.amount_paise;
  end if;

  if p_accept then
    select * into v_product
    from public.products
    where id = v_offer.product_id
    for update;

    if not found or v_product.status <> 'active' then
      raise exception 'Listing is not available';
    end if;

    select coalesce((value)::text::integer, 24)
      into v_hours
    from public.platform_settings
    where key = 'offer_checkout_hours';

    update public.offers
    set status = 'accepted',
        amount_paise = v_final_amount,
        responded_at = now(),
        checkout_expires_at = now() + make_interval(hours => v_hours)
    where id = p_offer_id;

    -- Reject any other competing pending offers
    update public.offers
    set status = 'rejected', responded_at = now()
    where product_id = v_offer.product_id
      and id <> p_offer_id
      and status in ('pending', 'counter_offered');

    -- Reserve product
    update public.products
    set status = 'reserved'
    where id = v_offer.product_id;

    -- Notifications
    if v_is_seller then
      perform public.notify_user(
        v_offer.buyer_id,
        'offer_accepted',
        'Your offer was accepted',
        'The seller accepted your offer. Complete checkout before it expires.',
        jsonb_build_object('href', '#/account?tab=offers')
      );
    else
      perform public.notify_user(
        v_offer.seller_id,
        'offer_accepted',
        'Counter-offer accepted',
        'The buyer accepted your counter-offer. Product reserved for checkout.',
        jsonb_build_object('href', '#/seller?tab=offers')
      );
    end if;
  else
    update public.offers
    set status = 'rejected', responded_at = now()
    where id = p_offer_id;

    if v_is_seller then
      perform public.notify_user(
        v_offer.buyer_id,
        'offer_rejected',
        'Offer not accepted',
        'The seller passed on your offer.',
        jsonb_build_object('href', '#/account?tab=offers')
      );
    else
      perform public.notify_user(
        v_offer.seller_id,
        'offer_rejected',
        'Counter-offer declined',
        'The buyer declined your counter-offer.',
        jsonb_build_object('href', '#/seller?tab=offers')
      );
    end if;
  end if;
end;
$$;

revoke all on function public.respond_to_offer(uuid, boolean) from public;
grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;
