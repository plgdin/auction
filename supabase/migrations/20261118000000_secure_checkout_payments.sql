-- =========================================================
-- MIGRATION: 20261118000000_secure_checkout_payments.sql
-- Server-authoritative checkout, GST alignment, and Razorpay confirmation.
-- =========================================================

-- 1. COLUMNS
alter table public.orders
  add column if not exists buyer_platform_fee_paise integer not null default 0
  check (buyer_platform_fee_paise >= 0);

alter table public.orders
  add column if not exists buyer_platform_fee_gst_paise integer not null default 0
  check (buyer_platform_fee_gst_paise >= 0);

-- 2. PLATFORM SETTINGS
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

-- 3. PAYMENT DEADLINE & COMMISSION HELPERS
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

-- Seller commission helper: 10% of subtotal (GST inclusive)
create or replace function public.platform_fee_paise(p_subtotal_paise integer)
returns integer
language sql
immutable
as $$
  select floor(greatest(0, coalesce(p_subtotal_paise, 0))::numeric * 10 / 100)::integer;
$$;
grant execute on function public.platform_fee_paise(integer) to anon, authenticated;

create or replace function public.seller_payout_paise(p_subtotal_paise integer)
returns integer
language sql
immutable
as $$
  select greatest(0, coalesce(p_subtotal_paise, 0) - public.platform_fee_paise(p_subtotal_paise));
$$;
grant execute on function public.seller_payout_paise(integer) to anon, authenticated;

-- Worker-safe end_auction with 10% flat commission
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
  v_commission integer;
  v_subsidy integer := 0;
  v_payout integer;
  v_deadline timestamptz;
  v_addr jsonb;
begin
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  if v_auction.status not in ('live', 'scheduled') then raise exception 'Auction is not active.'; end if;

  if auth.uid() is not null and auth.role() <> 'service_role' and not public.is_admin() then
    if v_auction.seller_id <> auth.uid() and not (v_auction.ends_at <= now() and v_auction.status = 'live') then
      raise exception 'You cannot end this auction.';
    end if;
  end if;

  v_winner := v_auction.highest_bidder_id;
  v_winning_bid := v_auction.current_bid_paise;

  update public.auctions set status = 'completed', ends_at = now() where id = p_auction_id;

  if v_winner is null or v_winning_bid is null then
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

  v_commission := public.platform_fee_paise(v_winning_bid);
  v_payout := public.seller_payout_paise(v_winning_bid);
  v_subsidy := 0;

  v_deadline := public.auction_payment_deadline(now());

  select to_jsonb(a.*) into v_addr
  from public.addresses a
  where a.user_id = v_winner
  order by a.is_default desc, a.created_at desc limit 1;

  insert into public.orders (
    order_number, buyer_id, seller_id, status, source, subtotal_paise, shipping_paise, total_paise,
    payment_status, payment_deadline, auction_id, shipping_address
  ) values (
    public.next_order_number(), v_winner, v_auction.seller_id, 'pending_payment', 'auction',
    v_winning_bid, 0, v_winning_bid, 'pending', v_deadline, p_auction_id, coalesce(v_addr, '{}'::jsonb)
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
    'Complete payment within 5 minutes.', jsonb_build_object('auction_id', p_auction_id, 'order_id', v_order_id));

  perform public.log_audit('auction.ended', 'auction', p_auction_id::text,
    jsonb_build_object('winner', v_winner, 'bid', v_winning_bid));
end;
$$;
grant execute on function public.end_auction(uuid) to authenticated;

-- 4. BID MAX LIMIT GUARD
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

  -- Min and Max bid validation
  if v_auction.current_bid_paise is null then
    v_min := v_auction.starting_price_paise;
  else
    v_increment := public.auction_increment_paise(v_auction.current_bid_paise);
    v_min := v_auction.current_bid_paise + v_increment;
  end if;

  if p_amount_paise < v_min then
    raise exception 'Bid must be at least % paise.', v_min;
  end if;
  if p_amount_paise > 2000000000 then
    raise exception 'Bid exceeds maximum allowed limit.';
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

  perform public.run_proxy_bids(p_auction_id);

  return jsonb_build_object('amount_paise', p_amount_paise, 'extended', v_extended);
