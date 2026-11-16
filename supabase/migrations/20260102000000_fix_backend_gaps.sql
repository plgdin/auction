-- ============================================================================
-- lelam.co — backend correctness pass
-- Apply AFTER 20260101000100_supabase_backend.sql.
--
-- Fixes:
--   * Payment confirmation is bound to the Razorpay order created for that
--     exact lelam order (no signature replay onto another order).
--   * Settlement payouts deduct the advertised flat ₹10 platform charge.
--   * Cart checkouts lock product rows before validating stock (no oversell).
--   * Accepted offers that expire release their reserved listing.
--   * Admins can read every profile (users tab).
--   * public_products no longer leaks moderation notes to shoppers and hides
--     blocked sellers.
--   * pg_cron sweeps expired unpaid orders and offers when available.
-- ============================================================================

-- =========================================================
-- 1. SETTLEMENT HELPERS
-- =========================================================

-- Flat platform charge per seller order, matching PLATFORM_CHARGE_PAISE in
-- src/lib/sellerMath.ts and the copy on the seller money screens.
create or replace function public.platform_fee_paise(p_subtotal_paise integer)
returns integer
language sql
immutable
as $$
  select least(1000, greatest(0, coalesce(p_subtotal_paise, 0)));
$$;

create or replace function public.seller_payout_paise(p_subtotal_paise integer)
returns integer
language sql
immutable
as $$
  select greatest(0, coalesce(p_subtotal_paise, 0) - public.platform_fee_paise(p_subtotal_paise));
$$;

grant execute on function public.platform_fee_paise(integer) to anon, authenticated;
grant execute on function public.seller_payout_paise(integer) to anon, authenticated;

-- =========================================================
-- 2. PAYMENT CONFIRMATION (ORDER-BOUND)
-- =========================================================

-- The old three-argument version could be fed any valid Razorpay signature.
drop function if exists public.confirm_order_payment(uuid, text, text);

create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_provider text,
  p_provider_order_id text,
  p_provider_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment public.payments;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Payment confirmation is server-only';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status = 'paid' then
    return;
  end if;

  -- The capture must reference the provider order that razorpay-create-order
  -- recorded for THIS lelam order. Without this check a valid signature from a
  -- cheap payment could be replayed onto an expensive order.
  select * into v_payment
  from public.payments
  where order_id = p_order_id
    and provider = p_provider
    and provider_order_id = p_provider_order_id
  for update;

  if not found then
    raise exception 'Payment does not belong to this order';
  end if;

  if v_payment.amount_paise <> v_order.total_paise then
    raise exception 'Payment amount does not match the order total';
  end if;

  if v_payment.status = 'refunded' then
    raise exception 'Payment was refunded';
  end if;

  update public.orders
  set status = 'processing',
      payment_status = 'paid',
      paid_at = now()
  where id = p_order_id;

  update public.products p
  set status = 'sold'
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.product_id = p.id
    and p.is_unique;

  update public.payments
  set provider_payment_id = p_provider_payment_id,
      status = 'captured',
      signature_verified = true,
      updated_at = now()
  where id = v_payment.id;

  if not exists (
    select 1 from public.seller_settlements where order_id = p_order_id
  ) then
    insert into public.seller_settlements (
      seller_id, order_id, source, asking_price_paise,
      seller_payout_paise, platform_commission_paise, status
    )
    values (
      v_order.seller_id, p_order_id,
      case
        when v_order.source = 'offer' then 'offer'
        when v_order.source = 'auction' then 'auction'
        else 'marketplace'
      end,
      v_order.subtotal_paise,
      public.seller_payout_paise(v_order.subtotal_paise),
      public.platform_fee_paise(v_order.subtotal_paise),
      'pending'
    );
  end if;

  perform public.notify_user(
    v_order.buyer_id, 'payment_confirmed', 'Payment confirmed',
    'Your order is now being prepared.', jsonb_build_object('href', '#/order/' || p_order_id::text)
  );
  perform public.notify_user(
    v_order.seller_id, 'order_paid', 'Order paid',
    'The buyer completed payment. Arrange pickup.', jsonb_build_object('href', '#/seller?tab=orders')
  );
