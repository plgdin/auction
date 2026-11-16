-- ============================================================================
-- lelam.co — security and wiring fixes
-- Apply AFTER 20260105000000_remaining_gaps.sql.
-- ============================================================================

-- 1. SECURE ALL UNPROTECTED TABLES WITH RLS
alter table public.auction_proxy_bids enable row level security;
drop policy if exists proxy_bids_owner on public.auction_proxy_bids;
create policy proxy_bids_owner on public.auction_proxy_bids
for all to authenticated
using (bidder_id = auth.uid() or public.is_admin())
with check (bidder_id = auth.uid() or public.is_admin());
grant select, insert, update, delete on public.auction_proxy_bids to authenticated;

alter table public.second_chance_offers enable row level security;
drop policy if exists second_chance_parties on public.second_chance_offers;
create policy second_chance_parties on public.second_chance_offers
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
grant select on public.second_chance_offers to authenticated;

alter table public.bidder_penalties enable row level security;
drop policy if exists penalties_owner on public.bidder_penalties;
create policy penalties_owner on public.bidder_penalties
for select to authenticated
using (user_id = auth.uid() or public.is_admin());
grant select on public.bidder_penalties to authenticated;

alter table public.platform_invoices enable row level security;
drop policy if exists invoices_seller on public.platform_invoices;
create policy invoices_seller on public.platform_invoices
for select to authenticated
using (seller_id = auth.uid() or public.is_admin());
grant select on public.platform_invoices to authenticated;

alter table public.tds_ledger enable row level security;
drop policy if exists tds_seller on public.tds_ledger;
create policy tds_seller on public.tds_ledger
for select to authenticated
using (seller_id = auth.uid() or public.is_admin());
grant select on public.tds_ledger to authenticated;

alter table public.outbound_messages enable row level security;
drop policy if exists outbound_admin on public.outbound_messages;
create policy outbound_admin on public.outbound_messages
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select, insert on public.outbound_messages to authenticated;

alter table public.courier_events enable row level security;
drop policy if exists courier_events_admin on public.courier_events;
create policy courier_events_admin on public.courier_events
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select on public.courier_events to authenticated;

-- Enforce SMS / Email channels only (no WhatsApp)
alter table public.outbound_messages drop constraint if exists outbound_messages_channel_check;
alter table public.outbound_messages
  add constraint outbound_messages_channel_check
  check (channel in ('sms', 'email'));

-- 2. GRANT SELLER PROFILE TAX UPDATES
grant update (display_name, bio, location, pickup_address, pickup_phone, pan_number, gst_number)
  on public.seller_profiles to authenticated;

-- 3. UPDATE PUBLIC_PRODUCTS VIEW WITH THRIFT FIELDS
drop view if exists public.public_products cascade;

create view public.public_products
with (security_invoker = false)
as
select
  p.id,
  p.seller_id,
  pp.full_name as seller_name,
  pp.avatar_url as seller_avatar,
  c.name as category,
  p.title,
  p.description,
  p.brand,
  p.condition,
  p.asking_price_paise as asking_price,
  p.size,
  p.quantity,
  p.is_unique,
  p.location,
  p.shipping_fee_paise as shipping_fee,
  p.status,
  p.allow_offers,
  p.auction_consent,
  p.tag,
  p.color,
  p.view_count as views,
  p.measurements,
  p.flaws,
  p.has_flaws,
  p.gender,
  p.fit,
  p.country_of_origin,
  p.weight_grams,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  case
    when p.seller_id = auth.uid() or public.is_admin() then p.moderation_note
    else null
  end as moderation_note,
  p.created_at,
  coalesce(
    (
      select array_agg(pi.url order by pi.sort_order)
      from public.product_images pi
      where pi.product_id = p.id
    ),
    '{}'::text[]
  ) as images,
  coalesce(
    (
      select round(avg(r.rating)::numeric, 1)
      from public.reviews r
      where r.seller_id = p.seller_id
    ),
    0
  ) as seller_rating,
  (
    select count(*)::int
    from public.reviews r
    where r.seller_id = p.seller_id
  ) as seller_review_count
