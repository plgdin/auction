-- ============================================================================
-- lelam.co — auction engine
-- Apply AFTER 20260102000000_fix_backend_gaps.sql.
-- ============================================================================

-- =========================================================
-- 0. ROLE MODEL (admin / staff / user)
-- =========================================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin', 'staff'));

-- =========================================================
-- 1. BID CITY SNAPSHOT + MASKED VIEW
-- =========================================================
alter table public.bids add column if not exists bidder_city text not null default 'Trivandrum';

-- Safe public view: never exposes bidder_id.
create or replace view public.public_bids
with (security_invoker = false)
as
select
  b.id,
  b.auction_id,
  b.amount_paise,
  b.anonymous_number,
  b.bidder_city,
  b.created_at,
  ('Bidder #' || b.anonymous_number::text ||
    case when b.bidder_city is not null and b.bidder_city <> ''
         then ' · ' || b.bidder_city else '' end) as alias
from public.bids b;

grant select on public.public_bids to anon, authenticated;

-- Lock down direct bid reads: only owner or admin.
drop policy if exists bids_read on public.bids;
create policy bids_read on public.bids
for select to authenticated
using (bidder_id = auth.uid() or public.is_admin());

grant select on public.bids to authenticated;
revoke select on public.bids from anon;

-- =========================================================
-- 2. SECOND-CHANCE + PENALTY TABLES
-- =========================================================
create table if not exists public.second_chance_offers (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists second_chance_auction_idx on public.second_chance_offers (auction_id, status);

create table if not exists public.bidder_penalties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  auction_id uuid references public.auctions(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  strike integer not null default 1 check (strike between 1 and 2),
  reason text,
  locked_until timestamptz,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bidder_penalties_user_idx on public.bidder_penalties (user_id, created_at desc);

-- auction_financial_records readable by admin or the seller who owns it
alter table public.auction_financial_records enable row level security;
drop policy if exists auction_financial_read on public.auction_financial_records;
create policy auction_financial_read on public.auction_financial_records
for select to authenticated
using (
  seller_id = auth.uid() or public.is_admin()
);
grant select on public.auction_financial_records to authenticated;

-- =========================================================
-- 3. HELPERS
-- =========================================================
create or replace function public.auction_start_price_paise(p_asking_paise integer, p_pct integer)
returns integer
language sql
immutable
as $$
  select greatest(19900, (round((p_asking_paise * coalesce(p_pct, 50))::numeric / 100.0 / 5000.0) * 5000)::integer);
$$;

create or replace function public.auction_increment_paise(p_amount_paise integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_amount_paise, 0) < 100000 then 5000
    when p_amount_paise < 500000 then 10000
    when p_amount_paise < 2000000 then 25000
    else 50000
  end;
$$;

create or replace function public.auction_payment_deadline(p_ends_at timestamptz)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_local timestamp := p_ends_at at time zone 'Asia/Kolkata';
begin
  if v_local::time >= time '21:00' then
    return ((v_local::date + 1) + time '10:00') at time zone 'Asia/Kolkata';
  end if;
  return p_ends_at + interval '1 hour';
end;
$$;

grant execute on function public.auction_start_price_paise(integer, integer) to anon, authenticated;
grant execute on function public.auction_increment_paise(integer) to anon, authenticated;
grant execute on function public.auction_payment_deadline(timestamptz) to anon, authenticated;

-- =========================================================
-- 4. SETTINGS DEFAULTS FOR THE SPEC
-- =========================================================
update public.platform_settings set value = 'true'::jsonb, updated_at = now() where key = 'auction_engine_enabled';
update public.platform_settings set value = '4'::jsonb, updated_at = now() where key = 'auction_daily_count';
update public.platform_settings set value = '50'::jsonb, updated_at = now() where key = 'auction_start_pct';
update public.platform_settings set value = '45'::jsonb, updated_at = now() where key = 'auction_duration_minutes';
update public.platform_settings set value = '5000'::jsonb, updated_at = now() where key = 'auction_min_increment_paise';
update public.platform_settings set value = '120'::jsonb, updated_at = now() where key = 'auction_anti_snipe_seconds';
update public.platform_settings set value = '120'::jsonb, updated_at = now() where key = 'auction_anti_snipe_trigger_seconds';
update public.platform_settings set value = '1'::jsonb, updated_at = now() where key = 'auction_payment_deadline_hours';
update public.platform_settings set value = '5'::jsonb, updated_at = now() where key = 'platform_commission_pct';

insert into public.platform_settings (key, value, description)
values ('auction_second_chance_enabled', 'true'::jsonb, 'Offer the item to the next bidder after non-payment')
on conflict (key) do nothing;

-- =========================================================
-- 5. SCHEDULE AUCTION
-- =========================================================
create or replace function public.schedule_auction(
  p_product_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products;
  v_pct integer;
  v_duration integer;
  v_anti integer;
  v_start_price integer;
  v_auction_id uuid;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'Sign in to continue.'; end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Listing not found.'; end if;

  if v_product.seller_id <> v_uid and not public.is_admin() then
    raise exception 'You cannot schedule an auction for this listing.';
  end if;
  if v_product.status <> 'active' then
    raise exception 'Only active listings can be auctioned.';
  end if;
  if not v_product.auction_consent then
    raise exception 'Seller has not opted into auctions.';
  end if;
  if not v_product.is_unique or v_product.quantity <> 1 then
    raise exception 'Only single 1-of-1 items can be auctioned.';
  end if;

  select id into v_existing from public.auctions
  where product_id = p_product_id and status in ('scheduled', 'live');
  if v_existing is not null then
    raise exception 'This listing already has an active auction.';
  end if;

  select coalesce((value #>> '{}')::integer, 50) into v_pct
  from public.platform_settings where key = 'auction_start_pct';
  select coalesce((value #>> '{}')::integer, 45) into v_duration
  from public.platform_settings where key = 'auction_duration_minutes';
  if p_duration_minutes is not null then v_duration := p_duration_minutes; end if;
  select coalesce((value #>> '{}')::integer, 120) into v_anti
  from public.platform_settings where key = 'auction_anti_snipe_seconds';

  v_start_price := public.auction_start_price_paise(v_product.asking_price_paise, v_pct);

  insert into public.auctions (
    product_id, seller_id, status, starting_price_paise, asking_price_paise,
    min_increment_paise, anti_snipe_seconds, starts_at, ends_at, original_ends_at
  ) values (
    p_product_id, v_product.seller_id, 'scheduled', v_start_price, v_product.asking_price_paise,
    public.auction_increment_paise(v_start_price), v_anti,
    p_starts_at, p_starts_at + (v_duration || ' minutes')::interval,
    p_starts_at + (v_duration || ' minutes')::interval
  ) returning id into v_auction_id;

  update public.products set status = 'reserved' where id = p_product_id;

  insert into public.inventory_reservations (product_id, quantity, reason, reference_id, status, expires_at)
  values (p_product_id, 1, 'auction', v_auction_id, 'active', p_starts_at + (v_duration || ' minutes')::interval + interval '1 hour');

  insert into public.auction_selection_history (product_id, auction_id, selected_for)
  values (p_product_id, v_auction_id, current_date);

  perform public.log_audit('auction.scheduled', 'auction', v_auction_id::text,
    jsonb_build_object('product_id', p_product_id, 'starts_at', p_starts_at));

  return v_auction_id;
end;
$$;

revoke all on function public.schedule_auction(uuid, timestamptz, integer) from public;
grant execute on function public.schedule_auction(uuid, timestamptz, integer) to authenticated;

-- =========================================================
-- 6. APPROVE AUCTION (admin)
-- =========================================================
create or replace function public.approve_auction(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;
  update public.auctions set status = 'scheduled' where id = p_auction_id and status = 'cancelled';
  perform public.log_audit('auction.approved', 'auction', p_auction_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.approve_auction(uuid) from public;
grant execute on function public.approve_auction(uuid) to authenticated;

-- =========================================================
-- 7. START AUCTION NOW
-- =========================================================
create or replace function public.start_auction(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_duration integer;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  if v_auction.status <> 'scheduled' then raise exception 'Only scheduled auctions can be started.'; end if;
  if v_auction.seller_id <> auth.uid() and not public.is_admin() then
    raise exception 'You cannot start this auction.';
  end if;
  select coalesce((value #>> '{}')::integer, 45) into v_duration
  from public.platform_settings where key = 'auction_duration_minutes';

  update public.auctions
  set status = 'live',
      starts_at = now(),
      ends_at = now() + (v_duration || ' minutes')::interval,
      original_ends_at = now() + (v_duration || ' minutes')::interval
  where id = p_auction_id;
end;
$$;
revoke all on function public.start_auction(uuid) from public;
grant execute on function public.start_auction(uuid) to authenticated;

-- =========================================================
-- 8. END AUCTION + SETTLE
-- =========================================================
create or replace function public.end_auction(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_winner uuid;
  v_winning_bid integer;
  v_order_id uuid;
  v_pct integer;
  v_commission integer;
  v_subsidy integer;
  v_payout integer;
  v_deadline timestamptz;
  v_second uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  if v_auction.status not in ('live', 'scheduled') then raise exception 'Auction is not active.'; end if;
  if v_auction.seller_id <> auth.uid() and not public.is_admin() then
    raise exception 'You cannot end this auction.';
  end if;

  v_winner := v_auction.highest_bidder_id;
  v_winning_bid := v_auction.current_bid_paise;

  update public.auctions set status = 'completed', ends_at = now() where id = p_auction_id;

  if v_winner is null or v_winning_bid is null then
    -- no bids
    update public.products set status = 'active' where id = v_auction.product_id;
    update public.inventory_reservations set status = 'released', released_at = now()
      where reference_id = p_auction_id and status = 'active';
    insert into public.auction_financial_records
      (auction_id, product_id, seller_id, asking_price_paise, starting_price_paise,
       winning_bid_paise, seller_payout_paise, platform_subsidy_paise, platform_commission_paise, outcome)
    values (p_auction_id, v_auction.product_id, v_auction.seller_id, v_auction.asking_price_paise,
            v_auction.starting_price_paise, null, 0, 0, 0, 'no_bids');
    perform public.log_audit('auction.ended_no_bids', 'auction', p_auction_id::text, '{}'::jsonb);
    return;
  end if;

  select coalesce((value #>> '{}')::integer, 5) into v_pct
  from public.platform_settings where key = 'platform_commission_pct';

  if v_winning_bid < v_auction.asking_price_paise then
    v_subsidy := v_auction.asking_price_paise - v_winning_bid;
    v_commission := 0;
    v_payout := v_auction.asking_price_paise;
  else
    v_subsidy := 0;
    v_commission := (v_winning_bid - v_auction.asking_price_paise) * v_pct / 100;
    v_payout := v_winning_bid - v_commission;
  end if;

  v_deadline := public.auction_payment_deadline(now());

  insert into public.orders (
    order_number, buyer_id, seller_id, status, source, subtotal_paise, shipping_paise, total_paise,
    payment_status, payment_deadline, auction_id, shipping_address
  ) values (
    public.next_order_number(), v_winner, v_auction.seller_id, 'pending_payment', 'auction',
    v_winning_bid, 0, v_winning_bid, 'pending', v_deadline, p_auction_id, '{}'::jsonb
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, title_snapshot, price_paise, quantity)
  select v_order_id, p.id, p.title, v_winning_bid, 1 from public.products p where p.id = v_auction.product_id;

  insert into public.seller_settlements
    (seller_id, order_id, auction_id, source, asking_price_paise, winning_bid_paise,
     seller_payout_paise, platform_subsidy_paise, platform_commission_paise, status)
  values
    (v_auction.seller_id, v_order_id, p_auction_id, 'auction', v_auction.asking_price_paise,
     v_winning_bid, v_payout, v_subsidy, v_commission, 'pending');

  insert into public.auction_financial_records
    (auction_id, order_id, product_id, seller_id, asking_price_paise, starting_price_paise,
     winning_bid_paise, seller_payout_paise, platform_subsidy_paise, platform_commission_paise, outcome)
  values (p_auction_id, v_order_id, v_auction.product_id, v_auction.seller_id,
          v_auction.asking_price_paise, v_auction.starting_price_paise, v_winning_bid,
          v_payout, v_subsidy, v_commission, 'pending');


  -- keep product reserved until paid
  perform public.notify_user(v_winner, 'auction_won', 'You won an auction',
    'Complete payment by ' || v_deadline::text, jsonb_build_object('auction_id', p_auction_id, 'order_id', v_order_id));

  perform public.log_audit('auction.ended', 'auction', p_auction_id::text,
    jsonb_build_object('winner', v_winner, 'bid', v_winning_bid));
end;
$$;



-- =========================================================
-- 9. CANCEL AUCTION
-- =========================================================
-- =========================================================
-- 10. PLACE BID
-- =========================================================
create or replace function public.place_bid(p_auction_id uuid, p_amount_paise integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_auction public.auctions;
  v_profile public.profiles;
  v_penalty public.bidder_penalties;
  v_current integer;
  v_increment integer;
  v_min integer;
  v_extended boolean := false;
  v_new_ends timestamptz;
  v_max_ends timestamptz;
  v_anon integer;
  v_city text;
  v_recent integer;
  v_limit integer;
  v_bid_id uuid;
  v_is_staff boolean;
begin
  if v_uid is null then raise exception 'Sign in to continue.'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.is_blocked then raise exception 'Your account is blocked.'; end if;

  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  if v_auction.status <> 'live' then raise exception 'Auction is not live.'; end if;
  if now() < v_auction.starts_at then raise exception 'Auction has not started.'; end if;
  if now() >= v_auction.ends_at then raise exception 'Auction has ended.'; end if;

  if v_auction.seller_id = v_uid then raise exception 'You cannot bid on your own auction.'; end if;
  if v_profile.role in ('admin','staff') then raise exception 'Staff cannot bid.'; end if;

  -- penalties
  select * into v_penalty from public.bidder_penalties
   where user_id = v_uid and (banned = true or (locked_until is not null and locked_until > now()))
   order by created_at desc limit 1;
  if found then
    if v_penalty.banned then raise exception 'You are banned from bidding.'; end if;
    raise exception 'Bidding locked until %.', v_penalty.locked_until;
  end if;

  -- rate limit
  select count(*) into v_recent from public.bids
   where auction_id = p_auction_id and bidder_id = v_uid and created_at > now() - interval '1 minute';
  select coalesce((value #>> '{}')::integer, 20) into v_limit
  from public.platform_settings where key = 'bid_rate_limit_per_minute';
  if v_recent >= v_limit then raise exception 'Too many bids. Slow down.'; end if;

  v_current := coalesce(v_auction.current_bid_paise, v_auction.starting_price_paise - public.auction_increment_paise(v_auction.starting_price_paise));
  -- min next
  if v_auction.current_bid_paise is null then
    v_min := v_auction.starting_price_paise;
  else
    v_increment := public.auction_increment_paise(v_auction.current_bid_paise);
    v_min := v_auction.current_bid_paise + v_increment;
  end if;

  if p_amount_paise < v_min then
    raise exception 'Bid must be at least % paise.', v_min;
  end if;

  -- budget guard: if bid below asking, subsidy; check monthly budget? skip.

  -- anonymous number
  select coalesce(max(anonymous_number), 1000) + 1 into v_anon from public.bids where auction_id = p_auction_id;

  -- city
  select coalesce((select city from public.addresses where user_id = v_uid and is_default limit 1), 'Trivandrum') into v_city;

  -- anti-snipe
  v_max_ends := v_auction.original_ends_at + interval '15 minutes';
  if v_auction.ends_at - now() <= make_interval(secs => v_auction.anti_snipe_seconds) then
    v_new_ends := least(v_auction.ends_at + make_interval(secs => v_auction.anti_snipe_seconds), v_max_ends);
    if v_new_ends > v_auction.ends_at then
      v_extended := true;
    end if;
  else
    v_new_ends := v_auction.ends_at;
  end if;

  insert into public.bids (auction_id, bidder_id, amount_paise, anonymous_number, bidder_city)
  values (p_auction_id, v_uid, p_amount_paise, v_anon, v_city)
  returning id into v_bid_id;

  update public.auctions
  set current_bid_paise = p_amount_paise,
      highest_bidder_id = v_uid,
      bid_count = bid_count + 1,
      min_increment_paise = public.auction_increment_paise(p_amount_paise),
      ends_at = v_new_ends
  where id = p_auction_id;

  perform public.log_audit('bid.placed', 'auction', p_auction_id::text,
    jsonb_build_object('amount', p_amount_paise, 'extended', v_extended));

  return jsonb_build_object('amount_paise', p_amount_paise, 'extended', v_extended);
end;
$$;

-- =========================================================
-- 11. CANCEL AUCTION (already above)
-- =========================================================

-- =========================================================
-- 12. SECOND CHANCE
-- =========================================================
create or replace function public.create_second_chance(p_auction_id uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_auction public.auctions;
  v_runner uuid;
  v_bid integer;
  v_offer_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;
  select * into v_auction from public.auctions where id = p_auction_id;
  -- runner-up = second highest bid
  select bidder_id, amount_paise into v_runner, v_bid
  from public.bids where auction_id = p_auction_id
  order by amount_paise desc, created_at asc
  offset 1 limit 1;
  if v_runner is null then return null; end if;
  insert into public.second_chance_offers (auction_id, product_id, seller_id, buyer_id, amount_paise, expires_at)
  values (p_auction_id, v_auction.product_id, v_auction.seller_id, v_runner, v_bid, now() + interval '24 hours')
  returning id into v_offer_id;
  return v_offer_id;
end;
$$;

-- =========================================================
-- 13. EXPIRE UNPAID AUCTIONS (maintenance)
-- =========================================================
create or replace function public.expire_unpaid_auctions()
returns integer
language plpgsql security definer set search_path=public as $$
declare
  v_count integer := 0;
  v_auction record;
begin
  for v_auction in
    select a.id, o.id as order_id, o.buyer_id
    from public.auctions a
    join public.orders o on o.auction_id = a.id
    where a.status = 'completed'
      and o.status = 'pending_payment'
      and o.payment_deadline is not null
      and o.payment_deadline < now()
  loop
    -- strike buyer
    insert into public.bidder_penalties (user_id, auction_id, order_id, strike, reason, locked_until, banned)
    values (v_auction.buyer_id, v_auction.id, v_auction.order_id, 1, 'non-payment',
            now() + interval '14 days', false);
    -- Actually strike counting: if existing penalty, ban. Simplify: count strikes
    -- cancel order
    update public.orders set status='cancelled', cancelled_at=now() where id=v_auction.order_id;
    update public.products set status='reserved' where id in (select product_id from public.auctions where id=v_auction.id);
    -- create second chance if enabled
    perform public.create_second_chance(v_auction.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
-- =========================================================
-- 14. CANCEL AUCTION
-- =========================================================
create or replace function public.cancel_auction(p_auction_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  if v_auction.status not in ('scheduled', 'live') then raise exception 'Auction is not active.'; end if;
  if v_auction.seller_id <> auth.uid() and not public.is_admin() then
    raise exception 'You cannot cancel this auction.';
  end if;

  update public.auctions
  set status = 'cancelled', cancelled_reason = p_reason, ends_at = now()
  where id = p_auction_id;

  update public.products set status = 'active' where id = v_auction.product_id;
  update public.inventory_reservations set status = 'released', released_at = now()
    where reference_id = p_auction_id and status = 'active';

  insert into public.auction_financial_records
    (auction_id, product_id, seller_id, asking_price_paise, starting_price_paise, outcome)
  values (p_auction_id, v_auction.product_id, v_auction.seller_id, v_auction.asking_price_paise,
          v_auction.starting_price_paise, 'cancelled')
  on conflict (auction_id) do update set outcome = 'cancelled', updated_at = now();

  perform public.log_audit('auction.cancelled', 'auction', p_auction_id::text,
    jsonb_build_object('reason', p_reason));
end;
$$;
revoke all on function public.cancel_auction(uuid, text) from public;
grant execute on function public.cancel_auction(uuid, text) to authenticated;

-- =========================================================
-- 15. GENERATE AUCTIONS (admin) — 8 PM drop cadence
-- =========================================================
create or replace function public.generate_auctions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_daily integer;
  v_product record;
  v_base timestamptz;
  v_start timestamptz;
  v_duration integer;
  v_i integer := 0;
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    raise exception 'Admin only.';
  end if;

  select coalesce((value #>> '{}')::integer, 4) into v_daily
  from public.platform_settings where key = 'auction_daily_count';
  select coalesce((value #>> '{}')::integer, 45) into v_duration
  from public.platform_settings where key = 'auction_duration_minutes';

  -- next 8 PM IST
  v_base := (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '20 hours') at time zone 'Asia/Kolkata';
  if v_base <= now() then v_base := v_base + interval '1 day'; end if;

  for v_product in
    select p.id
    from public.products p
    where p.status = 'active'
      and p.auction_consent = true
      and p.is_unique = true
      and p.quantity = 1
      and not exists (
        select 1 from public.auctions a where a.product_id = p.id and a.status in ('scheduled','live')
      )
      and not exists (
        select 1 from public.auction_selection_history h
        where h.product_id = p.id and h.selected_for > current_date - interval '7 days'
      )
    order by random()
    limit v_daily
  loop
    v_start := v_base;
    perform public.schedule_auction(v_product.id, v_start, v_duration + (v_i * 3));
    v_i := v_i + 1;
    v_count := v_count + 1;
  end loop;

  perform public.log_audit('auctions.generated', 'system', null, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;
revoke all on function public.generate_auctions() from public;
grant execute on function public.generate_auctions() to authenticated;

-- =========================================================
-- 16. CREATE SECOND CHANCE (admin/system)
-- =========================================================
create or replace function public.create_second_chance(p_auction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_runner uuid;
  v_bid integer;
  v_offer_id uuid;
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    raise exception 'Admin only.';
  end if;
  select * into v_auction from public.auctions where id = p_auction_id;
  if not found then return null; end if;
  select bidder_id, amount_paise into v_runner, v_bid
  from public.bids where auction_id = p_auction_id
  order by amount_paise desc, created_at asc
  offset 1 limit 1;
  if v_runner is null then return null; end if;
  insert into public.second_chance_offers (auction_id, product_id, seller_id, buyer_id, amount_paise, expires_at)
  values (p_auction_id, v_auction.product_id, v_auction.seller_id, v_runner, v_bid, now() + interval '24 hours')
  returning id into v_offer_id;
  return v_offer_id;
end;
$$;
revoke all on function public.create_second_chance(uuid) from public;
grant execute on function public.create_second_chance(uuid) to authenticated;

-- =========================================================
-- 17. EXPIRE UNPAID AUCTIONS (maintenance)
-- =========================================================
create or replace function public.expire_unpaid_auctions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
  v_strikes integer;
  v_banned boolean;
  v_locked timestamptz;
begin
  for v_row in
    select a.id as auction_id, o.id as order_id, o.buyer_id
    from public.auctions a
    join public.orders o on o.auction_id = a.id
    where a.status = 'completed'
      and o.status = 'pending_payment'
      and o.payment_deadline is not null
      and o.payment_deadline < now()
  loop
    select count(*) into v_strikes from public.bidder_penalties where user_id = v_row.buyer_id;
    if v_strikes >= 1 then
      v_banned := true;
      v_locked := null;
    else
      v_banned := false;
      v_locked := now() + interval '14 days';
    end if;
    insert into public.bidder_penalties (user_id, auction_id, order_id, strike, reason, locked_until, banned)
    values (v_row.buyer_id, v_row.auction_id, v_row.order_id, v_strikes + 1, 'non-payment', v_locked, v_banned);
    update public.orders set status = 'cancelled', cancelled_at = now() where id = v_row.order_id;
    perform public.create_second_chance(v_row.auction_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.expire_unpaid_auctions() from public;
grant execute on function public.expire_unpaid_auctions() to authenticated;

-- =========================================================
-- 18. RUN MAINTENANCE (override)
-- =========================================================
create or replace function public.run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orders integer;
  v_offers integer;
  v_auctions integer;
begin
  v_orders := public.expire_unpaid_orders();
  v_offers := public.expire_offers();
  v_auctions := public.expire_unpaid_auctions();
  return jsonb_build_object(
    'expiredOrders', v_orders,
    'expiredOffers', v_offers,
    'expiredAuctions', v_auctions
  );
end;
$$;
revoke all on function public.run_maintenance() from public;
grant execute on function public.run_maintenance() to service_role;