end;
$$;

revoke all on function public.confirm_order_payment(uuid, text, text, text) from public;
grant execute on function public.confirm_order_payment(uuid, text, text, text) to service_role;

-- =========================================================
-- 3. CASH-ON-DELIVERY SETTLEMENT MATHS
-- =========================================================

create or replace function public.confirm_cod_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if not (v_order.seller_id = auth.uid() or public.is_admin()) then
    raise exception 'Only the seller can confirm cash collection';
  end if;

  if coalesce(v_order.payment_method, 'cod') <> 'cod' then
    raise exception 'Not a cash-on-delivery order';
  end if;

  if v_order.payment_status = 'paid' then
    return;
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'Confirm cash collection after delivery';
  end if;

  update public.orders
  set payment_status = 'paid', paid_at = now()
  where id = p_order_id;

  if not exists (
    select 1 from public.seller_settlements where order_id = p_order_id
  ) then
    insert into public.seller_settlements (
      seller_id, order_id, source, asking_price_paise,
      seller_payout_paise, platform_commission_paise, status
    )
    values (
      v_order.seller_id, p_order_id,
      case
        when v_order.source = 'offer' then 'offer'
        when v_order.source = 'auction' then 'auction'
        else 'marketplace'
      end,
      v_order.subtotal_paise,
      public.seller_payout_paise(v_order.subtotal_paise),
      public.platform_fee_paise(v_order.subtotal_paise),
      'pending'
    );
  end if;

  perform public.notify_user(
    v_order.buyer_id, 'payment_confirmed', 'Payment completed',
    'Cash on delivery was collected for your order.',
    jsonb_build_object('href', '#/order/' || p_order_id::text)
  );
  perform public.notify_user(
    v_order.seller_id, 'payout_scheduled', 'Cash collected',
    'The order is now eligible for settlement.',
    jsonb_build_object('href', '#/seller?tab=earnings')
  );
end;
$$;

revoke all on function public.confirm_cod_payment(uuid) from public;
grant execute on function public.confirm_cod_payment(uuid) to authenticated;

