// Runs the marketplace schema plus the backend fixes on an in-memory Postgres
// (PGlite) and asserts the money and expiry rules. No Supabase project needed.
//
//   npm run verify:sql
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const base = readFileSync(
  "supabase/migrations/20260101000000_marketplace_schema.sql",
  "utf8",
);
const fix = readFileSync(
  "supabase/migrations/20260102000000_fix_backend_gaps.sql",
  "utf8",
);
const auction = readFileSync(
  "supabase/migrations/20260103000000_auction_engine.sql",
  "utf8",
);

await db.exec(base);

// Only the objects the fix migration touches, with the Supabase-provided
// pieces stubbed out.
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;

  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('test.role', true), ''), 'authenticated')::text $$;

  create or replace function public.is_admin() returns boolean
  language sql stable as $$ select false $$;

  create or replace function public.notify_user(
    p_user uuid, p_type text, p_title text, p_body text default '',
    p_data jsonb default '{}'::jsonb
  ) returns void language sql as $$ select null::void $$;

  -- Columns added by 20260101000100_supabase_backend.sql.
  alter table public.offers add column expires_at timestamptz;
  alter table public.orders add column payment_method text default 'cod'
    check (payment_method in ('upi', 'card', 'cod'));
  alter table public.products add column size text;
  alter table public.products add column tag text;
  alter table public.products add column color text default '#e8e6df';
`);

await db.exec(fix);

// Stub Supabase-provided pieces the auction migration relies on.
await db.exec(`
  create sequence if not exists public.order_number_seq;
  create or replace function public.next_order_number()
  returns text language sql as $$ select 'LL' || lpad(nextval('public.order_number_seq')::text, 6, '0') $$;

  create or replace function public.log_audit(
    p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb
  ) returns void language sql as $$ select null::void $$;

  create or replace function public.is_admin() returns boolean
  language sql stable as $$ select false $$;
`);

await db.exec(auction);

await db.exec(`
  set test.role = 'service_role';

  insert into profiles (id, email, full_name, is_seller) values
    ('00000000-0000-4000-8000-000000000001', 'seller@x.co', 'Seller', true),
    ('00000000-0000-4000-8000-000000000002', 'buyer@x.co', 'Buyer', false);

  insert into products (id, seller_id, title, slug, asking_price_paise, quantity, is_unique, status)
  values
    ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
     'Jacket', 'jacket', 100000, 1, true, 'reserved'),
    ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
     'Knit', 'knit', 80000, 1, true, 'reserved'),
    ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
     'Bag', 'bag', 50000, 1, true, 'reserved');

  insert into orders (id, order_number, buyer_id, seller_id, status, source,
    subtotal_paise, shipping_paise, total_paise, payment_status, payment_method, shipping_address)
  values
    ('20000000-0000-4000-8000-000000000001', 'L-1',
     '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
     'pending_payment', 'buy_now', 100000, 0, 100000, 'pending', 'upi', '{}'),
    ('20000000-0000-4000-8000-000000000002', 'L-2',
     '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
     'delivered', 'buy_now', 80000, 0, 80000, 'pending', 'cod', '{}');

  insert into order_items (order_id, product_id, title_snapshot, price_paise, quantity)
  values
    ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Jacket', 100000, 1),
    ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Knit', 80000, 1);

  insert into payments (order_id, provider, provider_order_id, amount_paise, status)
  values ('20000000-0000-4000-8000-000000000001', 'razorpay', 'rp_1', 100000, 'created');

  insert into offers (product_id, buyer_id, seller_id, amount_paise, status, expires_at, checkout_expires_at)
  values
    ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
     '00000000-0000-4000-8000-000000000001', 40000, 'pending', now() - interval '1 hour', null),
    ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002',
     '00000000-0000-4000-8000-000000000001', 70000, 'accepted', null, now() - interval '1 hour');
`);

let failures = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label} ${detail}`);
  }
}

// A signature from a different Razorpay order must not confirm this order.
let wrongRejected = false;
try {
  await db.query(
    "select public.confirm_order_payment('20000000-0000-4000-8000-000000000001','razorpay','rp_other','pay_x')",
  );
} catch (error) {
  wrongRejected = /does not belong/.test(error.message);
}
check("rejects a foreign razorpay order id", wrongRejected);

await db.query(
  "select public.confirm_order_payment('20000000-0000-4000-8000-000000000001','razorpay','rp_1','pay_1')",
);

const paid = await db.query(`
  select o.payment_status, p.status as payment_row_status, p.signature_verified,
         s.seller_payout_paise, s.platform_commission_paise
  from orders o
  join payments p on p.order_id = o.id
  join seller_settlements s on s.order_id = o.id
  where o.id = '20000000-0000-4000-8000-000000000001'
`);
check("order marked paid", paid.rows[0].payment_status === "paid");
check(
  "payment row captured and verified",
  paid.rows[0].payment_row_status === "captured" &&
    paid.rows[0].signature_verified === true,
);
check(
  "online payout deducts the flat fee",
  Number(paid.rows[0].seller_payout_paise) === 99000,
);
check(
  "platform fee recorded",
  Number(paid.rows[0].platform_commission_paise) === 1000,
);

await db.query("set test.role = 'authenticated'");
await db.query("set test.uid = '00000000-0000-4000-8000-000000000001'");
await db.query(
  "select public.confirm_cod_payment('20000000-0000-4000-8000-000000000002')",
);

const cod = await db.query(`
  select o.payment_status, s.seller_payout_paise, s.platform_commission_paise
  from orders o
  join seller_settlements s on s.order_id = o.id
  where o.id = '20000000-0000-4000-8000-000000000002'
`);
check("cod order paid", cod.rows[0].payment_status === "paid");
check(
  "cod payout deducts the flat fee",
  Number(cod.rows[0].seller_payout_paise) === 79000,
);
check(
  "cod fee recorded",
  Number(cod.rows[0].platform_commission_paise) === 1000,
);

const expired = await db.query("select public.expire_offers() as count");
const offers = await db.query("select status from offers");
const released = await db.query(
  "select status from products where id = '10000000-0000-4000-8000-000000000002'",
);
check("two offers expired", Number(expired.rows[0].count) === 2);
check(
  "lapsed offers marked expired",
  offers.rows.every((row) => row.status === "expired"),
);
check(
  "accepted-offer listing released",
  released.rows[0].status === "active",
);

if (failures) process.exit(1);
console.log("\nall checks passed");
