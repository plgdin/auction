-- lelam.co marketplace schema
-- Portable PostgreSQL 15+. All money is stored as integer paise.
-- This migration is safe to run on Supabase and on the local PGlite runtime.

create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text,
  full_name text not null default '',
  phone text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_seller boolean not null default false,
  is_blocked boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_lower_idx on profiles (lower(email));

create table if not exists seller_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  location text not null default 'Trivandrum, Kerala',
  pickup_address text not null default '',
  pickup_phone text,
  auction_consent boolean not null default false,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id serial primary key,
  name text not null,
  slug text not null unique,
  parent_id integer references categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null default 'Trivandrum',
  state text not null default 'Kerala',
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on addresses (user_id);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  category_id integer references categories(id) on delete set null,
  title text not null,
  slug text not null,
  description text not null default '',
  brand text,
  condition text not null default 'good' check (condition in ('new', 'like_new', 'good', 'fair')),
  asking_price_paise integer not null check (asking_price_paise > 0),
  quantity integer not null default 1 check (quantity >= 0),
  is_unique boolean not null default true,
  location text not null default 'Trivandrum, Kerala',
  shipping_fee_paise integer not null default 4900 check (shipping_fee_paise >= 0),
  status text not null default 'pending' check (status in ('draft', 'pending', 'active', 'reserved', 'sold', 'removed', 'rejected')),
  allow_offers boolean not null default true,
  auction_consent boolean not null default false,
  moderation_note text,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists products_seller_idx on products (seller_id);
create index if not exists products_status_idx on products (status, created_at desc);
create index if not exists products_category_idx on products (category_id, status);
create index if not exists products_price_idx on products (asking_price_paise);
create unique index if not exists products_slug_idx on products (slug);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  alt text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on product_images (product_id, sort_order);

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table if not exists inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null default 1,
  reason text not null check (reason in ('checkout', 'offer', 'auction')),
  reference_id uuid,
  status text not null default 'active' check (status in ('active', 'released', 'consumed')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists reservations_product_idx on inventory_reservations (product_id, status);
create index if not exists reservations_reference_idx on inventory_reservations (reference_id);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired', 'converted', 'cancelled')),
  checkout_expires_at timestamptz,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists offers_product_idx on offers (product_id, status);
create index if not exists offers_seller_idx on offers (seller_id, status, created_at desc);
create index if not exists offers_buyer_idx on offers (buyer_id, status, created_at desc);
create unique index if not exists offers_one_pending_idx on offers (product_id, buyer_id) where status = 'pending';
create unique index if not exists offers_one_accepted_idx on offers (product_id) where status = 'accepted';

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  checkout_group_id uuid not null default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete restrict,
  seller_id uuid not null references profiles(id) on delete restrict,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'processing', 'awaiting_pickup', 'shipped', 'delivered', 'cancelled', 'returned', 'expired')),
  source text not null default 'buy_now' check (source in ('buy_now', 'cart', 'offer', 'auction')),
  subtotal_paise integer not null check (subtotal_paise >= 0),
  shipping_paise integer not null default 0 check (shipping_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'expired')),
  payment_deadline timestamptz,
  offer_id uuid references offers(id) on delete set null,
  auction_id uuid,
  shipping_address jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);
create index if not exists orders_buyer_idx on orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on orders (seller_id, created_at desc);
create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists orders_group_idx on orders (checkout_group_id);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  title_snapshot text not null,
  image_snapshot text,
  price_paise integer not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  checkout_group_id uuid,
  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  amount_paise integer not null,
  status text not null default 'created' check (status in ('created', 'authorized', 'captured', 'failed', 'refunded')),
  signature_verified boolean not null default false,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_order_idx on payments (order_id);
