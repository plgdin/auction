-- ============================================================================
-- lelam.co — Supabase backend addendum
-- Apply AFTER 20260101000000_marketplace_schema.sql.
-- Money is integer paise. Auctions stay read-only.
-- ============================================================================

-- =========================================================
-- 1. COLUMNS, INDEXES, SUPPORT TABLES
-- =========================================================

-- gen_random_uuid() is built in on PostgreSQL 13+; no extension needed.
alter table public.products add column if not exists size text;
alter table public.products add column if not exists tag text;
alter table public.products add column if not exists color text default '#e8e6df';

-- The frontend tracks when an offer lapses; the base table only had the
-- post-acceptance checkout window.
alter table public.offers add column if not exists expires_at timestamptz;

alter table public.products add column if not exists search_vector tsvector
generated always as (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(brand, '')
  )
) stored;

create index if not exists products_search_idx
  on public.products using gin (search_vector);

create unique index if not exists cart_items_cart_product_idx
  on public.cart_items (cart_id, product_id);

alter table public.orders add column if not exists payment_method text
  default 'cod' check (payment_method in ('upi', 'card', 'cod'));

create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shipment_events_shipment_idx
  on public.shipment_events (shipment_id, created_at desc);

create sequence if not exists public.order_number_seq;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'LL' || to_char(now(), 'YYMMDD') ||
         lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

alter table public.orders
  alter column order_number set default public.next_order_number();

-- =========================================================
-- 2. AUTH PROFILE LINK
-- =========================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_auth_fk'
  ) then
    alter table public.profiles
      add constraint profiles_auth_fk
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_seller boolean;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_seller := coalesce((new.raw_user_meta_data->>'as_seller')::boolean, false);

  insert into public.profiles (id, email, full_name, is_seller)
  values (new.id, coalesce(new.email, ''), v_name, v_seller)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  if v_seller then
    insert into public.seller_profiles (user_id, display_name)
    values (new.id, v_name)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and not is_blocked
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- =========================================================
-- 3. SAFE PUBLIC VIEWS
-- =========================================================

create or replace view public.public_profiles
with (security_invoker = false)
as
select
  id,
  full_name,
  avatar_url,
  is_seller,
  created_at
from public.profiles
where is_blocked = false;

grant select on public.public_profiles to anon, authenticated;

create or replace view public.public_sellers
with (security_invoker = false)
as
select
  p.id,
  p.full_name,
  p.avatar_url,
  sp.bio,
  sp.location,
  sp.is_verified,
  sp.created_at,
  coalesce(round(avg(r.rating)::numeric, 1), 0) as rating,
  count(r.id)::int as review_count
from public.profiles p
join public.seller_profiles sp on sp.user_id = p.id
left join public.reviews r on r.seller_id = p.id
where p.is_blocked = false
group by p.id, p.full_name, p.avatar_url, sp.bio, sp.location,
         sp.is_verified, sp.created_at;

grant select on public.public_sellers to anon, authenticated;

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
  p.moderation_note,
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
where p.status in ('active', 'reserved')
   or p.seller_id = auth.uid()
   or public.is_admin();

grant select on public.public_products to anon, authenticated;

-- =========================================================
-- 4. ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.addresses enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.saved_products enable row level security;
alter table public.offers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.notifications enable row level security;
alter table public.product_reports enable row level security;
alter table public.reviews enable row level security;
alter table public.seller_settlements enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.inventory_reservations enable row level security;

-- Profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- Seller profiles
drop policy if exists seller_profiles_select on public.seller_profiles;
create policy seller_profiles_select on public.seller_profiles
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists seller_profiles_update on public.seller_profiles;
create policy seller_profiles_update on public.seller_profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke insert, update, delete on public.seller_profiles from anon, authenticated;
grant select on public.seller_profiles to authenticated;
grant update (display_name, bio, location, pickup_address, pickup_phone)
  on public.seller_profiles to authenticated;

-- Categories
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
for select to anon, authenticated
using (is_active or public.is_admin());

grant select on public.categories to anon, authenticated;
revoke insert, update, delete on public.categories from anon, authenticated;

-- Addresses
drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.addresses to authenticated;

-- Products / images: read only from the client
drop policy if exists products_read on public.products;
create policy products_read on public.products
for select to anon, authenticated
using (
  status in ('active', 'reserved')
  or seller_id = auth.uid()
  or public.is_admin()
);