from public.products p
join public.profiles pp on pp.id = p.seller_id
left join public.categories c on c.id = p.category_id
where (pp.is_blocked = false or p.seller_id = auth.uid() or public.is_admin())
  and (
    p.status in ('active', 'reserved')
    or p.seller_id = auth.uid()
    or public.is_admin()
  );

grant select on public.public_products to anon, authenticated;

-- 4. UPDATE SAVE_LISTING TO STORE THRIFT FIELDS
create or replace function public.save_listing(
  p_payload jsonb,
  p_images text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_seller uuid;
  v_category integer;
  v_auto boolean := true;
  v_slug text;
  v_title text := trim(coalesce(p_payload->>'title', ''));
  v_description text := trim(coalesce(p_payload->>'description', ''));
  v_price integer := coalesce((p_payload->>'asking_price_paise')::integer, 0);
  v_quantity integer := greatest(1, coalesce((p_payload->>'quantity')::integer, 1));
  v_condition text := lower(replace(coalesce(p_payload->>'condition', 'good'), ' ', '_'));
  v_status text;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  if not exists (
    select 1 from public.profiles
    where id = v_uid and not is_blocked and (is_seller or role = 'admin')
  ) then raise exception 'Seller account required'; end if;

  if v_title = '' or v_description = '' or v_price <= 0 then
    raise exception 'Title, description and price are required';
  end if;

  if coalesce(array_length(p_images, 1), 0) = 0 then
    raise exception 'Add at least one photo';
  end if;

  select coalesce((value)::text::boolean, true) into v_auto
  from public.platform_settings where key = 'seller_auto_approve';
  v_auto := coalesce(v_auto, true);

  select id into v_category from public.categories
  where lower(name) = lower(coalesce(p_payload->>'category', 'Other')) limit 1;
  if v_category is null then
    select id into v_category from public.categories where slug = 'other';
  end if;

  v_status := case when v_auto then 'active' else 'pending' end;

  if v_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'))
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.products (
      seller_id, category_id, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location,
      shipping_fee_paise, status, allow_offers, auction_consent, published_at,
      measurements, flaws, has_flaws, gender, fit, country_of_origin,
      weight_grams, length_cm, width_cm, height_cm
    )
    values (
      v_uid, v_category, v_title, v_slug, v_description,
      nullif(p_payload->>'brand', ''), v_condition, v_price,
      nullif(p_payload->>'size', ''), v_quantity, v_quantity = 1,
      coalesce(nullif(p_payload->>'location', ''), 'Trivandrum, Kerala'),
      greatest(0, coalesce((p_payload->>'shipping_fee_paise')::integer, 4900)),
      v_status,
      coalesce((p_payload->>'allow_offers')::boolean, true),
      coalesce((p_payload->>'auction_consent')::boolean, false),
      case when v_auto then now() else null end,
      coalesce(p_payload->'measurements', '{}'::jsonb),
      coalesce(p_payload->'flaws', '[]'::jsonb),
      coalesce((p_payload->>'has_flaws')::boolean, false),
      nullif(p_payload->>'gender', ''),
      nullif(p_payload->>'fit', ''),
      nullif(p_payload->>'country_of_origin', ''),
      (p_payload->>'weight_grams')::integer,
      (p_payload->>'length_cm')::integer,
      (p_payload->>'width_cm')::integer,
      (p_payload->>'height_cm')::integer
    )
    returning id into v_id;
  else
    select seller_id into v_seller from public.products where id = v_id for update;
    if v_seller is null then raise exception 'Listing not found'; end if;
    if v_seller <> v_uid and not public.is_admin() then raise exception 'Not your listing'; end if;

    update public.products set
      category_id = v_category,
      title = v_title,
      description = v_description,
      brand = nullif(p_payload->>'brand', ''),
      condition = v_condition,
      asking_price_paise = v_price,
      size = nullif(p_payload->>'size', ''),
      quantity = v_quantity,
      is_unique = (v_quantity = 1),
      location = coalesce(nullif(p_payload->>'location', ''), location),
      shipping_fee_paise = greatest(0, coalesce((p_payload->>'shipping_fee_paise')::integer, shipping_fee_paise)),
      allow_offers = coalesce((p_payload->>'allow_offers')::boolean, allow_offers),
      auction_consent = coalesce((p_payload->>'auction_consent')::boolean, auction_consent),
      measurements = coalesce(p_payload->'measurements', measurements),
      flaws = coalesce(p_payload->'flaws', flaws),
      has_flaws = coalesce((p_payload->>'has_flaws')::boolean, has_flaws),
      gender = coalesce(nullif(p_payload->>'gender', ''), gender),
      fit = coalesce(nullif(p_payload->>'fit', ''), fit),
      country_of_origin = coalesce(nullif(p_payload->>'country_of_origin', ''), country_of_origin),
      weight_grams = coalesce((p_payload->>'weight_grams')::integer, weight_grams),
      length_cm = coalesce((p_payload->>'length_cm')::integer, length_cm),
      width_cm = coalesce((p_payload->>'width_cm')::integer, width_cm),
      height_cm = coalesce((p_payload->>'height_cm')::integer, height_cm),
      moderation_note = null
    where id = v_id;

    delete from public.product_images where product_id = v_id;
  end if;

  insert into public.product_images (product_id, url, sort_order)
  select v_id, u, (ord - 1)::integer
  from unnest(p_images) with ordinality as t(u, ord);

  return v_id;
end;
$$;

-- 5. CANCEL PROXY BID
create or replace function public.cancel_proxy_bid(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  update public.auction_proxy_bids set active = false
  where auction_id = p_auction_id and bidder_id = auth.uid();
end;
$$;
grant execute on function public.cancel_proxy_bid(uuid) to authenticated;

-- 6. ADMIN DISPUTE RESOLUTION
create or replace function public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_status text,
  p_admin_notes text default null,
  p_refund_buyer boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.order_disputes;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  select * into v_dispute from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'Dispute not found.'; end if;

  update public.order_disputes
  set status = p_status, admin_notes = p_admin_notes, resolved_at = now()
  where id = p_dispute_id;

  if p_refund_buyer or p_status in ('approved_refund', 'approved_return') then
    update public.orders set payment_status = 'refunded', status = 'returned' where id = v_dispute.order_id;
    update public.seller_settlements set status = 'on_hold', payout_status = 'failed' where order_id = v_dispute.order_id;
  elsif p_status = 'rejected' then
    -- Unfreeze escrow
    update public.seller_settlements set eligible_at = now() where order_id = v_dispute.order_id;
  end if;

  perform public.log_audit('dispute.resolved', 'order_dispute', p_dispute_id::text,
    jsonb_build_object('status', p_status, 'refund', p_refund_buyer));
end;
$$;
grant execute on function public.admin_resolve_dispute(uuid, text, text, boolean) to authenticated;

-- 7. INCLUDE AUCTION START/CLOSE IN RUN_MAINTENANCE
create or replace function public.run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started integer;
  v_closed integer;
  v_orders integer;
  v_offers integer;
  v_auctions integer;
begin
  v_started := public.auto_start_auctions();
  v_closed := public.auto_close_auctions();
  v_orders := public.expire_unpaid_orders();
  v_offers := public.expire_offers();
  v_auctions := public.expire_unpaid_auctions();

  return jsonb_build_object(
    'auctionsStarted', v_started,
    'auctionsClosed', v_closed,
    'expiredOrders', v_orders,
    'expiredOffers', v_offers,
    'expiredAuctions', v_auctions
  );
end;
$$;

