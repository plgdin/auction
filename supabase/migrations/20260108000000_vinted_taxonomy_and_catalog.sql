-- ============================================================================
-- Migration: 20260108000000_vinted_taxonomy_and_catalog.sql
-- Adds subcategory support, updates categories to Vinted taxonomy, and seeds catalog.
-- ============================================================================

alter table public.products add column if not exists subcategory text;

-- 1. Insert Vinted Taxonomy Categories
insert into public.categories (name, slug, sort_order, is_active) values
  ('Women', 'women', 1, true),
  ('Men', 'men', 2, true),
  ('Designer', 'designer', 3, true),
  ('Kids', 'kids', 4, true),
  ('Home', 'home', 5, true),
  ('Electronics', 'electronics', 6, true),
  ('Books & Media', 'books-media', 7, true),
  ('Hobbies & collectibles', 'hobbies-collectibles', 8, true),
  ('Sports', 'sports', 9, true)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

-- 2. Update save_listing RPC to store subcategory
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
  if v_uid is null then raise exception 'Sign in required'; end if;

  select id into v_seller from public.profiles where id = v_uid and is_blocked = false;
  if v_seller is null then raise exception 'Account is blocked or does not exist'; end if;

  if length(v_title) < 3 then raise exception 'Title must be at least 3 characters'; end if;
  if v_price <= 0 then raise exception 'Price must be greater than zero'; end if;

  select coalesce((value->>'seller_auto_approve')::boolean, true) into v_auto
  from public.platform_settings where key = 'platform' limit 1;

  select id into v_category from public.categories
  where lower(name) = lower(coalesce(p_payload->>'category', 'Other')) limit 1;
  if v_category is null then
    select id into v_category from public.categories where slug = 'other' or id = 1 limit 1;
  end if;

  v_status := case when v_auto then 'active' else 'pending' end;

  if v_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'))
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.products (
      seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location,
      shipping_fee_paise, status, allow_offers, auction_consent, published_at,
      measurements, flaws, has_flaws, gender, fit, country_of_origin,
      weight_grams, length_cm, width_cm, height_cm
    )
    values (
      v_uid, v_category, nullif(p_payload->>'subcategory', ''), v_title, v_slug, v_description,
      nullif(p_payload->>'brand', ''), v_condition, v_price,
      nullif(p_payload->>'size', ''), v_quantity, v_quantity = 1,
      coalesce(nullif(p_payload->>'location', ''), 'Trivandrum, Kerala'),
      greatest(0, coalesce((p_payload->>'shipping_fee_paise')::integer, 4900)),
      v_status,
      coalesce((p_payload->>'allow_offers')::boolean, true),
      coalesce((p_payload->>'auction_consent')::boolean, false),
      case when v_auto then now() else null end,
      coalesce(p_payload->'measurements', '{}'::jsonb),
      coalesce(p_payload->'flaws', '[]'::jsonb),
      coalesce((p_payload->>'has_flaws')::boolean, false),
      nullif(p_payload->>'gender', ''),
      nullif(p_payload->>'fit', ''),
      nullif(p_payload->>'country_of_origin', ''),
      coalesce((p_payload->>'weight_grams')::integer, 500),
      coalesce((p_payload->>'length_cm')::numeric, 25),
      coalesce((p_payload->>'width_cm')::numeric, 20),
      coalesce((p_payload->>'height_cm')::numeric, 5)
    )
    returning id into v_id;
  else
    update public.products
    set
      category_id = v_category,
      subcategory = nullif(p_payload->>'subcategory', ''),
      title = v_title,
      description = v_description,
      brand = nullif(p_payload->>'brand', ''),
      condition = v_condition,
      asking_price_paise = v_price,
      size = nullif(p_payload->>'size', ''),
      quantity = v_quantity,
      is_unique = (v_quantity = 1),
      location = coalesce(nullif(p_payload->>'location', ''), location),
      shipping_fee_paise = greatest(0, coalesce((p_payload->>'shipping_fee_paise')::integer, shipping_fee_paise)),
      allow_offers = coalesce((p_payload->>'allow_offers')::boolean, allow_offers),
      auction_consent = coalesce((p_payload->>'auction_consent')::boolean, auction_consent),
      measurements = coalesce(p_payload->'measurements', measurements),
      flaws = coalesce(p_payload->'flaws', flaws),
      has_flaws = coalesce((p_payload->>'has_flaws')::boolean, has_flaws),
      gender = coalesce(nullif(p_payload->>'gender', ''), gender),
      fit = coalesce(nullif(p_payload->>'fit', ''), fit),
      country_of_origin = coalesce(nullif(p_payload->>'country_of_origin', ''), country_of_origin),
      weight_grams = coalesce((p_payload->>'weight_grams')::integer, weight_grams),
      length_cm = coalesce((p_payload->>'length_cm')::numeric, length_cm),
      width_cm = coalesce((p_payload->>'width_cm')::numeric, width_cm),
      height_cm = coalesce((p_payload->>'height_cm')::numeric, height_cm)
    where id = v_id and (seller_id = v_uid or public.is_admin());

    if not found then raise exception 'Listing not found or access denied'; end if;
    delete from public.product_images where product_id = v_id;
  end if;

  if array_length(p_images, 1) > 0 then
    insert into public.product_images (product_id, url, position)
    select v_id, u, ord::integer - 1
    from unnest(p_images) with ordinality as t(u, ord);
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_listing(jsonb, text[]) from public;
grant execute on function public.save_listing(jsonb, text[]) to authenticated;

