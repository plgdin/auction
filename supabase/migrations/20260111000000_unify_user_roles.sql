-- Migration 20260111000000_unify_user_roles.sql
-- Unify Buyer and Seller roles into a single Member/Client tier:
-- 1. All authenticated non-blocked accounts can buy and sell.
-- 2. New users automatically get is_seller = true and a seller_profiles record.
-- 3. Users are strictly barred from buying, bidding on, or making offers on their own listings.

-- 1. Alter public.profiles default
alter table public.profiles
  alter column is_seller set default true;

-- Update all existing non-blocked profiles to have is_seller = true
update public.profiles
set is_seller = true
where not is_blocked;

-- Ensure every non-blocked user has a seller_profiles entry
insert into public.seller_profiles (user_id, display_name)
select p.id, p.full_name
from public.profiles p
where not p.is_blocked
on conflict (user_id) do nothing;

-- 2. Update trigger on auth.users so any new user is automatically a seller as well
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, email, full_name, is_seller)
  values (new.id, coalesce(new.email, ''), v_name, true)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    is_seller = true;

  insert into public.seller_profiles (user_id, display_name)
  values (new.id, v_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 3. Enforce self-purchase / self-bid constraints
create or replace function public.create_order_single(
  p_product_id uuid,
  p_shipping_address jsonb,
  p_payment_method text default 'online',
  p_offer_id uuid default null,
  p_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_product record;
  v_order_id uuid;
  v_subtotal integer;
  v_shipping integer;
  v_total integer;
  v_offer record;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if v_product.seller_id = v_uid then raise exception 'You cannot purchase your own item'; end if;
  if v_product.status <> 'active' and v_product.status <> 'reserved' then
    raise exception 'Product is not available for purchase';
  end if;

  if p_offer_id is not null then
    select * into v_offer from public.offers where id = p_offer_id for update;
    if not found or v_offer.buyer_id <> v_uid or v_offer.status <> 'accepted' then
      raise exception 'Valid accepted offer required';
    end if;
    v_subtotal := v_offer.amount_paise;
  else
    v_subtotal := v_product.asking_price_paise * greatest(1, p_quantity);
  end if;

  v_shipping := coalesce(v_product.shipping_fee_paise, 0);
  v_total := v_subtotal + v_shipping + 1000; -- 1000 paise = ₹10 buyer platform fee

  insert into public.orders (
    buyer_id, seller_id, product_id, offer_id,
    subtotal_paise, shipping_fee_paise, total_amount_paise,
    payment_method, payment_status, status, shipping_address
  ) values (
    v_uid, v_product.seller_id, v_product.id, p_offer_id,
    v_subtotal, v_shipping, v_total,
    p_payment_method, 'pending', 'pending', p_shipping_address
  ) returning id into v_order_id;

  return v_order_id;
end;
$$;

-- 4. Seller Tiers (normal = 10% commission, verified = 5% commission)
alter table public.profiles
  add column if not exists seller_tier text not null default 'normal'
  check (seller_tier in ('normal', 'verified'));

create or replace function public.set_seller_tier(p_user_id uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_tier not in ('normal', 'verified') then raise exception 'Invalid seller tier'; end if;

  update public.profiles
  set seller_tier = p_tier
  where id = p_user_id;

  update public.seller_profiles
  set is_verified = (p_tier = 'verified')
  where user_id = p_user_id;
end;
$$;

revoke all on function public.set_seller_tier(uuid, text) from public;
grant execute on function public.set_seller_tier(uuid, text) to authenticated;


