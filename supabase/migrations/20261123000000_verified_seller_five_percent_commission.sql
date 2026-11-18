-- Migration: 20261123000000_verified_seller_five_percent_commission.sql
-- Description: Sets seller commission for verified sellers to 5% (inclusive of GST),
-- while normal sellers remain at 10%. Updates helper functions and settlement generation.

-- 1. Overload/replace seller commission helpers to support seller tier
create or replace function public.platform_fee_paise(
  p_subtotal_paise integer,
  p_seller_tier text default 'normal'
)
returns integer
language sql
immutable
as $$
  select floor(
    greatest(0, coalesce(p_subtotal_paise, 0))::numeric * 
    (case when lower(coalesce(p_seller_tier, 'normal')) = 'verified' then 5 else 10 end) / 100
  )::integer;
$$;
grant execute on function public.platform_fee_paise(integer, text) to anon, authenticated;

create or replace function public.seller_payout_paise(
  p_subtotal_paise integer,
  p_seller_tier text default 'normal'
)
returns integer
language sql
immutable
as $$
  select greatest(0, coalesce(p_subtotal_paise, 0) - public.platform_fee_paise(p_subtotal_paise, p_seller_tier));
$$;
grant execute on function public.seller_payout_paise(integer, text) to anon, authenticated;

-- 2. Update end_auction to resolve seller tier and apply 5% if verified
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
  v_seller_tier text := 'normal';
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

  -- Look up seller tier (5% for verified, 10% for normal)
  select coalesce(seller_tier, 'normal') into v_seller_tier from public.profiles where id = v_auction.seller_id;
  v_commission := public.platform_fee_paise(v_winning_bid, v_seller_tier);
  v_payout := public.seller_payout_paise(v_winning_bid, v_seller_tier);
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
  values
    (p_auction_id, v_order_id, v_auction.product_id, v_auction.seller_id,
     v_auction.asking_price_paise, v_auction.starting_price_paise,
     v_winning_bid, v_payout, v_subsidy, v_commission, 'sold');

  perform public.notify_user(v_winner, 'auction_won', 'You won the auction!',
    'Complete payment within 5 minutes to claim your item.', jsonb_build_object('order_id', v_order_id, 'href', '#/checkout?order=' || v_order_id));
  perform public.notify_user(v_auction.seller_id, 'auction_ended', 'Auction completed',
    'Your item won a final bid. Awaiting payment.', jsonb_build_object('order_id', v_order_id, 'href', '#/seller?tab=orders'));

  perform public.log_audit('auction.ended_sold', 'auction', p_auction_id::text,
    jsonb_build_object('winner_id', v_winner, 'winning_bid_paise', v_winning_bid, 'order_id', v_order_id, 'seller_tier', v_seller_tier));
end;
$$;

-- 3. Update verify_payment_and_confirm_orders to apply seller tier to settlements
create or replace function public.verify_payment_and_confirm_orders(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_provider_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments;
  v_order record;
  v_first_order boolean;
  v_confirmed uuid[] := array[]::uuid[];
  v_tier text;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment record not found.'; end if;
  if v_payment.user_id <> v_uid then raise exception 'Access denied.'; end if;

  if coalesce(trim(p_provider_payment_id), '') = '' then
    raise exception 'Missing payment provider reference.';
  end if;

  for v_order in
    select o.* from public.orders o
    join jsonb_array_elements_text(v_payment.order_ids) elem on elem::uuid = o.id
    for update of o
  loop
    if v_order.payment_status <> 'paid' then
      update public.orders set status = 'processing', payment_status = 'paid', paid_at = now()
      where id = v_order.id;
      update public.products p set status = 'sold'
      from public.order_items oi
      where oi.order_id = v_order.id and oi.product_id = p.id and p.is_unique;
      
      select coalesce(seller_tier, 'normal') into v_tier from public.profiles where id = v_order.seller_id;

      if not exists (select 1 from public.seller_settlements where order_id = v_order.id) then
        insert into public.seller_settlements
          (seller_id, order_id, source, asking_price_paise, seller_payout_paise, platform_commission_paise, status)
        values
          (v_order.seller_id, v_order.id,
           case when v_order.source = 'offer' then 'offer' when v_order.source = 'auction' then 'auction' else 'marketplace' end,
           v_order.subtotal_paise,
           public.seller_payout_paise(v_order.subtotal_paise, v_tier),
           public.platform_fee_paise(v_order.subtotal_paise, v_tier),
           'pending');
      end if;
      perform public.notify_user(v_order.buyer_id, 'payment_confirmed', 'Payment confirmed',
        'Your order is now being prepared.', jsonb_build_object('href', '#/orders/' || v_order.id));
      perform public.notify_user(v_order.seller_id, 'order_paid', 'Order paid',
        'The buyer completed payment. Arrange pickup.', jsonb_build_object('href', '#/seller?tab=orders'));
    end if;
    v_confirmed := array_append(v_confirmed, v_order.id);
  end loop;

  update public.payments set provider_payment_id = p_provider_payment_id,
    status = 'captured', signature_verified = true, updated_at = now()
  where id = v_payment.id;

  select not exists (
    select 1 from public.orders
    where buyer_id = v_uid and payment_status = 'paid'
    and not (id = any(v_confirmed))
  ) into v_first_order;

  if v_first_order then
    perform public.credit_affiliate_for_order((v_confirmed)[1]);
  end if;

  perform public.log_audit('payment.captured', 'payment', p_payment_id::text,
    jsonb_build_object('order_ids', v_confirmed, 'provider_id', p_provider_payment_id));

  return jsonb_build_object('ok', true, 'confirmed_orders', to_jsonb(v_confirmed));
end;
$$;