create or replace function public.place_order(
  p_address_id uuid,
  p_product_id uuid default null,
  p_offer_id uuid default null,
  p_quantity integer default 1,
  p_payment_method text default 'cod'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_address public.addresses;
  v_offer public.offers;
  v_product public.products;
  v_lines jsonb := '[]'::jsonb;
  v_seller uuid;
  v_order_id uuid;
  v_order_ids jsonb := '[]'::jsonb;
  v_subtotal integer;
  v_shipping integer;
  v_total integer := 0;
  v_free integer := 199900;
  v_prefixes jsonb;
  v_is_cart boolean := p_product_id is null and p_offer_id is null;
  v_group uuid := gen_random_uuid();
  v_line record;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  if p_payment_method not in ('upi', 'card', 'cod') then
    raise exception 'Invalid payment method';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_uid and not is_blocked
  ) then
    raise exception 'Account unavailable';
  end if;

  select * into v_address
  from public.addresses
  where id = p_address_id and user_id = v_uid;

  if not found then
    raise exception 'Choose a delivery address';
  end if;

  select value into v_prefixes
  from public.platform_settings
  where key = 'serviceable_pincode_prefixes';

  if not exists (
    select 1
    from jsonb_array_elements_text(coalesce(v_prefixes, '[]'::jsonb)) as x(prefix)
    where v_address.pincode like x.prefix || '%'
  ) then
    raise exception 'Delivery is not available for this pincode';
  end if;

  if p_offer_id is not null then
    select * into v_offer
    from public.offers
    where id = p_offer_id and buyer_id = v_uid
    for update;

    if not found or v_offer.status not in ('accepted', 'converted') then
      raise exception 'Offer is not ready for checkout';
    end if;

    if v_offer.checkout_expires_at is not null
       and v_offer.checkout_expires_at < now() then
      raise exception 'Offer checkout has expired';
    end if;

    select * into v_product
    from public.products
    where id = v_offer.product_id
    for update;

    if not found or v_product.status not in ('active', 'reserved') then
      raise exception 'Listing is not available';
    end if;

    if not exists (
      select 1 from public.profiles
      where id = v_product.seller_id and not is_blocked
    ) then
      raise exception 'Listing is not available';
    end if;

    v_lines := jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'seller_id', v_product.seller_id,
      'title', v_product.title,
      'image', (
        select url from public.product_images
        where product_id = v_product.id
        order by sort_order limit 1
      ),
      'unit_price', v_offer.amount_paise,
      'quantity', 1,
      'shipping_fee', v_product.shipping_fee_paise,
      'is_unique', true
    ));
  elsif p_product_id is not null then
    select * into v_product
    from public.products
    where id = p_product_id
    for update;

    if not found or v_product.status <> 'active' or v_product.quantity < 1 then
      raise exception 'Listing is not available';
    end if;

    if v_product.seller_id = v_uid then
      raise exception 'You cannot buy your own listing';
    end if;

    if not exists (
      select 1 from public.profiles
      where id = v_product.seller_id and not is_blocked
    ) then
      raise exception 'Listing is not available';
    end if;

    v_lines := jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'seller_id', v_product.seller_id,
      'title', v_product.title,
      'image', (
        select url from public.product_images
        where product_id = v_product.id
        order by sort_order limit 1
      ),
      'unit_price', v_product.asking_price_paise,
      'quantity', greatest(1, least(p_quantity, v_product.quantity)),
      'shipping_fee', v_product.shipping_fee_paise,
      'is_unique', v_product.is_unique
    ));
  else
    -- Lock every product in the cart in a stable order before validating stock.
    -- Two concurrent cart checkouts would otherwise both pass the availability
    -- check and decrement the same quantity, overselling the listing.
    perform 1
    from public.products p
    join public.cart_items ci on ci.product_id = p.id
    join public.carts c on c.id = ci.cart_id
    where c.user_id = v_uid
    order by p.id
    for update of p;

    if exists (
      select 1
      from public.cart_items ci
      join public.carts c on c.id = ci.cart_id
      join public.products p on p.id = ci.product_id
      where c.user_id = v_uid
        and (p.seller_id = v_uid or p.quantity < ci.quantity)
    ) then
      raise exception 'An item in your cart is no longer available';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', p.id,
      'seller_id', p.seller_id,
      'title', p.title,
      'image', (
        select url from public.product_images
        where product_id = p.id
        order by sort_order limit 1
      ),
      'unit_price', p.asking_price_paise,
      'quantity', ci.quantity,
      'shipping_fee', p.shipping_fee_paise,
      'is_unique', p.is_unique
    )), '[]'::jsonb)
    into v_lines
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id
    join public.products p on p.id = ci.product_id
    where c.user_id = v_uid and p.status = 'active';

    if jsonb_array_length(v_lines) = 0 then
      raise exception 'Your cart is empty';
    end if;
  end if;

  select coalesce((value)::text::integer, 199900)
    into v_free
  from public.platform_settings
  where key = 'free_shipping_threshold_paise';

  for v_seller in
    select distinct (x->>'seller_id')::uuid
    from jsonb_array_elements(v_lines) x
  loop
    select
      sum((x->>'unit_price')::integer * (x->>'quantity')::integer),
      max((x->>'shipping_fee')::integer)
    into v_subtotal, v_shipping
    from jsonb_array_elements(v_lines) x
    where (x->>'seller_id')::uuid = v_seller;

    if v_subtotal >= v_free then
      v_shipping := 0;
    end if;

    insert into public.orders (
      buyer_id, seller_id, status, source,
      subtotal_paise, shipping_paise, total_paise,
      payment_status, payment_method, offer_id, shipping_address,
      checkout_group_id, payment_deadline
    )
    values (
      v_uid, v_seller,
      case when p_payment_method = 'cod' then 'processing' else 'pending_payment' end,
      case
        when p_offer_id is not null then 'offer'
        when p_product_id is not null then 'buy_now'
        else 'cart'
      end,
      v_subtotal, v_shipping, v_subtotal + v_shipping,
      'pending', p_payment_method, p_offer_id, to_jsonb(v_address),
      v_group,
      case when p_payment_method = 'cod' then null
           else now() + interval '30 minutes' end
    )
    returning id into v_order_id;

    insert into public.order_items (
      order_id, product_id, title_snapshot, image_snapshot, price_paise, quantity
    )
    select
      v_order_id,
      (x->>'product_id')::uuid,
      x->>'title',
      x->>'image',
      (x->>'unit_price')::integer,
      (x->>'quantity')::integer
    from jsonb_array_elements(v_lines) x
    where (x->>'seller_id')::uuid = v_seller;

    for v_line in
      select *
      from jsonb_to_recordset(v_lines) as x(
        product_id uuid,
        seller_id uuid,
        quantity integer,
        is_unique boolean
      )
      where x.seller_id = v_seller
    loop
      if v_line.is_unique then
        update public.products
        set status = 'reserved'
        where id = v_line.product_id;
      else
        update public.products
        set quantity = greatest(0, quantity - v_line.quantity)
        where id = v_line.product_id;
      end if;
    end loop;

    perform public.notify_user(
      v_seller,
      'order_created',
      'New order received',
      'A buyer placed an order for your listing.',
      jsonb_build_object('href', '#/seller?tab=orders', 'orderId', v_order_id)
    );

    v_order_ids := v_order_ids || to_jsonb(v_order_id);
    v_total := v_total + v_subtotal + v_shipping;
  end loop;

  if p_offer_id is not null then
    update public.offers set status = 'converted' where id = p_offer_id;
  end if;

  if v_is_cart then
    delete from public.cart_items
    using public.carts
    where cart_items.cart_id = carts.id
      and carts.user_id = v_uid;
  end if;

  return jsonb_build_object('orderIds', v_order_ids, 'totalPaise', v_total);
