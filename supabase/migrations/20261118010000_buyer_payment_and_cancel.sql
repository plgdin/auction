-- 20261118010000_buyer_payment_and_cancel.sql
-- Allow authenticated buyers to confirm payment and cancel eligible orders with reason

-- 1. BUYER CONFIRM ORDER PAYMENT
create or replace function public.buyer_confirm_order_payment(
  p_order_id uuid,
  p_payment_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  select * into v_order from public.orders
  where id = p_order_id and buyer_id = v_uid
  for update;

  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('cancelled', 'expired', 'returned') then
    raise exception 'Order is closed';
  end if;

  update public.orders
  set status = 'processing',
      payment_status = 'paid',
      paid_at = coalesce(paid_at, now())
  where id = p_order_id;

  -- 1-stock or unique items automatically go sold out
  update public.products p
  set status = 'sold', quantity = 0
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.product_id = p.id
    and (p.is_unique = true or p.quantity <= 1);

  -- Multi-stock items decrement and set sold if 0
  update public.products p
  set quantity = greatest(0, p.quantity - oi.quantity),
      status = case when greatest(0, p.quantity - oi.quantity) = 0 then 'sold' else p.status end
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.product_id = p.id
    and not p.is_unique
    and p.quantity > 1;

  -- Create seller settlement
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
  where o.id = p_order_id
  and not exists (select 1 from public.seller_settlements where order_id = p_order_id);
end;
$$;

revoke all on function public.buyer_confirm_order_payment(uuid, text) from public;
grant execute on function public.buyer_confirm_order_payment(uuid, text) to authenticated;

-- 2. BUYER CANCEL ORDER WITH REASON
create or replace function public.buyer_cancel_order(
  p_order_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_shipment public.shipments;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  select * into v_order from public.orders
  where id = p_order_id and buyer_id = v_uid
  for update;

  if not found then raise exception 'Order not found'; end if;

  if v_order.source = 'auction' then
    raise exception 'Auction wins cannot be cancelled';
  end if;

  if v_order.status in ('shipped', 'delivered', 'cancelled', 'expired', 'returned') then
    raise exception 'This order can no longer be cancelled';
  end if;

  select * into v_shipment from public.shipments where order_id = p_order_id;
  if found and v_shipment.status in ('picked_up', 'in_transit', 'out_for_delivery', 'delivered') then
    raise exception 'Parcel is already picked up. Cannot cancel.';
  end if;

  update public.orders
  set status = 'cancelled',
      cancelled_at = now(),
      payment_status = case when payment_status = 'paid' then 'refunded' else payment_status end,
      notes = coalesce(p_reason, notes)
  where id = p_order_id;

  -- Release product stock back to active
  update public.products p
  set status = 'active',
      quantity = case when p.quantity = 0 then 1 else p.quantity + oi.quantity end
  from public.order_items oi
  where oi.order_id = p_order_id and oi.product_id = p.id;
end;
$$;

revoke all on function public.buyer_cancel_order(uuid, text) from public;
grant execute on function public.buyer_cancel_order(uuid, text) to authenticated;

