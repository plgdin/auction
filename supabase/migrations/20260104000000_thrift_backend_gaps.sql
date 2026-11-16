-- ============================================================================
-- lelam.co — thrift backend gaps (escrow, payouts, disputes, cataloging, worker)
-- Apply AFTER 20260103000000_auction_engine.sql.
-- ============================================================================

-- =========================================================
-- 1. THRIFT-SPECIFIC CATALOGING
-- =========================================================
alter table public.products add column if not exists measurements jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists flaws jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists has_flaws boolean not null default false;
alter table public.products add column if not exists gender text;
alter table public.products add column if not exists fit text;
alter table public.products add column if not exists country_of_origin text;
alter table public.products add column if not exists weight_grams integer;
alter table public.products add column if not exists length_cm integer;
alter table public.products add column if not exists width_cm integer;
alter table public.products add column if not exists height_cm integer;

-- Refine condition scale (keep legacy values).
alter table public.products drop constraint if exists products_condition_check;
alter table public.products
  add constraint products_condition_check
  check (condition in ('new', 'like_new', 'good', 'fair', 'brand_new_with_tags', 'gently_used', 'well_worn'));

-- =========================================================
-- 2. SELLER PAYOUT METHODS
-- =========================================================
create table if not exists public.seller_payout_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method_type text not null check (method_type in ('upi', 'bank_account')),
  upi_vpa text,
  account_number text,
  ifsc_code text,
  account_holder_name text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  penny_drop_reference text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists seller_payout_methods_user_idx on public.seller_payout_methods (user_id);

alter table public.seller_payout_methods enable row level security;
create policy seller_payout_methods_owner on public.seller_payout_methods
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());
grant select, insert, update, delete on public.seller_payout_methods to authenticated;

-- =========================================================
-- 3. ESCROW ON SETTLEMENTS
-- =========================================================
alter table public.seller_settlements
  add column if not exists eligible_at timestamptz;
alter table public.seller_settlements
  add column if not exists payout_reference text;
alter table public.seller_settlements
  add column if not exists payout_status text not null default 'pending'
  check (payout_status in ('pending', 'queued', 'processing', 'paid', 'failed'));

-- =========================================================
-- 4. SNAD DISPUTE WORKFLOW
-- =========================================================
create table if not exists public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (reason in (
    'not_as_described', 'fake_counterfeit', 'wrong_item',
    'undisclosed_damage', 'package_empty', 'item_not_received'
  )),
  description text not null,
  photo_evidence text[] not null default '{}'::text[],
  unboxing_video_url text,
  status text not null default 'opened'
    check (status in ('opened', 'seller_response', 'under_review', 'approved_refund',
                      'approved_return', 'rejected')),
  seller_response text,
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists order_disputes_order_idx on public.order_disputes (order_id, status);

alter table public.order_disputes enable row level security;
create policy order_disputes_parties on public.order_disputes
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy order_disputes_buyer_insert on public.order_disputes
for insert to authenticated
with check (buyer_id = auth.uid());
grant select, insert on public.order_disputes to authenticated;
revoke update, delete on public.order_disputes from anon, authenticated;

-- =========================================================
-- 5. COURIER EVENT LOG (webhook ingestion)
-- =========================================================
create table if not exists public.courier_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  awb text,
  order_id uuid references public.orders(id) on delete set null,
  event_type text not null,
  raw_payload jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists courier_events_awb_idx on public.courier_events (provider, awb, created_at desc);

