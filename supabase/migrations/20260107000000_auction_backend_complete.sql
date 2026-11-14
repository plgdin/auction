-- =========================================================
-- MIGRATION: 20260107000000_auction_backend_complete.sql
-- COMPLETE AUCTION BACKEND & SECOND-CHANCE ENGINE
-- =========================================================

-- 1. PROXY BID AUTO-EVALUATION IN PLACE_BID
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
  if v_profile.role in ('admin', 'staff') then raise exception 'Staff cannot bid.'; end if;

  -- Penalties check
  select * into v_penalty from public.bidder_penalties
   where user_id = v_uid and (banned = true or (locked_until is not null and locked_until > now()))
   order by created_at desc limit 1;
  if found then
    if v_penalty.banned then raise exception 'You are banned from bidding.'; end if;
    raise exception 'Bidding locked until %.', v_penalty.locked_until;
  end if;

  -- Rate limit
  select count(*) into v_recent from public.bids
   where auction_id = p_auction_id and bidder_id = v_uid and created_at > now() - interval '1 minute';
  select coalesce((value #>> '{}')::integer, 20) into v_limit
  from public.platform_settings where key = 'bid_rate_limit_per_minute';
  if v_recent >= v_limit then raise exception 'Too many bids. Slow down.'; end if;

  -- Min next bid
  if v_auction.current_bid_paise is null then
    v_min := v_auction.starting_price_paise;
  else
    v_increment := public.auction_increment_paise(v_auction.current_bid_paise);
    v_min := v_auction.current_bid_paise + v_increment;
  end if;

  if p_amount_paise < v_min then
    raise exception 'Bid must be at least % paise.', v_min;
  end if;

  -- Anonymous alias number
  select coalesce(max(anonymous_number), 1000) + 1 into v_anon from public.bids where auction_id = p_auction_id;

  -- City
  select coalesce((select city from public.addresses where user_id = v_uid and is_default limit 1), 'Trivandrum') into v_city;

  -- Anti-snipe extension
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

  -- AUTO-EVALUATE ACTIVE PROXY BIDS IMMEDIATELY
  perform public.run_proxy_bids(p_auction_id);

  return jsonb_build_object('amount_paise', p_amount_paise, 'extended', v_extended);
end;
$$;
revoke all on function public.place_bid(uuid, integer) from public;
grant execute on function public.place_bid(uuid, integer) to authenticated;

-- 2. PROXY BID SETUP AUTO-TRIGGERS EVALUATION
create or replace function public.set_proxy_bid(p_auction_id uuid, p_max_amount_paise integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_auction public.auctions;
begin
  if v_uid is null then raise exception 'Sign in to continue.'; end if;
  select * into v_auction from public.auctions where id = p_auction_id;
  if not found then raise exception 'Auction not found.'; end if;
  if v_auction.status <> 'live' then raise exception 'Auction is not live.'; end if;
  if v_auction.seller_id = v_uid then raise exception 'Cannot bid on your own auction.'; end if;

  insert into public.auction_proxy_bids (auction_id, bidder_id, max_amount_paise, active)
  values (p_auction_id, v_uid, p_max_amount_paise, true)
  on conflict (auction_id, bidder_id) do update
    set max_amount_paise = excluded.max_amount_paise, active = true;

  -- Immediately run proxy engine so the new ceiling can outbid the current price
  perform public.run_proxy_bids(p_auction_id);
end;
$$;
revoke all on function public.set_proxy_bid(uuid, integer) from public;
grant execute on function public.set_proxy_bid(uuid, integer) to authenticated;

-- 3. WORKER-SAFE END_AUCTION
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
begin
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  if v_auction.status not in ('live', 'scheduled') then raise exception 'Auction is not active.'; end if;

  -- Security check: allowed if service_role, admin, the seller, or automated worker when ends_at <= now()
  if auth.uid() is not null and auth.role() <> 'service_role' and not public.is_admin() then
    if v_auction.seller_id <> auth.uid() and not (v_auction.ends_at <= now() and v_auction.status = 'live') then
      raise exception 'You cannot end this auction.';
    end if;
  end if;

  v_winner := v_auction.highest_bidder_id;
  v_winning_bid := v_auction.current_bid_paise;

  update public.auctions set status = 'completed', ends_at = now() where id = p_auction_id;

  if v_winner is null or v_winning_bid is null then
    -- No bids placed: reset product back to active
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

  insert into public.order_items (order_id, product_id, title_snapshot, image_snapshot, price_paise, quantity)
  select v_order_id, p.id, p.title,
         coalesce((select url from public.product_images where product_id = p.id order by sort_order asc limit 1), ''),
         v_winning_bid, 1
  from public.products p where p.id = v_auction.product_id;

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

  perform public.notify_user(v_winner, 'auction_won', 'You won an auction!',
    'Complete checkout within 24 hours.', jsonb_build_object('auction_id', p_auction_id, 'order_id', v_order_id));

  perform public.log_audit('auction.ended', 'auction', p_auction_id::text,
    jsonb_build_object('winner', v_winner, 'bid', v_winning_bid));
end;
$$;
grant execute on function public.end_auction(uuid) to authenticated;

-- 4. SECOND-CHANCE OFFER ACCEPTANCE & DECLINE
create or replace function public.accept_second_chance_offer(p_offer_id uuid, p_address_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.second_chance_offers;
  v_product public.products;
  v_address public.addresses;
  v_order_id uuid;
  v_deadline timestamptz;
  v_addr_json jsonb := '{}'::jsonb;
  v_shipping_paise integer := 0;
begin
  if v_uid is null then raise exception 'Sign in to accept offer.'; end if;

  select * into v_offer from public.second_chance_offers where id = p_offer_id for update;
  if not found then raise exception 'Second-chance offer not found.'; end if;
  if v_offer.buyer_id <> v_uid then raise exception 'This offer belongs to another bidder.'; end if;
  if v_offer.status <> 'pending' then raise exception 'Offer is no longer active (status: %).', v_offer.status; end if;
  if v_offer.expires_at <= now() then
    update public.second_chance_offers set status = 'expired' where id = p_offer_id;
    raise exception 'This second-chance offer has expired.';
  end if;

  select * into v_product from public.products where id = v_offer.product_id for update;
  if not found then raise exception 'Product not found.'; end if;

  if p_address_id is not null then
    select * into v_address from public.addresses where id = p_address_id and user_id = v_uid;
  end if;
  if v_address is null then
    select * into v_address from public.addresses where user_id = v_uid order by is_default desc, created_at desc limit 1;
  end if;

  if v_address is not null then
    v_addr_json := jsonb_build_object(
      'id', v_address.id,
      'label', v_address.label,
      'recipient_name', v_address.recipient_name,
      'phone', v_address.phone,
      'line1', v_address.line1,
      'line2', v_address.line2,
      'city', v_address.city,
      'state', v_address.state,
      'pincode', v_address.pincode
    );
  end if;

  v_deadline := now() + interval '24 hours';
  v_shipping_paise := coalesce(v_product.shipping_fee_paise, 4900);

  insert into public.orders (
    order_number, buyer_id, seller_id, status, source,
    subtotal_paise, shipping_paise, total_paise, payment_status,
    payment_deadline, auction_id, shipping_address
  ) values (
    public.next_order_number(), v_uid, v_offer.seller_id, 'pending_payment', 'auction',
    v_offer.amount_paise, v_shipping_paise, v_offer.amount_paise + v_shipping_paise, 'pending',
    v_deadline, v_offer.auction_id, v_addr_json
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, title_snapshot, image_snapshot, price_paise, quantity)
  values (
    v_order_id, v_product.id, v_product.title,
    coalesce((select url from public.product_images where product_id = v_product.id order by sort_order asc limit 1), ''),
    v_offer.amount_paise, 1
  );

  update public.second_chance_offers set status = 'accepted' where id = p_offer_id;
  update public.products set status = 'reserved' where id = v_product.id;

  insert into public.seller_settlements (
    seller_id, order_id, auction_id, source, asking_price_paise,
    winning_bid_paise, seller_payout_paise, platform_subsidy_paise,
    platform_commission_paise, status
  ) values (
    v_offer.seller_id, v_order_id, v_offer.auction_id, 'auction',
    v_product.asking_price_paise, v_offer.amount_paise, v_offer.amount_paise, 0, 0, 'pending'
  );

  perform public.log_audit('second_chance.accepted', 'second_chance_offer', p_offer_id::text,
    jsonb_build_object('order_id', v_order_id, 'amount', v_offer.amount_paise));

  return v_order_id;
end;
$$;
grant execute on function public.accept_second_chance_offer(uuid, uuid) to authenticated;

create or replace function public.decline_second_chance_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.second_chance_offers;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  select * into v_offer from public.second_chance_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found.'; end if;
  if v_offer.buyer_id <> v_uid then raise exception 'Unauthorized.'; end if;

  update public.second_chance_offers set status = 'declined' where id = p_offer_id;
  -- Return product back to active marketplace listing
  update public.products set status = 'active' where id = v_offer.product_id;

  perform public.log_audit('second_chance.declined', 'second_chance_offer', p_offer_id::text, '{}'::jsonb);
end;
$$;
grant execute on function public.decline_second_chance_offer(uuid) to authenticated;

-- 5. EXPIRE STALE SECOND-CHANCE OFFERS
create or replace function public.expire_stale_second_chance_offers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select id, product_id from public.second_chance_offers
    where status = 'pending' and expires_at < now()
  loop
    update public.second_chance_offers set status = 'expired' where id = v_row.id;
    update public.products set status = 'active' where id = v_row.product_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 6. FULL RUN_MAINTENANCE SCHEDULER
create or replace function public.run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started integer := 0;
  v_closed integer := 0;
  v_orders integer := 0;
  v_offers integer := 0;
  v_auctions integer := 0;
  v_second_chance integer := 0;
  v_escrow_released integer := 0;
  v_settlement record;
begin
  -- 1. Start scheduled lots
  v_started := public.auto_start_auctions();

  -- 2. Close finished lots
  v_closed := public.auto_close_auctions();

  -- 3. Expire unpaid cart/buy-now orders
  v_orders := public.expire_unpaid_orders();

  -- 4. Expire negotiated offers
  v_offers := public.expire_offers();

  -- 5. Expire unpaid auction orders, penalize defaulter, create second chance offer
  v_auctions := public.expire_unpaid_auctions();

  -- 6. Expire expired second chance offers
  v_second_chance := public.expire_stale_second_chance_offers();

  -- 7. Auto-release 48-hour escrow for delivered orders without open disputes
  for v_settlement in
    select s.id, s.order_id
    from public.seller_settlements s
    join public.orders o on o.id = s.order_id
    where s.status = 'pending'
      and o.status = 'delivered'
      and s.eligible_at is not null
      and s.eligible_at <= now()
      and not exists (
        select 1 from public.order_disputes od
        where od.order_id = s.order_id and od.status in ('opened', 'seller_response', 'under_review')
      )
  loop
    update public.seller_settlements
    set status = 'approved', eligible_at = now()
    where id = v_settlement.id;
    v_escrow_released := v_escrow_released + 1;
  end loop;

  return jsonb_build_object(
    'auctionsStarted', v_started,
    'auctionsClosed', v_closed,
    'expiredOrders', v_orders,
    'expiredOffers', v_offers,
    'expiredAuctions', v_auctions,
    'expiredSecondChance', v_second_chance,
    'escrowReleased', v_escrow_released
  );
end;
$$;
grant execute on function public.run_maintenance() to authenticated, anon;