end;
$$;
revoke all on function public.place_bid(uuid, integer) from public;
grant execute on function public.place_bid(uuid, integer) to authenticated;

-- 5. CHECKOUT CREATE ORDERS WITH GST & COD CONFIRMATION
create or replace function public.checkout_create_orders(
  p_address jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_product_id uuid default null,
  p_offer_id uuid default null,
  p_quantity integer default 1,
  p_payment_method text default 'upi'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_address_id uuid;
  v_cart_id uuid;
  v_result jsonb;
  v_group_id uuid;
  v_order_ids jsonb;
  v_order_id uuid;
  v_fee integer := 1000;
  v_fee_gst integer := 180;
  v_fee_total integer := 1180;
  v_first_order boolean := true;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and not is_blocked) then
    raise exception 'Account unavailable';
  end if;
  if p_payment_method not in ('upi', 'card', 'cod') then raise exception 'Invalid payment method'; end if;
  if p_product_id is not null and p_offer_id is not null then raise exception 'Choose a product or an offer'; end if;
  if jsonb_typeof(p_address) <> 'object'
     or coalesce(trim(p_address->>'name'), '') = ''
     or coalesce(trim(p_address->>'phone'), '') = ''
     or coalesce(trim(p_address->>'line1'), '') = ''
     or coalesce(trim(p_address->>'pincode'), '') !~ '^[0-9]{6}$' then
    raise exception 'Complete the delivery address';
  end if;

  insert into public.addresses
    (user_id, label, recipient_name, phone, line1, line2, city, state, pincode)
  values
    (v_uid, left(coalesce(p_address->>'label', 'Home'), 40), left(p_address->>'name', 120),
     left(p_address->>'phone', 30), left(p_address->>'line1', 200),
     nullif(left(coalesce(p_address->>'line2', ''), 200), ''),
     left(coalesce(p_address->>'city', ''), 100), left(coalesce(p_address->>'state', ''), 100),
     p_address->>'pincode')
  returning id into v_address_id;

  if p_product_id is null and p_offer_id is null then
    if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0
       or jsonb_array_length(p_lines) > 50 then raise exception 'Cart is empty or too large'; end if;
    insert into public.carts (user_id) values (v_uid)
    on conflict (user_id) do update set updated_at = now()
    returning id into v_cart_id;
    delete from public.cart_items where cart_id = v_cart_id;
    insert into public.cart_items (cart_id, product_id, quantity)
    select v_cart_id, x.product_id, x.quantity
    from jsonb_to_recordset(p_lines) as x(product_id uuid, quantity integer)
    where x.product_id is not null and x.quantity between 1 and 20;
    if (select count(*) from public.cart_items where cart_id = v_cart_id) <> jsonb_array_length(p_lines) then
      raise exception 'Cart contains an invalid item or quantity';
    end if;
  end if;

  v_result := public.place_order(v_address_id, p_product_id, p_offer_id, p_quantity, p_payment_method);
  v_order_ids := v_result->'orderIds';
  if jsonb_array_length(coalesce(v_order_ids, '[]'::jsonb)) = 0 then raise exception 'Order was not created'; end if;

  for v_order_id in select value::text::uuid from jsonb_array_elements_text(v_order_ids)
  loop
    update public.orders
    set buyer_platform_fee_paise = case when v_first_order then v_fee else 0 end,
        buyer_platform_fee_gst_paise = case when v_first_order then v_fee_gst else 0 end,
        total_paise = total_paise + case when v_first_order then v_fee_total else 0 end,
        status = case when p_payment_method = 'cod' then 'processing' else status end
    where id = v_order_id and buyer_id = v_uid;
    v_first_order := false;
  end loop;

  -- Create settlements for COD orders immediately
  if p_payment_method = 'cod' then
    for v_order_id in select value::text::uuid from jsonb_array_elements_text(v_order_ids)
    loop
      insert into public.seller_settlements
        (seller_id, order_id, source, asking_price_paise, seller_payout_paise, platform_commission_paise, status)
      select
        o.seller_id, o.id,
        case when o.source = 'offer' then 'offer' when o.source = 'auction' then 'auction' else 'marketplace' end,
        o.subtotal_paise,
        public.seller_payout_paise(o.subtotal_paise),
        public.platform_fee_paise(o.subtotal_paise),
        'pending'
      from public.orders o
      where o.id = v_order_id
      and not exists (select 1 from public.seller_settlements where order_id = v_order_id);
    end loop;
  end if;

  select checkout_group_id into v_group_id
  from public.orders where id = (v_order_ids->>0)::uuid and buyer_id = v_uid;

  return jsonb_build_object(
    'orderIds', v_order_ids,
    'checkoutGroupId', v_group_id,
    'totalPaise', (select sum(total_paise) from public.orders where checkout_group_id = v_group_id and buyer_id = v_uid)
  );