create index if not exists payments_group_idx on payments (checkout_group_id);
create unique index if not exists payments_provider_order_idx on payments (provider_order_id) where provider_order_id is not null;

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  provider text,
  status text not null default 'pending_pickup' check (status in ('pending_pickup', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned')),
  awb text,
  tracking_url text,
  pickup_scheduled_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  notes text,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auctions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled', 'expired')),
  starting_price_paise integer not null check (starting_price_paise > 0),
  asking_price_paise integer not null check (asking_price_paise > 0),
  current_bid_paise integer,
  highest_bidder_id uuid references profiles(id) on delete set null,
  bid_count integer not null default 0,
  min_increment_paise integer not null default 1000,
  anti_snipe_seconds integer not null default 10,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  original_ends_at timestamptz not null,
  settled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists auctions_status_idx on auctions (status, starts_at);
create index if not exists auctions_product_idx on auctions (product_id, created_at desc);
create index if not exists auctions_live_idx on auctions (status, ends_at);

create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references auctions(id) on delete cascade,
  bidder_id uuid not null references profiles(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  anonymous_number integer not null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists bids_auction_idx on bids (auction_id, created_at desc);
create unique index if not exists bids_one_per_amount_idx on bids (auction_id, bidder_id, amount_paise);
create unique index if not exists bids_anonymous_idx on bids (auction_id, anonymous_number);

create table if not exists auction_selection_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  auction_id uuid references auctions(id) on delete set null,
  selected_for date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists selection_product_idx on auction_selection_history (product_id, created_at desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id) where read_at is null;

create table if not exists seller_settlements (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete restrict,
  order_id uuid references orders(id) on delete set null,
  auction_id uuid references auctions(id) on delete set null,
  source text not null default 'marketplace' check (source in ('marketplace', 'offer', 'auction')),
  asking_price_paise integer not null default 0,
  winning_bid_paise integer,
  seller_payout_paise integer not null,
  platform_subsidy_paise integer not null default 0,
  platform_commission_paise integer not null default 0,
  payment_fee_paise integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'on_hold')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists settlements_seller_idx on seller_settlements (seller_id, status);
create index if not exists settlements_order_idx on seller_settlements (order_id);

create table if not exists auction_financial_records (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null unique references auctions(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  product_id uuid not null references products(id) on delete restrict,
  seller_id uuid not null references profiles(id) on delete restrict,
  asking_price_paise integer not null,
  starting_price_paise integer not null,
  winning_bid_paise integer,
  seller_payout_paise integer not null default 0,
  platform_subsidy_paise integer not null default 0,
  platform_commission_paise integer not null default 0,
  payment_fee_paise integer not null default 0,
  refund_paise integer not null default 0,
  outcome text not null default 'pending' check (outcome in ('pending', 'sold', 'unpaid', 'cancelled', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists auction_financial_month_idx on auction_financial_records (created_at desc);

create table if not exists product_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  reporter_id uuid references profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_seller_idx on reviews (seller_id, created_at desc);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_id);

create table if not exists auth_attempts (
  id bigserial primary key,
  email text,
  ip_hash text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_idx on auth_attempts (ip_hash, created_at desc);

create table if not exists platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists saved_products (
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'seller_profiles', 'products', 'carts', 'orders', 'payments', 'shipments', 'auctions', 'auction_financial_records']
  loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

insert into platform_settings (key, value, description) values
  ('auction_engine_enabled', 'true'::jsonb, 'Master switch for the random auction engine'),
  ('auction_daily_count', '12'::jsonb, 'Number of auctions generated per day (10-15 recommended)'),
  ('auction_start_pct', '50'::jsonb, 'Starting price as a percentage of the asking price'),
  ('auction_start_pct_options', '[30,40,50]'::jsonb, 'Allowed administrator starting-price percentages'),
  ('auction_duration_minutes', '30'::jsonb, 'Auction duration in minutes'),
  ('auction_min_increment_paise', '1000'::jsonb, 'Minimum bid increment in paise'),
  ('auction_anti_snipe_seconds', '10'::jsonb, 'Extension length in seconds'),
  ('auction_anti_snipe_trigger_seconds', '10'::jsonb, 'A bid inside this window triggers anti-sniping'),
  ('auction_selection_start_hour', '9'::jsonb, 'First auction start hour (Asia/Kolkata)'),
  ('auction_selection_end_hour', '21'::jsonb, 'Last auction start hour (Asia/Kolkata)'),
  ('auction_cooldown_days', '7'::jsonb, 'Cooldown before the same product can be selected again'),
  ('auction_payment_deadline_hours', '24'::jsonb, 'Winner payment deadline'),
  ('auction_budget_paise', '5000000'::jsonb, 'Monthly subsidy budget in paise'),
  ('auction_second_chance_enabled', 'true'::jsonb, 'Offer the item to the next bidder after non-payment'),
  ('offer_validity_hours', '48'::jsonb, 'Seller response window for offers'),
  ('offer_checkout_hours', '24'::jsonb, 'Payment window after an offer is accepted'),
  ('seller_auto_approve', 'true'::jsonb, 'Auto-approve new listings'),
  ('shipping_fee_paise', '4900'::jsonb, 'Default shipping fee in paise'),
  ('free_shipping_threshold_paise', '199900'::jsonb, 'Free shipping above this order subtotal'),
  ('serviceable_pincode_prefixes', '["695"]'::jsonb, 'Serviceable pincode prefixes'),
  ('platform_commission_pct', '5'::jsonb, 'Commission on auction amount above asking price'),
  ('bid_rate_limit_per_minute', '20'::jsonb, 'Maximum bids per user per auction per minute')
on conflict (key) do nothing;

insert into categories (name, slug, sort_order) values
  ('Outerwear', 'outerwear', 1),
  ('Tops & knits', 'tops-knits', 2),
  ('Denim', 'denim', 3),
  ('Accessories', 'accessories', 4),
  ('Footwear', 'footwear', 5),
  ('Home & living', 'home-living', 6),
  ('Electronics', 'electronics', 7),
  ('Books & media', 'books-media', 8)
on conflict (slug) do nothing;