end;
$$;

revoke all on function public.place_order(uuid, uuid, uuid, integer, text) from public;
grant execute on function public.place_order(uuid, uuid, uuid, integer, text) to authenticated;
-- =========================================================
-- 4. OFFER + PAYMENT EXPIRY
-- =========================================================

create or replace function public.expire_offers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
  v_count integer := 0;
begin
  -- Pending offers past their seller-response window.
  for v_offer in
    select *
    from public.offers
    where status = 'pending'
      and expires_at is not null
      and expires_at < now()
    for update skip locked
  loop
    update public.offers
    set status = 'expired', responded_at = now()
    where id = v_offer.id;

    perform public.notify_user(
      v_offer.buyer_id, 'offer_expired', 'Offer expired',
      'The seller did not respond in time.',
      jsonb_build_object('href', '#/account?tab=offers')
    );
    perform public.notify_user(
      v_offer.seller_id, 'offer_expired', 'Offer expired',
      'An offer lapsed before it was answered.',
      jsonb_build_object('href', '#/seller?tab=offers')
    );

    v_count := v_count + 1;
  end loop;

  -- Accepted offers whose checkout window passed: release the reserved listing
  -- so it can be bought by someone else.
  for v_offer in
    select *
    from public.offers
    where status = 'accepted'
      and checkout_expires_at is not null
      and checkout_expires_at < now()
    for update skip locked
  loop
    update public.offers
    set status = 'expired', responded_at = now()
    where id = v_offer.id;

    update public.products
    set status = 'active'
    where id = v_offer.product_id
      and status = 'reserved';

    perform public.notify_user(
      v_offer.buyer_id, 'offer_expired', 'Offer checkout expired',
      'The listing is back on the rail. Make a new offer if you are still interested.',
      jsonb_build_object('href', '#/product/' || v_offer.product_id::text)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_offers() from public;
grant execute on function public.expire_offers() to service_role;

create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_count integer := 0;
begin
  for v_order in
    select *
    from public.orders
    where status = 'pending_payment'
      and payment_status = 'pending'
      and payment_deadline is not null
      and payment_deadline < now()
    for update skip locked
  loop
    update public.orders
    set status = 'expired',
        payment_status = 'expired'
    where id = v_order.id;

    update public.payments
    set status = 'failed', updated_at = now()
    where order_id = v_order.id
      and status in ('created', 'authorized');

    update public.products p
    set status = 'active'
    from public.order_items oi
    where oi.order_id = v_order.id
      and oi.product_id = p.id
      and p.is_unique
      and p.status = 'reserved';

    update public.products p
    set quantity = p.quantity + oi.quantity
    from public.order_items oi
    where oi.order_id = v_order.id
      and oi.product_id = p.id
      and not p.is_unique;

    perform public.notify_user(
      v_order.buyer_id, 'order_expired', 'Payment window expired',
      'The order was released because payment was not completed in time.',
      jsonb_build_object('href', '#/account?tab=orders')
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_unpaid_orders() from public;
grant execute on function public.expire_unpaid_orders() to service_role;

create or replace function public.run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orders integer;
  v_offers integer;
begin
  v_orders := public.expire_unpaid_orders();
  v_offers := public.expire_offers();

  return jsonb_build_object(
    'expiredOrders', v_orders,
    'expiredOffers', v_offers
  );
end;
$$;

revoke all on function public.run_maintenance() from public;
grant execute on function public.run_maintenance() to service_role;

-- Accepting an offer must lock the listing first. Otherwise a buy-now checkout
-- can reserve the same product between the status check and the reservation.
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
  v_offer public.offers;
  v_product public.products;
  v_hours integer := 24;
begin
  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found or v_offer.seller_id <> auth.uid() then
    raise exception 'Offer not found';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'This offer is no longer pending';
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
        responded_at = now(),
        checkout_expires_at = now() + make_interval(hours => v_hours)
    where id = p_offer_id;

    update public.offers
    set status = 'rejected', responded_at = now()
    where product_id = v_offer.product_id
      and id <> p_offer_id
      and status = 'pending';

    update public.products
    set status = 'reserved'
    where id = v_offer.product_id;
  else
    update public.offers
    set status = 'rejected', responded_at = now()
    where id = p_offer_id;
  end if;

  perform public.notify_user(
    v_offer.buyer_id,
    case when p_accept then 'offer_accepted' else 'offer_rejected' end,
    case when p_accept then 'Your offer was accepted' else 'Offer not accepted' end,
    case when p_accept
      then 'The seller accepted your offer. Complete checkout before it expires.'
      else 'The seller passed on your offer.'
    end,
    jsonb_build_object('href', '#/account?tab=offers')
  );
end;
$$;

revoke all on function public.respond_to_offer(uuid, boolean) from public;
grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;

-- =========================================================
-- 5. ADMIN VISIBILITY
-- =========================================================

-- profiles_select_own only lets an admin read their own row, which left the
-- admin users tab empty. Policies are OR-ed, so this opens all rows to admins.
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
for select to authenticated
using (public.is_admin());

-- =========================================================
-- 6. PUBLIC PRODUCTS: NO INTERNAL NOTES, NO BLOCKED SELLERS
-- =========================================================

create or replace view public.public_products
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

-- =========================================================
-- 7. PAYMENT LEDGER INTEGRITY
-- =========================================================

-- A captured Razorpay payment id must map to exactly one attempt. Guarded so a
-- database that already contains duplicates still completes the migration.
do $$
begin
  execute 'create unique index if not exists payments_provider_payment_idx
    on public.payments (provider_payment_id)
    where provider_payment_id is not null';
exception when unique_violation then
  raise notice 'Skipped payments_provider_payment_idx: duplicate provider_payment_id rows exist';
end $$;

-- =========================================================
-- 8. SCHEDULER
-- =========================================================

-- Sweep expired orders and offers every five minutes. When pg_cron is not
-- available (local Postgres/PGlite) the migration still applies; call
-- public.run_maintenance() from the maintenance edge function instead.
do $$
begin
  execute 'create extension if not exists pg_cron';

  begin
    perform cron.unschedule('lelam-maintenance');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'lelam-maintenance',
    '*/5 * * * *',
    'select public.run_maintenance();'
  );
exception when others then
  raise notice 'pg_cron unavailable (%); schedule public.run_maintenance() externally', sqlerrm;
end $$;