-- 3. Update public_products view to expose subcategory
create or replace view public.public_products
with (security_invoker = false)
as
select
  p.id,
  p.seller_id,
  pp.full_name as seller_name,
  pp.avatar_url as seller_avatar,
  c.name as category,
  p.subcategory,
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
  p.created_at,
  p.view_count as views,
  p.tag,
  p.color,
  p.measurements,
  p.flaws,
  p.has_flaws,
  p.gender,
  p.fit,
  p.country_of_origin,
  p.weight_grams,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  coalesce(
    (select array_agg(pi.url order by pi.position)
     from public.product_images pi
     where pi.product_id = p.id),
    array[]::text[]
  ) as images
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

-- 4. Seed Seller & Catalog
do $$
declare
  v_seller_id uuid;
  v_cat_id integer;
  v_prod_id uuid;
begin
  -- Ensure seller account exists in public.profiles
  select id into v_seller_id from public.profiles where email = 'seller@lelam.co';
  if v_seller_id is null then
    select id into v_seller_id from public.profiles limit 1;
  end if;

  if v_seller_id is not null then

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'The worn-in denim jacket',
      'prod-1-emoen',
      'The kind of blue you can’t make in a factory. A beautifully faded denim jacket with an easy, boxy fit, original metal buttons, and a little history in every seam. Excellent vintage condition.', 'Levi’s', 'like_new', 145000, 'M / L',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, true, now(), 'A GOOD FIND', '#e4e7e1'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/denim.jpg', 0) on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/editorial.jpg', 1) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Sunday morning knit',
      'prod-2-9t2mp',
      'An oatmeal knit made for slow mornings and late coffee runs. Soft, tactile, and just oversized enough. Freshly cleaned and checked. Very good vintage condition with gentle, natural wear.', 'Unbranded', 'good', 98000, 'M',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, true, now(), null, '#e9e5dc'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/knit.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'The quilted leather bag',
      'prod-3-vufxr',
      'Your new plus-one. A compact black quilted shoulder bag with gold-tone details, a secure closure, and room for the things that matter. Light surface marks tell its story; the lining is clean and ready for yours.', 'Charles & Keith', 'good', 125000, 'One size',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, true, now(), 'ONE OF ONE', '#e8e0d7'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/bag.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Perfectly imperfect 501s',
      'prod-4-zttxu',
      'Straight-leg blue jeans with an authentic lived-in wash. High-rise, sturdy cotton denim, and that elusive vintage fit. Measured waist: 28 inches, inseam: 30 inches. Good vintage condition.', 'Levi’s', 'good', 110000, 'W 28',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, true, now(), null, '#e1e4e4'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/jeans.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'After-hours leather jacket',
      'prod-5-cdqym',
      'A classic black leather jacket with an attitude all its own. Supple leather, silver-tone hardware, and a timeless silhouette. Professionally cleaned. Some characterful wear at the cuffs.', 'Vintage', 'good', 240000, 'S / M',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, true, now(), 'ARCHIVE FAVORITE', '#dfded9'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/leather.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'The off-duty cotton tee',
      'prod-6-0hqd8',
      'A soft cotton essential with a relaxed fit. Wear it tucked into your favorite vintage denim or under just about anything. Carefully inspected and freshly washed. Excellent pre-loved condition.', 'Uniqlo', 'like_new', 45000, 'L',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', false, false, now(), null, '#e8e6df'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/tee.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Heavyweight tee · Bone',
      'prod-7-1qchs',
      '240 gsm organic cotton with a tonal embroidery on the chest. Regular fit with premium drape. Worn twice, washed once.', 'DHxWHY', 'like_new', 65000, 'L',
      1, true, 'Vazhuthacaud, Trivandrum', 4900,
      'active', true, true, now(), 'ON THE RAIL', '#EFEBE2'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/tee.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Graphic tee · CCgather',
      'prod-8-pmyng',
      'Deep black tee with the CCgather wordmark printed front and back. Premium 240 gsm combed cotton. A little fading on the print, priced for it.', 'CCgather', 'good', 70000, 'XL',
      1, true, 'Vazhuthacaud, Trivandrum', 4900,
      'active', false, true, now(), 'ON THE RAIL', '#101214'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/tee.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Oxford shirt · Sky',
      'prod-9-gnqtf',
      'Pale sky oxford cotton with a button-down collar and a tiny embroidered detail. Single chest pocket. Crisp, clean, and ready to wear.', 'Maestiq', 'like_new', 89900, 'M',
      1, true, 'Vazhuthacaud, Trivandrum', 4900,
      'active', true, true, now(), 'NEW LISTING', '#A3D3EB'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/editorial.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Knit cardigan · Olive',
      'prod-10-fshm4',
      'Chunky olive wool cardigan with genuine wooden buttons and thick ribbed trims. Deep V-neck. Small repair at the left cuff, reflected in the price.', 'Lambswool', 'good', 145000, 'L',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, true, now(), 'HOT FIND', '#758151'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/knit.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Hoodie · Maestiq Heather',
      'prod-11-7nn05',
      '400 gsm heather fleece hoodie with the Maestiq wordmark across the chest and a double-layer hood. Heavy, warm, and barely worn.', 'Maestiq', 'like_new', 120000, 'L',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, true, now(), null, '#A0A5AB'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/denim.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Crewneck sweatshirt · Lilac',
      'prod-12-odduv',
      'Muted lilac fleece crewneck with a raised puff print and heavy elasticated cuffs. An easy layer for Trivandrum evenings.', 'DHxWHY', 'good', 98000, 'M',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, false, now(), null, '#CCB2E0'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/knit.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Piqué polo · Forest',
      'prod-13-ymv1n',
      'Forest green piqué polo with a bone embroidery on the chest and mother-of-pearl buttons. Classic fit.', 'CCgather', 'good', 75000, 'M / L',
      1, true, 'Vazhuthacaud, Trivandrum', 4900,
      'active', true, true, now(), 'ON THE RAIL', '#185B37'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/tee.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Henley · Brick Slub',
      'prod-14-lwmm3',
      'Dusty brick henley with a three-button placket, washed for that lived-in feel from day one. Soft slub cotton.', 'Workwear', 'fair', 65000, 'L',
      1, true, 'Vazhuthacaud, Trivandrum', 4900,
      'active', true, true, now(), 'ON THE RAIL', '#B05139'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/tee.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Women' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other clothing', 'Breton long sleeve · Marine',
      'prod-15-f0wcg',
      'Classic ink-and-bone Breton stripe with a wide boat neck in 220 gsm combed cotton. A forever piece.', 'Saint James', 'like_new', 70000, 'M',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, true, now(), 'ON THE RAIL', '#E4DFD3'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, '/images/knit.jpg', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Electronics' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other devices & accessories', 'Sony WH-1000XM4 headphones',
      'prod-16-v7z5d',
      'Noise-cancelling over-ear headphones with the case, cable, and box. Battery still runs a full day. Earpads are clean, no cracks. Selling because I moved to earbuds.', 'Sony', 'good', 1250000, 'Over-ear',
      1, true, 'Vazhuthacaud, Trivandrum', 7900,
      'active', true, false, now(), 'JUST LISTED', '#e6e4df'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Home' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other home accessories', 'Teak side table',
      'prod-17-yzb4m',
      'Solid teak side table with a lower shelf. 45 cm wide, 55 cm tall. A few water rings on top, otherwise sturdy. Pickup from Vazhuthacaud or local delivery.', 'Local carpenter', 'fair', 220000, '45 × 35 × 55 cm',
      1, true, 'Vazhuthacaud, Trivandrum', 14900,
      'active', true, false, now(), null, '#e4ded4'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Home' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other home accessories', 'Instant Pot Duo 6L',
      'prod-18-pk84f',
      'Six-litre pressure cooker, used for about a year. Inner pot and sealing ring cleaned. Includes the steam rack and measuring cup. Works perfectly.', 'Instant Pot', 'good', 450000, '6 litre',
      1, true, 'Kowdiar, Trivandrum', 9900,
      'active', true, false, now(), null, '#e7e2da'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1585515320310-259814833e62?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Electronics' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Other devices & accessories', 'Nintendo Switch OLED',
      'prod-19-zps67',
      'White OLED console with dock, two Joy-Cons, and carry case. Screen has a protector fitted from day one. No drift. Box included.', 'Nintendo', 'like_new', 2100000, '64 GB',
      1, true, 'Kowdiar, Trivandrum', 14900,
      'active', true, false, now(), 'TESTED', '#e3e6ea'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Books & Media' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Non-fiction', 'Box of Malayalam classics',
      'prod-20-tlztp',
      'Twelve paperback novels, including works by Basheer, MT, and OV Vijayan. Pages are tanned but complete. Great starter shelf for a reader.', 'Various', 'good', 60000, '12 books',
      1, true, 'Vazhuthacaud, Trivandrum', 7900,
      'active', true, false, now(), null, '#e8e2d8'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Men' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Outerwear', 'Cropped leather biker jacket',
      'prod-21-r7fpg',
      'Men''s black leather jacket with a slightly cropped fit and matte hardware. Zips run smooth, lining intact, cuffs softly worn in. A proper everyday rider look.', 'Zara', 'like_new', 280000, 'L',
      1, true, 'Kowdiar, Trivandrum', 7900,
      'active', true, true, now(), 'A GOOD FIND', '#e5e2dd'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1520975954732-35dd22299614?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Men' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Sneakers', 'Court sneakers · white',
      'prod-22-0isgh',
      'Clean white leather court sneakers, worn a handful of times. Soles still crisp, insoles fresh. Comes with the original box and spare laces.', 'Adidas', 'good', 190000, 'UK 9',
      1, true, 'Vazhuthacaud, Trivandrum', 7900,
      'active', true, false, now(), null, '#eae8e2'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Kids' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Building toys', 'Wooden building blocks set',
      'prod-23-9kxea',
      'Sixty smooth beech blocks in a canvas drawstring bag. No chips or splinters, colours still bright. Outgrown and looking for a new little architect.', 'Unbranded', 'like_new', 70000, '60 pieces',
      1, true, 'Vazhuthacaud, Trivandrum', 4900,
      'active', false, false, now(), null, '#ece5d7'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Kids' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Backpacks', 'School backpack · olive',
      'prod-24-wsjfy',
      'Padded olive backpack with a laptop sleeve and bottle pocket. Zips all healthy, straps firm. Survived one school year, ready for another.', 'Wildcraft', 'good', 45000, '18 L',
      1, true, 'Kowdiar, Trivandrum', 4900,
      'active', true, false, now(), null, '#e2e6de'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Sports' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Yoga mats', 'Cork yoga mat · 6 mm',
      'prod-25-cwfvh',
      'Natural cork surface with a rubber base — grip improves as you sweat. Used for one home-practice stretch. Includes the carry strap.', 'Unbranded', 'like_new', 60000, '183 × 61 cm',
      1, true, 'Vazhuthacaud, Trivandrum', 7900,
      'active', true, false, now(), null, '#e7e3d6'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Sports' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Cricket', 'Kashmir willow cricket bat',
      'prod-26-v8uca',
      'Full-size Kashmir willow bat, knocked in and match-ready. Toegel grip fitted, edges clean, no cracks. Only retired because the owner switched to tennis-ball games.', 'SG', 'good', 150000, 'Full size',
      1, true, 'Kowdiar, Trivandrum', 9900,
      'active', true, true, now(), 'TESTED', '#e6e0d2'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Books & Media' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Vinyl', 'Three vintage vinyl LPs',
      'prod-27-trfz8',
      'A small stack of vintage LPs — jazz and old Bollywood soundtracks. Sleeves aged with character, vinyl surfaces clean and playable. Sold as one lot.', 'Various', 'fair', 90000, '3 records',
      1, true, 'Kowdiar, Trivandrum', 7900,
      'active', true, false, now(), null, '#e9e4da'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1603048588665-791ca818222a?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

    select id into v_cat_id from public.categories where name = 'Hobbies & collectibles' limit 1;
    v_prod_id := gen_random_uuid();

    insert into public.products (
      id, seller_id, category_id, subcategory, title, slug, description, brand, condition,
      asking_price_paise, size, quantity, is_unique, location, shipping_fee_paise,
      status, allow_offers, auction_consent, published_at, tag, color
    )
    values (
      v_prod_id, v_seller_id, v_cat_id, 'Family games', 'Settlers of Catan · 5th edition',
      'prod-28-pscyc',
      'Complete Catan set with all pieces, cards, and the rulebook. Box corners a little soft, everything inside counted and sorted. Game nights approved.', 'Catan Studio', 'good', 120000, '3–4 players',
      1, true, 'Vazhuthacaud, Trivandrum', 7900,
      'active', true, false, now(), null, '#e5e4da'
    )
    on conflict do nothing;
    insert into public.product_images (product_id, url, position) values (v_prod_id, 'https://images.unsplash.com/photo-1608885898447-3e970a2b1a14?q=80&w=1200&auto=format&fit=crop', 0) on conflict do nothing;

  end if;
end $$;
