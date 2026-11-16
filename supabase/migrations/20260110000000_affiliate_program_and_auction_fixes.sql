-- ============================================================================
-- lelam.co — affiliate program + auction engine fixes
-- Apply AFTER 20260109000000_offer_counter_negotiations.sql.
-- ============================================================================

-- =========================================================
-- 1. AUCTION FIXES
-- =========================================================

-- 1a. An auction that closes with no bids writes outcome 'no_bids', but the
--     original check constraint did not allow it, so end_auction() raised and
--     the maintenance worker aborted.
alter table public.auction_financial_records
  drop constraint if exists auction_financial_records_outcome_check;
alter table public.auction_financial_records
  add constraint auction_financial_records_outcome_check
  check (outcome in ('pending', 'sold', 'unpaid', 'cancelled', 'refunded', 'no_bids'));

-- 1b. The generic cart/buy-now expirer also picked up auction orders, marking
--     them 'expired' before expire_unpaid_auctions() could penalise the buyer
--     and issue the second-chance offer. Leave auction orders to that routine.
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
      and source <> 'auction'
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

-- 1c. Proxy bids re-entered the resolver twice (place_bid calls it AND the
--     bids trigger calls it), so the same proxy amount was inserted twice and
--     hit the bids_one_per_amount unique index. Guard the resolver and make
--     the proxy insert idempotent.
create or replace function public.place_proxy_bid(
  p_auction_id uuid,
  p_bidder_id uuid,
  p_amount_paise integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon integer;
  v_city text;
begin
  select coalesce(max(anonymous_number), 1000) + 1 into v_anon
  from public.bids where auction_id = p_auction_id;
  select coalesce((select city from public.addresses where user_id = p_bidder_id and is_default limit 1), 'Trivandrum')
  into v_city;

  insert into public.bids (auction_id, bidder_id, amount_paise, anonymous_number, bidder_city)
  values (p_auction_id, p_bidder_id, p_amount_paise, v_anon, v_city)
  on conflict (auction_id, bidder_id, amount_paise) do nothing;

  if found then
    update public.auctions
    set current_bid_paise = p_amount_paise,
        highest_bidder_id = p_bidder_id,
        bid_count = bid_count + 1,
        min_increment_paise = public.auction_increment_paise(p_amount_paise)
    where id = p_auction_id;
  end if;
end;
$$;

create or replace function public.run_proxy_bids(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_proxy record;
  v_increment integer;
  v_target integer;
  v_iterations integer := 0;
begin
  -- The bids trigger calls this function, and place_bid calls it too. Only
  -- the outermost call should run the loop.
  if current_setting('lelam.proxy_running', true) = '1' then return; end if;
  perform set_config('lelam.proxy_running', '1', true);

  loop
    v_iterations := v_iterations + 1;
    if v_iterations > 20 then exit; end if;

    select * into v_auction from public.auctions where id = p_auction_id for update;
    if v_auction.status <> 'live' then exit; end if;

    select pb.bidder_id, pb.max_amount_paise into v_proxy
    from public.auction_proxy_bids pb
    where pb.auction_id = p_auction_id
      and pb.active = true
      and pb.bidder_id <> coalesce(v_auction.highest_bidder_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and pb.max_amount_paise > coalesce(v_auction.current_bid_paise, v_auction.starting_price_paise - 1)
    order by pb.max_amount_paise desc
    limit 1;

    if v_proxy is null then exit; end if;

    v_increment := public.auction_increment_paise(coalesce(v_auction.current_bid_paise, v_auction.starting_price_paise));
    v_target := coalesce(v_auction.current_bid_paise, v_auction.starting_price_paise - v_increment) + v_increment;

    if v_auction.highest_bidder_id is not null then
      declare
        v_other_max integer;
      begin
        select max_amount_paise into v_other_max
        from public.auction_proxy_bids
        where auction_id = p_auction_id and bidder_id = v_auction.highest_bidder_id and active = true;
        if v_other_max is not null and v_target > v_other_max then
          v_target := v_other_max + v_increment;
        end if;
      end;
    end if;

    if v_target > v_proxy.max_amount_paise then
      update public.auction_proxy_bids set active = false
      where auction_id = p_auction_id and bidder_id = v_proxy.bidder_id;
      exit;
    end if;

    if v_target < v_auction.starting_price_paise then
      v_target := v_auction.starting_price_paise;
    end if;

    perform public.place_proxy_bid(p_auction_id, v_proxy.bidder_id, v_target);
  end loop;

  perform set_config('lelam.proxy_running', '0', true);
end;
$$;

-- =========================================================
-- 2. AFFILIATE PROGRAM (creator / college / partner links)
-- =========================================================

insert into public.platform_settings (key, value, description)
values ('app_url', '"https://lelam.co"'::jsonb, 'Public storefront URL used to build affiliate links')
on conflict (key) do nothing;

insert into public.platform_settings (key, value, description)
values ('affiliate_commission_pct', '5'::jsonb, 'Default affiliate commission on the item subtotal')
on conflict (key) do nothing;

insert into public.platform_settings (key, value, description)
values ('return_window_days', '7'::jsonb, 'Days after delivery before affiliate earnings unlock')
on conflict (key) do nothing;

create table if not exists public.affiliate_accounts (
  id uuid primary key default gen_random_uuid(),
  -- Null for external links an admin creates for a college or creator.
  user_id uuid unique references public.profiles(id) on delete cascade,
  display_name text,
  contact_email text,
  kind text not null default 'creator' check (kind in ('creator', 'college', 'partner')),
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'paused', 'banned')),
  commission_pct numeric(5,2) not null default 5.00 check (commission_pct between 0 and 50),
  total_clicks bigint not null default 0,
  total_signups integer not null default 0,
  total_orders integer not null default 0,
  total_earned_paise bigint not null default 0,
  payout_method text,
  payout_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_accounts_identity check (user_id is not null or display_name is not null)
);

-- Keep re-runs safe if an earlier draft of this migration was applied.
alter table public.affiliate_accounts
  add column if not exists display_name text,
  add column if not exists contact_email text,
  add column if not exists kind text default 'creator';
alter table public.affiliate_accounts alter column user_id drop not null;

create index if not exists affiliate_accounts_code_idx
  on public.affiliate_accounts (lower(code));

create table if not exists public.affiliate_clicks (
  id bigserial primary key,
  affiliate_id uuid not null references public.affiliate_accounts(id) on delete cascade,
  code text not null,
  path text not null default '/',
  referrer text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_account_idx
  on public.affiliate_clicks (affiliate_id, created_at desc);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_accounts(id) on delete cascade,
  referred_user_id uuid not null unique references public.profiles(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  converted_at timestamptz
);

create index if not exists affiliate_referrals_affiliate_idx
  on public.affiliate_referrals (affiliate_id, created_at desc);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_accounts(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  order_subtotal_paise integer not null check (order_subtotal_paise > 0),
  commission_pct numeric(5,2) not null,
  amount_paise integer not null check (amount_paise > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'void')),
  return_window_days integer not null default 7 check (return_window_days between 0 and 90),
  eligible_at timestamptz,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz
);

alter table public.affiliate_commissions
  add column if not exists return_window_days integer not null default 7,
  add column if not exists eligible_at timestamptz;

create index if not exists affiliate_commissions_affiliate_idx
  on public.affiliate_commissions (affiliate_id, created_at desc);

create index if not exists affiliate_commissions_status_idx
  on public.affiliate_commissions (status, eligible_at);

-- ---------------------------------------------------------
-- 2a. Get or create the signed-in user's affiliate account
-- ---------------------------------------------------------
create or replace function public.affiliate_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_account public.affiliate_accounts;
  v_base text;
  v_code text;
  v_pct numeric := 5.00;
  v_app_url text;
begin
  if v_uid is null then raise exception 'Sign in to join the affiliate program.'; end if;

  select * into v_account from public.affiliate_accounts where user_id = v_uid;
  if not found then
    select * into v_profile from public.profiles where id = v_uid;
    if v_profile.is_blocked then raise exception 'Your account is blocked.'; end if;

    select coalesce((value #>> '{}')::numeric, 5) into v_pct
    from public.platform_settings where key = 'affiliate_commission_pct';

    v_base := regexp_replace(lower(coalesce(nullif(split_part(v_profile.full_name, ' ', 1), ''), 'lelam')), '[^a-z0-9]', '', 'g');
    if length(v_base) < 3 then v_base := 'lelam'; end if;
    v_base := substr(v_base, 1, 10);

    loop
      v_code := v_base || substr(md5(random()::text), 1, 4);
      exit when not exists (
        select 1 from public.affiliate_accounts where lower(code) = v_code
      );
    end loop;

    insert into public.affiliate_accounts (user_id, display_name, contact_email, kind, code, commission_pct)
    values (v_uid, v_profile.full_name, v_profile.email, 'creator', v_code, v_pct)
    on conflict (user_id) do nothing
    returning * into v_account;

    if v_account.id is null then
      select * into v_account from public.affiliate_accounts where user_id = v_uid;
    end if;
  end if;

  select coalesce(value #>> '{}', 'https://lelam.co') into v_app_url
  from public.platform_settings where key = 'app_url';

  return jsonb_build_object(
    'account', to_jsonb(v_account),
    'link', rtrim(coalesce(v_app_url, 'https://lelam.co'), '/') || '/?ref=' || v_account.code
  );
end;
$$;

revoke all on function public.affiliate_my_account() from public;
grant execute on function public.affiliate_my_account() to authenticated;

-- ---------------------------------------------------------
-- 2b. Click tracking (public)
-- ---------------------------------------------------------
create or replace function public.affiliate_track_click(
  p_code text,
  p_path text default '/',
  p_referrer text default null,
  p_user_agent text default null,
  p_ip_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.affiliate_accounts;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9]{4,20}$' then return false; end if;

  select * into v_account
  from public.affiliate_accounts
  where lower(code) = lower(p_code) and status = 'active';

  if not found then return false; end if;

  -- Collapse accidental double-fires from the same visitor.
  if exists (
    select 1 from public.affiliate_clicks
    where affiliate_id = v_account.id
      and path = left(coalesce(p_path, '/'), 300)
      and ip_hash = left(coalesce(p_ip_hash, ''), 64)
      and created_at > now() - interval '5 seconds'
  ) then
    return true;
  end if;

  insert into public.affiliate_clicks
    (affiliate_id, code, path, referrer, user_agent, ip_hash)
  values (
    v_account.id, v_account.code,
    left(coalesce(p_path, '/'), 300),
    left(coalesce(p_referrer, ''), 300),
    left(coalesce(p_user_agent, ''), 300),
    left(coalesce(p_ip_hash, ''), 64)
  );

  update public.affiliate_accounts
  set total_clicks = total_clicks + 1
  where id = v_account.id;

  return true;
end;
$$;

revoke all on function public.affiliate_track_click(text, text, text, text, text) from public;
grant execute on function public.affiliate_track_click(text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------
-- 2c. Attribute a new signup to the affiliate
-- ---------------------------------------------------------
create or replace function public.affiliate_attribute_signup(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.affiliate_accounts;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  if p_code is null or p_code = '' then return null; end if;

  select * into v_account
  from public.affiliate_accounts
  where lower(code) = lower(p_code) and status = 'active';

  if not found then return null; end if;
  if v_account.user_id = v_uid then return null; end if;

  insert into public.affiliate_referrals (affiliate_id, referred_user_id, code)
  values (v_account.id, v_uid, v_account.code)
  on conflict (referred_user_id) do nothing;

  if found then
    update public.affiliate_accounts
    set total_signups = total_signups + 1
    where id = v_account.id;
  end if;

  return v_account.id;
end;
$$;

revoke all on function public.affiliate_attribute_signup(text) from public;
grant execute on function public.affiliate_attribute_signup(text) to authenticated;

-- ---------------------------------------------------------
-- 2d. Commission on every paid order from a referred buyer
-- ---------------------------------------------------------
create or replace function public.affiliate_credit_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_pct numeric;
  v_days integer := 7;
  v_amount integer;
  v_eligible timestamptz;
begin
  if new.payment_status <> 'paid' then return new; end if;
  if tg_op = 'UPDATE' and old.payment_status = 'paid' then return new; end if;

  select r.affiliate_id, a.commission_pct into v_affiliate_id, v_pct
  from public.affiliate_referrals r
  join public.affiliate_accounts a on a.id = r.affiliate_id
  where r.referred_user_id = new.buyer_id and a.status = 'active'
  limit 1;

  if v_affiliate_id is null then return new; end if;

  select coalesce((value #>> '{}')::int, 7) into v_days
  from public.platform_settings where key = 'return_window_days';
  v_days := greatest(0, least(90, coalesce(v_days, 7)));

  v_amount := floor(new.subtotal_paise * v_pct / 100.0)::integer;
  if v_amount <= 0 then return new; end if;

  v_eligible := case
    when new.status = 'delivered' then now() + make_interval(days => v_days)
    else null
  end;

  insert into public.affiliate_commissions
    (affiliate_id, order_id, referred_user_id, order_subtotal_paise,
     commission_pct, amount_paise, return_window_days, eligible_at)
  values
    (v_affiliate_id, new.id, new.buyer_id, new.subtotal_paise,
     v_pct, v_amount, v_days, v_eligible)
  on conflict (order_id) do nothing;

  if found then
    update public.affiliate_accounts
    set total_orders = total_orders + 1,
        total_earned_paise = total_earned_paise + v_amount
    where id = v_affiliate_id;

    update public.affiliate_referrals
    set converted_at = coalesce(converted_at, now())
    where referred_user_id = new.buyer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_affiliate_commission on public.orders;
create trigger orders_affiliate_commission
after insert or update of payment_status on public.orders
for each row execute function public.affiliate_credit_order();

-- ---------------------------------------------------------
-- 2e. Delivery starts the return window; returns void earnings
-- ---------------------------------------------------------
create or replace function public.affiliate_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    update public.affiliate_commissions
    set eligible_at = now() + make_interval(days => return_window_days)
    where order_id = new.id and status = 'pending' and eligible_at is null;
  end if;

  if new.status in ('returned', 'cancelled', 'expired')
     and old.status is distinct from new.status then
    update public.affiliate_commissions
    set status = 'void'
    where order_id = new.id and status in ('pending', 'approved');
  end if;

  return new;
end;
$$;

drop trigger if exists orders_affiliate_status on public.orders;
create trigger orders_affiliate_status
after update of status on public.orders
for each row execute function public.affiliate_order_status_change();

-- ---------------------------------------------------------
-- 2f. Release earnings once the return window closes
-- ---------------------------------------------------------
create or replace function public.release_affiliate_commissions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released integer := 0;
begin
  update public.affiliate_commissions c
  set status = 'approved', approved_at = now()
  from public.orders o
  where c.order_id = o.id
    and c.status = 'pending'
    and c.eligible_at is not null
    and c.eligible_at <= now()
    and o.status = 'delivered'
    and o.payment_status = 'paid'
    and not exists (
      select 1 from public.order_disputes d
      where d.order_id = o.id
        and d.status in ('opened', 'seller_response', 'under_review')
    );

  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

revoke all on function public.release_affiliate_commissions() from public;
grant execute on function public.release_affiliate_commissions() to authenticated;

-- ---------------------------------------------------------
-- 2g. Affiliate dashboard
-- ---------------------------------------------------------
create or replace function public.affiliate_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.affiliate_accounts;
  v_link jsonb;
  v_pending integer := 0;
  v_approved integer := 0;
  v_paid integer := 0;
  v_clicks_30 integer := 0;
  v_recent jsonb;
begin
  if v_uid is null then raise exception 'Sign in to view your affiliate dashboard.'; end if;

  v_link := public.affiliate_my_account();
  select * into v_account from public.affiliate_accounts where user_id = v_uid;

  select count(*)::int into v_clicks_30
  from public.affiliate_clicks
  where affiliate_id = v_account.id and created_at > now() - interval '30 days';

  select
    coalesce(sum(amount_paise) filter (where status = 'pending'), 0)::int,
    coalesce(sum(amount_paise) filter (where status = 'approved'), 0)::int,
    coalesce(sum(amount_paise) filter (where status = 'paid'), 0)::int
  into v_pending, v_approved, v_paid
  from public.affiliate_commissions
  where affiliate_id = v_account.id;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_recent
  from (
    select c.id, c.order_id, c.order_subtotal_paise, c.commission_pct,
           c.amount_paise, c.status, c.return_window_days, c.eligible_at,
           c.created_at, c.approved_at, c.paid_at,
           coalesce(o.order_number, '') as order_number
    from public.affiliate_commissions c
    left join public.orders o on o.id = c.order_id
    where c.affiliate_id = v_account.id
    order by c.created_at desc
    limit 20
  ) t;

  return jsonb_build_object(
    'account', to_jsonb(v_account),
    'link', v_link->>'link',
    'clicks30d', v_clicks_30,
    'pendingPaise', v_pending,
    'availablePaise', v_approved,
    'paidPaise', v_paid,
    'recent', v_recent
  );
end;
$$;

revoke all on function public.affiliate_dashboard() from public;
grant execute on function public.affiliate_dashboard() to authenticated;

-- ---------------------------------------------------------
-- 2h. Admin controls
-- ---------------------------------------------------------
create or replace function public.admin_set_affiliate_status(p_affiliate_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;
  if p_status not in ('active', 'paused', 'banned') then raise exception 'Unknown status.'; end if;
  update public.affiliate_accounts
  set status = p_status, updated_at = now()
  where id = p_affiliate_id;
  if not found then raise exception 'Link not found.'; end if;
end;
$$;

revoke all on function public.admin_set_affiliate_status(uuid, text) from public;
grant execute on function public.admin_set_affiliate_status(uuid, text) to authenticated;

create or replace function public.admin_create_affiliate(
  p_name text,
  p_email text default null,
  p_code text default null,
  p_kind text default 'creator',
  p_commission_pct numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.affiliate_accounts;
  v_code text;
  v_pct numeric;
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name is required.'; end if;
  if p_kind not in ('creator', 'college', 'partner') then raise exception 'Unknown link type.'; end if;

  v_code := lower(trim(coalesce(p_code, '')));
  if v_code = '' then
    v_code := substr(regexp_replace(lower(p_name), '[^a-z0-9]', '', 'g'), 1, 14);
    if length(v_code) < 4 then v_code := 'link'; end if;
  end if;
  if v_code !~ '^[a-z0-9]{4,20}$' then
    raise exception 'Codes use 4-20 letters or numbers.';
  end if;
  while exists (select 1 from public.affiliate_accounts where lower(code) = v_code) loop
    v_code := substr(v_code, 1, 17) || (floor(random() * 90 + 10))::int;
  end loop;

  if p_commission_pct is null then
    select coalesce((value #>> '{}')::numeric, 5) into v_pct
    from public.platform_settings where key = 'affiliate_commission_pct';
  else
    v_pct := p_commission_pct;
  end if;
  v_pct := greatest(0, least(50, coalesce(v_pct, 5)));

  insert into public.affiliate_accounts
    (display_name, contact_email, kind, code, commission_pct)
  values
    (trim(p_name), nullif(trim(coalesce(p_email, '')), ''), p_kind, v_code, v_pct)
  returning * into v_account;

  return to_jsonb(v_account);
end;
$$;

revoke all on function public.admin_create_affiliate(text, text, text, text, numeric) from public;
grant execute on function public.admin_create_affiliate(text, text, text, text, numeric) to authenticated;

create or replace function public.admin_update_affiliate(
  p_affiliate_id uuid,
  p_name text default null,
  p_email text default null,
  p_code text default null,
  p_kind text default null,
  p_commission_pct numeric default null,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;
  if p_kind is not null and p_kind not in ('creator', 'college', 'partner') then
    raise exception 'Unknown link type.';
  end if;
  if p_status is not null and p_status not in ('active', 'paused', 'banned') then
    raise exception 'Unknown status.';
  end if;

  if p_code is not null then
    v_code := lower(trim(p_code));
    if v_code !~ '^[a-z0-9]{4,20}$' then
      raise exception 'Codes use 4-20 letters or numbers.';
    end if;
    if exists (
      select 1 from public.affiliate_accounts
      where lower(code) = v_code and id <> p_affiliate_id
    ) then
      raise exception 'That link code is already in use.';
    end if;
  end if;

  update public.affiliate_accounts
  set display_name = coalesce(nullif(trim(p_name), ''), display_name),
      contact_email = case
        when p_email is null then contact_email
        else nullif(trim(p_email), '')
      end,
      code = coalesce(v_code, code),
      kind = coalesce(p_kind, kind),
      commission_pct = case
        when p_commission_pct is null then commission_pct
        else greatest(0, least(50, p_commission_pct))
      end,
      status = coalesce(p_status, status),
      updated_at = now()
  where id = p_affiliate_id;

  if not found then raise exception 'Link not found.'; end if;
end;
$$;

revoke all on function public.admin_update_affiliate(uuid, text, text, text, text, numeric, text) from public;
grant execute on function public.admin_update_affiliate(uuid, text, text, text, text, numeric, text) to authenticated;

create or replace function public.admin_list_affiliates()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accounts jsonb;
  v_commissions jsonb;
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_accounts
  from (
    select a.*,
      (select count(*) from public.affiliate_clicks c where c.affiliate_id = a.id) as clicks,
      (select count(*) from public.affiliate_referrals r where r.affiliate_id = a.id) as signups,
      (select count(*) from public.affiliate_commissions co
        where co.affiliate_id = a.id and co.status <> 'void') as orders,
      (select coalesce(sum(co.amount_paise) filter (where co.status = 'approved'), 0)
        from public.affiliate_commissions co where co.affiliate_id = a.id) as available_paise,
      (select coalesce(sum(co.amount_paise) filter (where co.status = 'pending'), 0)
        from public.affiliate_commissions co where co.affiliate_id = a.id) as pending_paise
    from public.affiliate_accounts a
    order by a.created_at desc
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_commissions
  from (
    select c.*,
           a.display_name as affiliate_name,
           a.code as affiliate_code,
           o.order_number
    from public.affiliate_commissions c
    join public.affiliate_accounts a on a.id = c.affiliate_id
    left join public.orders o on o.id = c.order_id
    order by c.created_at desc
    limit 200
  ) t;

  return jsonb_build_object('accounts', v_accounts, 'commissions', v_commissions);
end;
$$;

revoke all on function public.admin_list_affiliates() from public;
grant execute on function public.admin_list_affiliates() to authenticated;

create or replace function public.admin_review_affiliate_commission(
  p_commission_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission public.affiliate_commissions;
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;

  select * into v_commission from public.affiliate_commissions where id = p_commission_id for update;
  if not found then raise exception 'Commission not found.'; end if;

  if p_action = 'approve' then
    if v_commission.status <> 'pending' then
      raise exception 'Only pending earnings can be released.';
    end if;
    if v_commission.eligible_at is null or v_commission.eligible_at > now() then
      raise exception 'The return window has not ended yet.';
    end if;
    update public.affiliate_commissions
    set status = 'approved', approved_at = now()
    where id = p_commission_id;
  elsif p_action = 'pay' then
    if v_commission.status <> 'approved' then
      raise exception 'Release the earning before marking it paid.';
    end if;
    update public.affiliate_commissions
    set status = 'paid', paid_at = now()
    where id = p_commission_id;
  elsif p_action = 'void' then
    if v_commission.status = 'paid' then
      raise exception 'Paid earnings need a payout adjustment, not a void.';
    end if;
    if v_commission.status <> 'void' then
      update public.affiliate_commissions set status = 'void' where id = p_commission_id;
      update public.affiliate_accounts
      set total_orders = greatest(0, total_orders - 1),
          total_earned_paise = greatest(0, total_earned_paise - v_commission.amount_paise)
      where id = v_commission.affiliate_id;
    end if;
  else
    raise exception 'Unknown action.';
  end if;
end;
$$;

revoke all on function public.admin_review_affiliate_commission(uuid, text) from public;
grant execute on function public.admin_review_affiliate_commission(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 2i. Maintenance: release earnings whose return window closed
-- ---------------------------------------------------------
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
  v_affiliates_released integer := 0;
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

  -- 8. Release affiliate earnings after delivery + the return window
  v_affiliates_released := public.release_affiliate_commissions();

  return jsonb_build_object(
    'auctionsStarted', v_started,
    'auctionsClosed', v_closed,
    'expiredOrders', v_orders,
    'expiredOffers', v_offers,
    'expiredAuctions', v_auctions,
    'expiredSecondChance', v_second_chance,
    'escrowReleased', v_escrow_released,
    'affiliateReleased', v_affiliates_released
  );
end;
$$;
grant execute on function public.run_maintenance() to authenticated, anon;

-- ---------------------------------------------------------
-- 2j. Row level security
-- ---------------------------------------------------------
alter table public.affiliate_accounts enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_commissions enable row level security;

drop policy if exists affiliate_accounts_read on public.affiliate_accounts;
create policy affiliate_accounts_read on public.affiliate_accounts
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists affiliate_clicks_read on public.affiliate_clicks;
create policy affiliate_clicks_read on public.affiliate_clicks
for select to authenticated
using (
  affiliate_id in (select id from public.affiliate_accounts where user_id = auth.uid())
  or public.is_admin()
);

drop policy if exists affiliate_referrals_read on public.affiliate_referrals;
create policy affiliate_referrals_read on public.affiliate_referrals
for select to authenticated
using (
  affiliate_id in (select id from public.affiliate_accounts where user_id = auth.uid())
  or public.is_admin()
);

drop policy if exists affiliate_commissions_read on public.affiliate_commissions;
create policy affiliate_commissions_read on public.affiliate_commissions
for select to authenticated
using (
  affiliate_id in (select id from public.affiliate_accounts where user_id = auth.uid())
  or public.is_admin()
);

revoke insert, update, delete on public.affiliate_accounts from anon, authenticated;
revoke insert, update, delete on public.affiliate_clicks from anon, authenticated;
revoke insert, update, delete on public.affiliate_referrals from anon, authenticated;
revoke insert, update, delete on public.affiliate_commissions from anon, authenticated;
grant select on public.affiliate_accounts to authenticated;
grant select on public.affiliate_clicks to authenticated;
grant select on public.affiliate_referrals to authenticated;
grant select on public.affiliate_commissions to authenticated;
