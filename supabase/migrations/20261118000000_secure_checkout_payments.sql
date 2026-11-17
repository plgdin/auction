-- Server-authoritative checkout and payment-group confirmation.
alter table public.orders
  add column if not exists buyer_platform_fee_paise integer not null default 0
  check (buyer_platform_fee_paise >= 0);

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
        total_paise = total_paise + case when v_first_order then v_fee else 0 end
    where id = v_order_id and buyer_id = v_uid;
    v_first_order := false;
  end loop;

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