drop policy if exists product_images_read on public.product_images;
create policy product_images_read on public.product_images
for select to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_id
      and (
        p.status in ('active', 'reserved')
        or p.seller_id = auth.uid()
        or public.is_admin()
      )
  )
);

grant select on public.products to anon, authenticated;
grant select on public.product_images to anon, authenticated;
revoke insert, update, delete on public.products from anon, authenticated;
revoke insert, update, delete on public.product_images from anon, authenticated;

-- Carts
drop policy if exists carts_own on public.carts;
create policy carts_own on public.carts
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists cart_items_own on public.cart_items;
create policy cart_items_own on public.cart_items
for all to authenticated
using (
  exists (
    select 1 from public.carts c
    where c.id = cart_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.carts c
    join public.products p on p.id = product_id
    where c.id = cart_id
      and c.user_id = auth.uid()
      and p.status = 'active'
      and p.seller_id <> auth.uid()
  )
);

grant select, insert, update, delete on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

-- Saved products
drop policy if exists saved_products_own on public.saved_products;
create policy saved_products_own on public.saved_products
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, delete on public.saved_products to authenticated;

-- Offers: writes through RPCs
drop policy if exists offers_read on public.offers;
create policy offers_read on public.offers
for select to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or public.is_admin()
);

grant select on public.offers to authenticated;
revoke insert, update, delete on public.offers from anon, authenticated;

-- Orders / items: writes through RPCs
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
for select to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or public.is_admin()
);

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.buyer_id = auth.uid()
        or o.seller_id = auth.uid()
        or public.is_admin()
      )
  )
);

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;

-- Payments
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.buyer_id = auth.uid()
        or o.seller_id = auth.uid()
        or public.is_admin()
      )
  )
);

grant select on public.payments to authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;

-- Shipments
drop policy if exists shipments_read on public.shipments;
create policy shipments_read on public.shipments
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.buyer_id = auth.uid()
        or o.seller_id = auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists shipment_events_read on public.shipment_events;
create policy shipment_events_read on public.shipment_events
for select to authenticated
using (
  exists (
    select 1 from public.shipments s
    join public.orders o on o.id = s.order_id
    where s.id = shipment_id
      and (
        o.buyer_id = auth.uid()
        or o.seller_id = auth.uid()
        or public.is_admin()
      )
  )
);

grant select on public.shipments to authenticated;
grant select on public.shipment_events to authenticated;
revoke insert, update, delete on public.shipments from anon, authenticated;
revoke insert, update, delete on public.shipment_events from anon, authenticated;

-- Notifications
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
for select to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Reports
drop policy if exists reports_read on public.product_reports;
create policy reports_read on public.product_reports
for select to authenticated
using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists reports_insert on public.product_reports;
create policy reports_insert on public.product_reports
for insert to authenticated
with check (reporter_id = auth.uid());

grant select, insert on public.product_reports to authenticated;
revoke update, delete on public.product_reports from anon, authenticated;

-- Reviews: public read, writes through RPC
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
for select to anon, authenticated
using (true);

grant select on public.reviews to anon, authenticated;
revoke insert, update, delete on public.reviews from anon, authenticated;

-- Settlements
drop policy if exists settlements_read on public.seller_settlements;
create policy settlements_read on public.seller_settlements
for select to authenticated
using (seller_id = auth.uid() or public.is_admin());

grant select on public.seller_settlements to authenticated;
revoke insert, update, delete on public.seller_settlements from anon, authenticated;

-- Settings
drop policy if exists settings_read on public.platform_settings;
create policy settings_read on public.platform_settings
for select to anon, authenticated
using (true);

grant select on public.platform_settings to anon, authenticated;
revoke insert, update, delete on public.platform_settings from anon, authenticated;

-- Audit logs
drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
for select to authenticated
using (public.is_admin());

grant select on public.audit_logs to authenticated;
revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- Auctions: read only
drop policy if exists auctions_read on public.auctions;
create policy auctions_read on public.auctions
for select to anon, authenticated
using (true);

drop policy if exists bids_read on public.bids;
create policy bids_read on public.bids
for select to anon, authenticated
using (true);

grant select on public.auctions to anon, authenticated;
grant select on public.bids to anon, authenticated;
revoke insert, update, delete on public.auctions from anon, authenticated;
revoke insert, update, delete on public.bids from anon, authenticated;