end;
$$;

revoke all on function public.checkout_create_orders(jsonb, jsonb, uuid, uuid, integer, text) from public;
grant execute on function public.checkout_create_orders(jsonb, jsonb, uuid, uuid, integer, text) to authenticated;

-- 6. CONFIRM CHECKOUT GROUP PAYMENT
create or replace function public.confirm_checkout_group_payment(
  p_checkout_group_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_total integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Payment confirmation is server-only'; end if;

  select * into v_payment from public.payments
  where checkout_group_id = p_checkout_group_id
    and provider = 'razorpay'
    and provider_order_id = p_provider_order_id
  for update;
  if not found then raise exception 'Payment does not belong to this checkout'; end if;

  select coalesce(sum(total_paise), 0)::integer into v_total
  from public.orders where checkout_group_id = p_checkout_group_id;
  if v_payment.amount_paise <> v_total then raise exception 'Payment amount does not match checkout'; end if;
  if v_payment.status = 'refunded' then raise exception 'Payment was refunded'; end if;
  if v_payment.status = 'captured' then return; end if;

  for v_order in
    select * from public.orders where checkout_group_id = p_checkout_group_id for update
  loop
    if v_order.payment_status <> 'paid' then
      update public.orders set status = 'processing', payment_status = 'paid', paid_at = now()
      where id = v_order.id;
      update public.products p set status = 'sold'
      from public.order_items oi
      where oi.order_id = v_order.id and oi.product_id = p.id and p.is_unique;
      if not exists (select 1 from public.seller_settlements where order_id = v_order.id) then
        insert into public.seller_settlements
          (seller_id, order_id, source, asking_price_paise, seller_payout_paise, platform_commission_paise, status)
        values
          (v_order.seller_id, v_order.id,
           case when v_order.source = 'offer' then 'offer' when v_order.source = 'auction' then 'auction' else 'marketplace' end,
           v_order.subtotal_paise,
           public.seller_payout_paise(v_order.subtotal_paise), public.platform_fee_paise(v_order.subtotal_paise), 'pending');
      end if;
      perform public.notify_user(v_order.buyer_id, 'payment_confirmed', 'Payment confirmed',
        'Your order is now being prepared.', jsonb_build_object('href', '#/orders/' || v_order.id));
      perform public.notify_user(v_order.seller_id, 'order_paid', 'Order paid',
        'The buyer completed payment. Arrange pickup.', jsonb_build_object('href', '#/seller?tab=orders'));
    end if;
  end loop;

  update public.payments set provider_payment_id = p_provider_payment_id,
    status = 'captured', signature_verified = true, updated_at = now()
  where id = v_payment.id;
end;
$$;

revoke all on function public.confirm_checkout_group_payment(uuid, text, text) from public;
grant execute on function public.confirm_checkout_group_payment(uuid, text, text) to service_role;
