-- ============================================================================
-- lelam.co — remaining gaps: proxy bidding, courier, tax, messaging queue
-- Apply AFTER 20260104000000_thrift_backend_gaps.sql.
-- ============================================================================

-- =========================================================
-- 1. PROXY BIDDING
-- =========================================================
create or replace function public.set_proxy_bid(p_auction_id uuid, p_max_amount_paise integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in to continue.'; end if;
  insert into public.auction_proxy_bids (auction_id, bidder_id, max_amount_paise, active)
  values (p_auction_id, v_uid, p_max_amount_paise, true)
  on conflict (auction_id, bidder_id) do update
    set max_amount_paise = excluded.max_amount_paise, active = true;
end;
$$;

create or replace function public.place_proxy_bid(p_auction_id uuid, p_bidder_id uuid, p_amount_paise integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon integer;
  v_city text;
begin
  select coalesce(max(anonymous_number), 1000) + 1 into v_anon
  from public.bids where auction_id = p_auction_id;
  select coalesce((select city from public.addresses where user_id = p_bidder_id and is_default limit 1), 'Trivandrum')
  into v_city;

  insert into public.bids (auction_id, bidder_id, amount_paise, anonymous_number, bidder_city)
  values (p_auction_id, p_bidder_id, p_amount_paise, v_anon, v_city);

  update public.auctions
  set current_bid_paise = p_amount_paise,
      highest_bidder_id = p_bidder_id,
      bid_count = bid_count + 1,
      min_increment_paise = public.auction_increment_paise(p_amount_paise)
  where id = p_auction_id;
end;
$$;

create or replace function public.run_proxy_bids(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_proxy record;
  v_increment integer;
  v_target integer;
  v_iterations integer := 0;
begin
  loop
    v_iterations := v_iterations + 1;
    if v_iterations > 20 then exit; end if;

    select * into v_auction from public.auctions where id = p_auction_id for update;
    if v_auction.status <> 'live' then exit; end if;

    -- Find a competing proxy (not the current highest bidder) with capacity.
    select pb.bidder_id, pb.max_amount_paise into v_proxy
    from public.auction_proxy_bids pb
    where pb.auction_id = p_auction_id
      and pb.active = true
      and pb.bidder_id <> coalesce(v_auction.highest_bidder_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and pb.max_amount_paise > coalesce(v_auction.current_bid_paise, v_auction.starting_price_paise - 1)
    order by pb.max_amount_paise desc
    limit 1;

    if v_proxy is null then exit; end if;

    v_increment := public.auction_increment_paise(coalesce(v_auction.current_bid_paise, v_auction.starting_price_paise));
    v_target := coalesce(v_auction.current_bid_paise, v_auction.starting_price_paise - v_increment) + v_increment;

    -- If the current highest bidder also has a proxy, cap at their max + increment.
    if v_auction.highest_bidder_id is not null then
      declare
        v_other_max integer;
      begin
        select max_amount_paise into v_other_max
        from public.auction_proxy_bids
        where auction_id = p_auction_id and bidder_id = v_auction.highest_bidder_id and active = true;
        if v_other_max is not null and v_target > v_other_max then
          v_target := v_other_max + v_increment;
        end if;
      end;
    end if;

    if v_target > v_proxy.max_amount_paise then
      -- Cannot outbid; deactivate this proxy.
      update public.auction_proxy_bids set active = false
      where auction_id = p_auction_id and bidder_id = v_proxy.bidder_id;
      exit;
    end if;

    if v_target < v_auction.starting_price_paise then
      v_target := v_auction.starting_price_paise;
    end if;

    perform public.place_proxy_bid(p_auction_id, v_proxy.bidder_id, v_target);
  end loop;
end;
$$;

-- Trigger to run proxy bids after a manual bid.
create or replace function public.trg_run_proxy_bids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.run_proxy_bids(NEW.auction_id);
  return NEW;
end;
$$;

drop trigger if exists bids_after_insert_proxy on public.bids;
create trigger bids_after_insert_proxy
after insert on public.bids
for each row execute function public.trg_run_proxy_bids();

-- =========================================================
-- 2. COURIER LOGISTICS
-- =========================================================
alter table public.shipments add column if not exists weight_grams integer;
alter table public.shipments add column if not exists length_cm integer;
alter table public.shipments add column if not exists width_cm integer;
alter table public.shipments add column if not exists height_cm integer;
alter table public.shipments add column if not exists courier_rate_paise integer;
alter table public.shipments add column if not exists ndr_count integer not null default 0;
alter table public.shipments add column if not exists pickup_booked_at timestamptz;
alter table public.shipments add column if not exists label_url text;

create or replace function public.check_serviceability(p_origin_pincode text, p_dest_pincode text)
returns boolean
language sql
stable
as $$
  select true;
$$;

create or replace function public.book_courier_pickup(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_awb text;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.seller_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the seller can book pickup.';
  end if;

  v_awb := 'LM' || to_char(now(), 'YYMMDD') || lpad((floor(random()*100000))::text, 5, '0');

  insert into public.shipments (order_id, provider, status, awb, label_url, pickup_booked_at)
  values (p_order_id, 'shiprocket', 'pickup_scheduled', v_awb,
          'https://example.com/labels/' || v_awb || '.pdf', now())
  on conflict (order_id) do update set
    provider = coalesce(excluded.provider, shipments.provider),
    status = 'pickup_scheduled',
    awb = coalesce(excluded.awb, shipments.awb),
    label_url = coalesce(excluded.label_url, shipments.label_url),
    pickup_booked_at = coalesce(shipments.pickup_booked_at, now()),
    updated_at = now();

  perform public.advance_shipment(p_order_id, 'pickup_scheduled', 'shiprocket', v_awb, null, 'Pickup booked');
  return v_awb;
end;
$$;

create or replace function public.ingest_courier_event(
  p_provider text,
  p_awb text,
  p_event_type text,
  p_raw jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_status text;
begin
  select order_id into v_order_id from public.shipments where awb = p_awb limit 1;

  insert into public.courier_events (provider, awb, order_id, event_type, raw_payload, processed)
  values (p_provider, p_awb, v_order_id, p_event_type, p_raw, false);

  v_status := case p_event_type
    when 'pickup_scheduled' then 'pickup_scheduled'
    when 'picked_up' then 'picked_up'
    when 'in_transit' then 'in_transit'
    when 'out_for_delivery' then 'out_for_delivery'
    when 'delivered' then 'delivered'
    when 'rto_initiated' then 'returned'
    else null
  end;

  if v_order_id is not null and v_status is not null then
    perform public.advance_shipment(v_order_id, v_status, p_provider, p_awb, null, p_event_type);
    update public.courier_events set processed = true
    where provider = p_provider and awb = p_awb and event_type = p_event_type;
  end if;

  if p_event_type = 'ndr' and v_order_id is not null then
    update public.shipments set ndr_count = ndr_count + 1 where order_id = v_order_id;
  end if;
end;
$$;

-- =========================================================
-- 3. TAX & COMPLIANCE
-- =========================================================
alter table public.seller_profiles add column if not exists pan_number text;
alter table public.seller_profiles add column if not exists gst_number text;
alter table public.seller_profiles add column if not exists annual_gross_paise bigint not null default 0;

create table if not exists public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  auction_id uuid references public.auctions(id) on delete set null,
  invoice_number text not null unique,
  platform_fee_paise integer not null default 0,
  gst_paise integer not null default 0,
  total_paise integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists platform_invoices_seller_idx on public.platform_invoices (seller_id, created_at desc);

create table if not exists public.tds_ledger (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  financial_year text not null,
  gross_paise bigint not null default 0,
  tds_paise bigint not null default 0,
  pan_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, financial_year)
);

create or replace function public.generate_platform_invoice(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_settlement public.seller_settlements;
  v_invoice_id uuid;
  v_fee integer;
  v_gst integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found.'; end if;
  select * into v_settlement from public.seller_settlements where order_id = p_order_id limit 1;
  v_fee := coalesce(v_settlement.platform_commission_paise, 1000);
  v_gst := (v_fee * 18) / 100;

  insert into public.platform_invoices (seller_id, order_id, auction_id, invoice_number, platform_fee_paise, gst_paise, total_paise)
  values (v_order.seller_id, p_order_id, v_order.auction_id,
          'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(p_order_id::text, 1, 8),
          v_fee, v_gst, v_fee + v_gst)
  returning id into v_invoice_id;

  -- Track seller annual gross for TDS 194-O.
  update public.seller_profiles
  set annual_gross_paise = annual_gross_paise + v_order.total_paise
  where user_id = v_order.seller_id;

  return v_invoice_id;
end;
$$;

-- =========================================================
-- 4. MESSAGING QUEUE (WhatsApp / SMS)
-- =========================================================
create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('sms', 'email')),
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  provider_reference text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists outbound_messages_status_idx on public.outbound_messages (status, created_at);

-- =========================================================
-- 5. GRANTS
-- =========================================================
revoke all on function public.set_proxy_bid(uuid, integer) from public;
grant execute on function public.set_proxy_bid(uuid, integer) to authenticated;
revoke all on function public.book_courier_pickup(uuid) from public;
grant execute on function public.book_courier_pickup(uuid) to authenticated;
revoke all on function public.ingest_courier_event(text, text, text, jsonb) from public;
grant execute on function public.ingest_courier_event(text, text, text, jsonb) to authenticated;
revoke all on function public.generate_platform_invoice(uuid) from public;
grant execute on function public.generate_platform_invoice(uuid) to authenticated;