-- Internal tables. Supabase grants broad table privileges by default, so lock
-- these down explicitly and let RLS deny everything to client roles.
alter table public.schema_migrations enable row level security;
alter table public.auction_selection_history enable row level security;
alter table public.auction_financial_records enable row level security;
alter table public.auth_attempts enable row level security;

revoke all on public.schema_migrations from anon, authenticated;
revoke all on public.auction_selection_history from anon, authenticated;
revoke all on public.auction_financial_records from anon, authenticated;
revoke all on public.auth_attempts from anon, authenticated;
revoke all on public.inventory_reservations from anon, authenticated;

revoke all on sequence public.order_number_seq from anon, authenticated;
revoke all on sequence public.categories_id_seq from anon, authenticated;

-- =========================================================
-- 5. FUNCTIONS
-- =========================================================

create or replace function public.notify_user(
  p_user uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, p_data);
$$;

revoke all on function public.notify_user(uuid, text, text, text, jsonb) from public;

create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
$$;

revoke all on function public.log_audit(text, text, text, jsonb) from public;

create or replace function public.become_seller(p_display_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select coalesce(nullif(p_display_name, ''), full_name, split_part(email, '@', 1))
    into v_name
  from public.profiles
  where id = auth.uid();

  update public.profiles set is_seller = true where id = auth.uid();

  insert into public.seller_profiles (user_id, display_name)
  values (auth.uid(), coalesce(v_name, 'Seller'))
  on conflict (user_id) do update
    set display_name = coalesce(nullif(excluded.display_name, ''), seller_profiles.display_name);
end;
$$;

revoke all on function public.become_seller(text) from public;
grant execute on function public.become_seller(text) to authenticated;

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
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_uid and not is_blocked and (is_seller or role = 'admin')
  ) then
    raise exception 'Seller account required';
  end if;

  if v_title = '' or v_description = '' or v_price <= 0 then
    raise exception 'Title, description and price are required';
  end if;

  if v_condition not in ('new', 'like_new', 'good', 'fair') then
    raise exception 'Invalid condition';
  end if;

  if coalesce(array_length(p_images, 1), 0) = 0 then
    raise exception 'Add at least one photo';
  end if;

  select coalesce((value)::text::boolean, true)
    into v_auto
  from public.platform_settings
  where key = 'seller_auto_approve';

  v_auto := coalesce(v_auto, true);

  select id into v_category
  from public.categories
  where lower(name) = lower(coalesce(p_payload->>'category', 'Other'))
  limit 1;

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
      shipping_fee_paise, status, allow_offers, auction_consent, published_at
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
      case when v_auto then now() else null end
    )
    returning id into v_id;
  else
    select seller_id into v_seller
    from public.products
    where id = v_id
    for update;

    if v_seller is null then
      raise exception 'Listing not found';
    end if;

    if v_seller <> v_uid and not public.is_admin() then
      raise exception 'Not your listing';
    end if;

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
      shipping_fee_paise = greatest(
        0,
        coalesce((p_payload->>'shipping_fee_paise')::integer, shipping_fee_paise)
      ),
      allow_offers = coalesce((p_payload->>'allow_offers')::boolean, allow_offers),
      auction_consent = coalesce((p_payload->>'auction_consent')::boolean, auction_consent),
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

revoke all on function public.save_listing(jsonb, text[]) from public;
grant execute on function public.save_listing(jsonb, text[]) to authenticated;