-- =========================================================
-- 6. ESCROW-AWARE SHIPMENT ADVANCE (override)
-- =========================================================
create or replace function public.advance_shipment(
  p_order_id uuid,
  p_status text,
  p_provider text default null,
  p_awb text default null,
  p_tracking_url text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_shipment public.shipments;
  v_order_status text;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;

  if v_order.seller_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the seller can update shipment';
  end if;

  if p_status not in (
    'pending_pickup', 'pickup_scheduled', 'picked_up', 'in_transit',
    'out_for_delivery', 'delivered', 'failed', 'returned'
  ) then
    raise exception 'Invalid shipment status';
  end if;

  insert into public.shipments (order_id, provider, status, awb, tracking_url)
  values (p_order_id, p_provider, p_status, p_awb, p_tracking_url)
  on conflict (order_id) do update set
    provider = coalesce(excluded.provider, shipments.provider),
    status = excluded.status,
    awb = coalesce(excluded.awb, shipments.awb),
    tracking_url = coalesce(excluded.tracking_url, shipments.tracking_url),
    updated_at = now()
  returning * into v_shipment;

  insert into public.shipment_events (shipment_id, status, note, created_by)
  values (v_shipment.id, p_status, coalesce(p_note, ''), auth.uid());

  v_order_status := case p_status
    when 'pickup_scheduled' then 'awaiting_pickup'
    when 'picked_up' then 'processing'
    when 'in_transit' then 'shipped'
    when 'out_for_delivery' then 'shipped'
    when 'delivered' then 'delivered'
    when 'returned' then 'returned'
    else v_order.status
  end;

  update public.orders
  set status = v_order_status
  where id = p_order_id;

  -- Escrow: start 48-hour inspection window on delivery.
  if p_status = 'delivered' then
    update public.seller_settlements
    set eligible_at = now() + interval '48 hours'
    where order_id = p_order_id and eligible_at is null;
  end if;

  perform public.notify_user(
    v_order.buyer_id, 'shipment_update', 'Delivery update',
    'Your order status is now ' || replace(p_status, '_', ' ') || '.',
    jsonb_build_object('href', '#/order/' || p_order_id::text)
  );
end;
$$;

-- =========================================================
-- 7. ESCROW-AWARE PAYOUT GATE
-- =========================================================
create or replace function public.admin_mark_settlement_paid(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.seller_settlements;
  v_dispute uuid;
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;

  select * into v_settlement from public.seller_settlements where id = p_settlement_id for update;
  if not found then raise exception 'Settlement not found.'; end if;

  -- Block payout while escrow window active or dispute open.
  if v_settlement.eligible_at is not null and v_settlement.eligible_at > now() then
    raise exception 'Escrow window still active until %.', v_settlement.eligible_at;
  end if;

  select id into v_dispute from public.order_disputes
  where order_id = v_settlement.order_id and status in ('opened', 'seller_response', 'under_review')
  limit 1;
  if v_dispute is not null then
    raise exception 'An open dispute blocks payout.';
  end if;

  update public.seller_settlements
  set status = 'paid', paid_at = now(), payout_status = 'paid'
  where id = p_settlement_id;

  perform public.log_audit('settlement.paid', 'seller_settlement', p_settlement_id::text, '{}'::jsonb);
  perform public.notify_user(v_settlement.seller_id, 'payout_paid', 'Payout sent',
    'Your payout has been released.', jsonb_build_object('settlement_id', p_settlement_id));
end;
$$;

-- Buyer early-release of escrow.
create or replace function public.accept_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.buyer_id <> auth.uid() then raise exception 'Only the buyer can accept.'; end if;
  if v_order.status <> 'delivered' then raise exception 'Order is not delivered yet.'; end if;

  update public.seller_settlements
  set eligible_at = now()
  where order_id = p_order_id and eligible_at is not null;

  perform public.notify_user(v_order.seller_id, 'item_accepted', 'Buyer accepted the item',
    'Funds released early.', jsonb_build_object('order_id', p_order_id));
end;
$$;

-- =========================================================
-- 8. DISPUTE SUBMISSION
-- =========================================================
create or replace function public.open_dispute(
  p_order_id uuid,
  p_reason text,
  p_description text,
  p_photo_evidence text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_dispute_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.buyer_id <> auth.uid() then raise exception 'Only the buyer can open a dispute.'; end if;
  if v_order.status <> 'delivered' then raise exception 'Disputes require a delivered order.'; end if;

  insert into public.order_disputes (order_id, buyer_id, seller_id, reason, description, photo_evidence)
  values (p_order_id, v_order.buyer_id, v_order.seller_id, p_reason, p_description, coalesce(p_photo_evidence, '{}'::text[]))
  returning id into v_dispute_id;

  -- Freeze escrow.
  update public.seller_settlements set eligible_at = null where order_id = p_order_id;

  perform public.notify_user(v_order.seller_id, 'dispute_opened', 'A dispute was opened',
    'Please respond with evidence.', jsonb_build_object('dispute_id', v_dispute_id, 'order_id', p_order_id));
  return v_dispute_id;
end;
$$;

-- =========================================================
-- 9. AUCTION WORKER HELPERS (auto start / auto close)
-- =========================================================
create or replace function public.auto_start_auctions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_auction record;
begin
  for v_auction in
    select id from public.auctions
    where status = 'scheduled' and starts_at <= now()
  loop
    update public.auctions set status = 'live' where id = v_auction.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.auto_close_auctions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_auction record;
begin
  for v_auction in
    select id from public.auctions
    where status = 'live' and ends_at <= now()
  loop
    perform public.end_auction(v_auction.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- =========================================================
-- 10. PROXY BIDDING (max bid) — table + resolver hook
-- =========================================================
create table if not exists public.auction_proxy_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete cascade,
  max_amount_paise integer not null check (max_amount_paise > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (auction_id, bidder_id)
);
create index if not exists auction_proxy_bids_auction_idx on public.auction_proxy_bids (auction_id, active);

-- =========================================================
-- 11. pg_cron SCHEDULING (best-effort)
-- =========================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lelam-auto-start-auctions', '* * * * *', 'select public.auto_start_auctions();');
    perform cron.schedule('lelam-auto-close-auctions', '* * * * *', 'select public.auto_close_auctions();');
    perform cron.schedule('lelam-expire-unpaid-auctions', '*/5 * * * *', 'select public.expire_unpaid_auctions();');
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;

-- =========================================================
-- 12. GRANTS
-- =========================================================
revoke all on function public.advance_shipment(uuid, text, text, text, text, text) from public;
grant execute on function public.advance_shipment(uuid, text, text, text, text, text) to authenticated;
revoke all on function public.admin_mark_settlement_paid(uuid) from public;
grant execute on function public.admin_mark_settlement_paid(uuid) to authenticated;
revoke all on function public.accept_order(uuid) from public;
grant execute on function public.accept_order(uuid) to authenticated;
revoke all on function public.open_dispute(uuid, text, text, text[]) from public;
grant execute on function public.open_dispute(uuid, text, text, text[]) to authenticated;
revoke all on function public.auto_start_auctions() from public;
grant execute on function public.auto_start_auctions() to authenticated;
revoke all on function public.auto_close_auctions() from public;
grant execute on function public.auto_close_auctions() to authenticated;