create or replace function public.toggle_listing_availability(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set status = case
    when status = 'active' then 'removed'
    when status = 'removed' then 'active'
    else status
  end
  where id = p_product_id
    and (seller_id = auth.uid() or public.is_admin());

  if not found then
    raise exception 'Listing not found';
  end if;
end;
$$;

revoke all on function public.toggle_listing_availability(uuid) from public;
grant execute on function public.toggle_listing_availability(uuid) to authenticated;

create or replace function public.remove_listing(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set status = 'removed'
  where id = p_product_id
    and (seller_id = auth.uid() or public.is_admin());

  if not found then
    raise exception 'Listing not found';
  end if;
end;
$$;

revoke all on function public.remove_listing(uuid) from public;
grant execute on function public.remove_listing(uuid) to authenticated;

create or replace function public.make_offer(
  p_product_id uuid,
  p_amount_paise integer,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products;
  v_hours integer := 48;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found or v_product.status <> 'active' then
    raise exception 'Listing is not open for offers';
  end if;

  if v_product.seller_id = v_uid then
    raise exception 'This is your own listing';
  end if;

  if not v_product.allow_offers then
    raise exception 'The seller is not accepting offers';
  end if;

  if p_amount_paise <= 0 or p_amount_paise >= v_product.asking_price_paise then
    raise exception 'Offers must be below the asking price';
  end if;

  select coalesce((value)::text::integer, 48)
    into v_hours
  from public.platform_settings
  where key = 'offer_validity_hours';

  insert into public.offers (
    product_id, buyer_id, seller_id, amount_paise, message, expires_at
  )
  values (
    p_product_id, v_uid, v_product.seller_id, p_amount_paise,
    nullif(p_message, ''), now() + make_interval(hours => v_hours)
  )
  returning id into v_id;

  perform public.notify_user(
    v_product.seller_id,
    'offer_received',
    'New offer received',
    'A buyer sent an offer on your listing.',
    jsonb_build_object('href', '#/seller?tab=offers', 'offerId', v_id)
  );

  return v_id;
end;
$$;

revoke all on function public.make_offer(uuid, integer, text) from public;
grant execute on function public.make_offer(uuid, integer, text) to authenticated;

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
    if not exists (
      select 1 from public.products
      where id = v_offer.product_id and status = 'active'
    ) then
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

create or replace function public.cancel_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
begin
  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found or v_offer.buyer_id <> auth.uid() then
    raise exception 'Offer not found';
  end if;

  if v_offer.status not in ('pending', 'accepted') then
    raise exception 'This offer cannot be cancelled';
  end if;

  update public.offers
  set status = 'cancelled'
  where id = p_offer_id;

  if v_offer.status = 'accepted' then
    update public.products
    set status = 'active'
    where id = v_offer.product_id
      and status = 'reserved';
  end if;
end;
$$;

revoke all on function public.cancel_offer(uuid) from public;
grant execute on function public.cancel_offer(uuid) to authenticated;

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

create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_provider text,
  p_provider_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
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

  insert into public.payments (
    order_id, provider, provider_order_id, provider_payment_id,
    amount_paise, status, signature_verified, raw
  )
  values (
    p_order_id, p_provider, p_provider_payment_id, p_provider_payment_id,
    v_order.total_paise, 'captured', true, '{}'::jsonb
  );

  if not exists (
    select 1 from public.seller_settlements where order_id = p_order_id
  ) then
    insert into public.seller_settlements (
      seller_id, order_id, source, asking_price_paise,
      seller_payout_paise, status
    )
    values (
      v_order.seller_id, p_order_id,
      case when v_order.source = 'offer' then 'offer' else 'marketplace' end,
      v_order.subtotal_paise, v_order.subtotal_paise, 'pending'
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

revoke all on function public.confirm_order_payment(uuid, text, text) from public;
grant execute on function public.confirm_order_payment(uuid, text, text) to service_role;

create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if not (
    v_order.buyer_id = auth.uid()
    or v_order.seller_id = auth.uid()
    or public.is_admin()
  ) then
    raise exception 'Not your order';
  end if;

  if v_order.status not in ('pending_payment', 'paid', 'processing', 'awaiting_pickup') then
    raise exception 'This order can no longer be cancelled';
  end if;

  update public.orders
  set status = 'cancelled',
      cancelled_at = now(),
      payment_status = case when payment_status = 'paid' then 'refunded' else payment_status end,
      notes = coalesce(p_reason, notes)
  where id = p_order_id;

  for v_item in
    select oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.product_id is not null
  loop
    update public.products
    set status = 'active'
    where id = v_item.product_id
      and is_unique
      and status in ('reserved', 'sold');

    update public.products
    set quantity = quantity + v_item.quantity
    where id = v_item.product_id
      and not is_unique;
  end loop;

  perform public.notify_user(
    v_order.buyer_id, 'order_cancelled', 'Order cancelled',
    'The order was cancelled.', jsonb_build_object('href', '#/account?tab=orders')
  );
  perform public.notify_user(
    v_order.seller_id, 'order_cancelled', 'Order cancelled',
    'An order was cancelled.', jsonb_build_object('href', '#/seller?tab=orders')
  );
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public;
grant execute on function public.cancel_order(uuid, text) to authenticated;

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

  if not found then
    raise exception 'Order not found';
  end if;

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

  perform public.notify_user(
    v_order.buyer_id, 'shipment_update', 'Delivery update',
    'Your order status is now ' || replace(p_status, '_', ' ') || '.',
    jsonb_build_object('href', '#/order/' || p_order_id::text)
  );
end;
$$;

revoke all on function public.advance_shipment(uuid, text, text, text, text, text) from public;
grant execute on function public.advance_shipment(uuid, text, text, text, text, text) to authenticated;

create or replace function public.create_review(
  p_order_id uuid,
  p_rating integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_id uuid;
begin
  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found or v_order.buyer_id <> auth.uid() then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'Reviews open after delivery';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  if exists (select 1 from public.reviews where order_id = p_order_id) then
    raise exception 'This order has already been reviewed';
  end if;

  insert into public.reviews (
    order_id, product_id, buyer_id, seller_id, rating, comment
  )
  values (
    p_order_id,
    (select product_id from public.order_items where order_id = p_order_id limit 1),
    auth.uid(), v_order.seller_id, p_rating, nullif(p_comment, '')
  )
  returning id into v_id;

  perform public.notify_user(
    v_order.seller_id, 'review_received', 'New review',
    'A buyer rated their order ' || p_rating || ' stars.',
    jsonb_build_object('href', '#/seller?tab=overview')
  );

  return v_id;
end;
$$;

revoke all on function public.create_review(uuid, integer, text) from public;
grant execute on function public.create_review(uuid, integer, text) to authenticated;

create or replace function public.request_return(
  p_order_id uuid,
  p_reason text default null
)
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

  if not found or v_order.buyer_id <> auth.uid() then
    raise exception 'Order not found';
  end if;

  if v_order.status = 'returned' then
    return;
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'Only delivered orders can be returned';
  end if;

  update public.orders
  set status = 'returned'
  where id = p_order_id;

  update public.shipments
  set status = 'returned', updated_at = now()
  where order_id = p_order_id;

  insert into public.shipment_events (shipment_id, status, note, created_by)
  select s.id, 'returned',
         coalesce(p_reason, 'Return requested by buyer.'), auth.uid()
  from public.shipments s
  where s.order_id = p_order_id;

  perform public.notify_user(
    v_order.seller_id, 'return_requested', 'Return requested',
    'The buyer requested a return.',
    jsonb_build_object('href', '#/seller?tab=orders')
  );
end;
$$;

revoke all on function public.request_return(uuid, text) from public;
grant execute on function public.request_return(uuid, text) to authenticated;

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
      seller_payout_paise, status
    )
    values (
      v_order.seller_id, p_order_id,
      case when v_order.source = 'offer' then 'offer' else 'marketplace' end,
      v_order.subtotal_paise, v_order.subtotal_paise, 'pending'
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
    set status = 'expired'
    where id = v_order.id;

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

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_unpaid_orders() from public;
grant execute on function public.expire_unpaid_orders() to service_role;

create or replace function public.admin_review_product(
  p_product_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  update public.products
  set status = case when p_approve then 'active' else 'rejected' end,
      published_at = case when p_approve then now() else published_at end,
      moderation_note = case when p_approve then null else p_reason end
  where id = p_product_id;

  perform public.log_audit(
    case when p_approve then 'listing.approved' else 'listing.rejected' end,
    'product', p_product_id::text,
    jsonb_build_object('reason', p_reason)
  );

  perform public.notify_user(
    v_product.seller_id,
    case when p_approve then 'listing_approved' else 'listing_rejected' end,
    case when p_approve then 'Listing approved' else 'Listing needs changes' end,
    case when p_approve
      then 'Your listing is now live.'
      else coalesce(p_reason, 'Your listing was not approved.')
    end,
    jsonb_build_object('href', '#/seller?tab=listings')
  );
end;
$$;

revoke all on function public.admin_review_product(uuid, boolean, text) from public;
grant execute on function public.admin_review_product(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_user_blocked(
  p_user_id uuid,
  p_blocked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.profiles
  set is_blocked = p_blocked
  where id = p_user_id;

  perform public.log_audit(
    case when p_blocked then 'user.blocked' else 'user.unblocked' end,
    'profile', p_user_id::text
  );
end;
$$;

revoke all on function public.admin_set_user_blocked(uuid, boolean) from public;
grant execute on function public.admin_set_user_blocked(uuid, boolean) to authenticated;

create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if p_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'Invalid report status';
  end if;

  update public.product_reports
  set status = p_status,
      resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end
  where id = p_report_id;

  if not found then
    raise exception 'Report not found';
  end if;

  perform public.log_audit(
    'report.' || p_status, 'product_report', p_report_id::text
  );
end;
$$;

revoke all on function public.admin_resolve_report(uuid, text) from public;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

create or replace function public.admin_mark_settlement_paid(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.seller_settlements;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select * into v_settlement
  from public.seller_settlements
  where id = p_settlement_id;

  if not found then
    raise exception 'Settlement not found';
  end if;

  update public.seller_settlements
  set status = 'paid', paid_at = now()
  where id = p_settlement_id;

  perform public.log_audit(
    'settlement.paid', 'seller_settlement', p_settlement_id::text
  );

  perform public.notify_user(
    v_settlement.seller_id, 'payout_paid', 'Payout sent',
    'Your seller payout has been marked as paid.',
    jsonb_build_object('href', '#/seller?tab=earnings')
  );
end;
$$;

revoke all on function public.admin_mark_settlement_paid(uuid) from public;
grant execute on function public.admin_mark_settlement_paid(uuid) to authenticated;

create or replace function public.admin_update_setting(
  p_key text,
  p_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  insert into public.platform_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now();

  perform public.log_audit(
    'setting.updated', 'platform_setting', p_key,
    jsonb_build_object('value', p_value)
  );
end;
$$;

revoke all on function public.admin_update_setting(text, jsonb) from public;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;

create or replace function public.increment_product_views(p_product_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products
  set view_count = view_count + 1
  where id = p_product_id and status = 'active';
$$;

revoke all on function public.increment_product_views(uuid) from public;
grant execute on function public.increment_product_views(uuid) to anon, authenticated;

-- =========================================================
-- 6. STORAGE
-- =========================================================

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_storage_read on storage.objects;
create policy product_images_storage_read on storage.objects
for select to public
using (bucket_id = 'product-images');

drop policy if exists product_images_storage_insert on storage.objects;
create policy product_images_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists product_images_storage_update on storage.objects;
create policy product_images_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists product_images_storage_delete on storage.objects;
create policy product_images_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- =========================================================
-- 7. CATEGORY RESET
-- =========================================================

delete from public.categories
where slug in ('outerwear', 'tops-knits', 'denim', 'accessories')
  and not exists (
    select 1 from public.products p where p.category_id = public.categories.id
  );

update public.categories
set is_active = false
where slug in ('outerwear', 'tops-knits', 'denim', 'accessories');

insert into public.categories (name, slug, sort_order, is_active) values
  ('Clothing', 'clothing', 1, true),
  ('Footwear', 'footwear', 2, true),
  ('Bags & accessories', 'bags-accessories', 3, true),
  ('Electronics', 'electronics', 4, true),
  ('Mobile & tablets', 'mobile-tablets', 5, true),
  ('Computers & gaming', 'computers-gaming', 6, true),
  ('Home & living', 'home-living', 7, true),
  ('Furniture', 'furniture', 8, true),
  ('Kitchen & dining', 'kitchen-dining', 9, true),
  ('Books & media', 'books-media', 10, true),
  ('Sports & outdoors', 'sports-outdoors', 11, true),
  ('Toys & games', 'toys-games', 12, true),
  ('Beauty & care', 'beauty-care', 13, true),
  ('Art & collectibles', 'art-collectibles', 14, true),
  ('Music & instruments', 'music-instruments', 15, true),
  ('Other', 'other', 16, true)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

-- =========================================================
-- 8. AUCTIONS OFF + ADMIN BOOTSTRAP
-- =========================================================

update public.platform_settings
set value = 'false'::jsonb, updated_at = now()
where key = 'auction_engine_enabled';

insert into public.profiles (id, email, full_name)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

update public.profiles
set role = 'admin', is_seller = true, is_blocked = false
where lower(email) = 'admin@lelam.com';

insert into public.seller_profiles (user_id, display_name, is_verified)
select p.id, p.full_name, true
from public.profiles p
where lower(p.email) = 'admin@lelam.com'
on conflict (user_id) do update set is_verified = true;

-- =========================================================
-- 9. REALTIME
-- =========================================================

alter table public.notifications replica identity full;
alter table public.orders replica identity full;
-- products carries a generated tsvector column, which PostgreSQL refuses to
-- include in REPLICA IDENTITY FULL. Realtime only needs the change signal here.
alter table public.offers replica identity full;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['notifications', 'orders', 'products', 'offers', 'shipments']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
