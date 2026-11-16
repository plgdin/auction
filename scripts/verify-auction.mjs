// End-to-end check of the auction engine against the real migrations,
// on an in-memory Postgres (PGlite). No Supabase project needed.
//
//   npm run verify:auction
//
// It exercises: scheduling, starting, min-bid rules, outbidding, anti-snipe,
// proxy bids, settlement (order + payout + commission), the maintenance worker,
// second-chance offers after non-payment, and the no-bids path.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const db = new PGlite();
const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = (f) => readFileSync(`${dir}/${f}`, "utf8");

const seller = "00000000-0000-4000-8000-000000000001";
const buyer1 = "00000000-0000-4000-8000-000000000002";
const buyer2 = "00000000-0000-4000-8000-000000000003";
const buyer3 = "00000000-0000-4000-8000-000000000004";
const admin = "00000000-0000-4000-8000-000000000009";

// 1. Base schema, then the Supabase-provided pieces it expects.
await db.exec(sql("20260101000000_marketplace_schema.sql"));
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('test.role', true), ''), 'authenticated')::text $$;

  -- Minimal stand-in for Supabase Storage, used by the backend addendum.
  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text,
    name text,
    owner uuid
  );
  create function storage.foldername(text) returns text[] language sql immutable as $$
    select string_to_array($1, '/') $$;
`);

// 2. Every remaining migration, in order.
for (const f of files) {
  if (f === "20260101000000_marketplace_schema.sql") continue;
  await db.exec(sql(f));
}

// 3. Seed users (the auth trigger creates profiles) and listings.
await db.exec(`
  set test.role = 'service_role';
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${seller}', 'seller@x.co', '{"full_name":"Seller","as_seller":true}'),
    ('${buyer1}', 'b1@x.co', '{"full_name":"Buyer One"}'),
    ('${buyer2}', 'b2@x.co', '{"full_name":"Buyer Two"}'),
    ('${buyer3}', 'b3@x.co', '{"full_name":"Buyer Three"}'),
    ('${admin}',  'admin@x.co', '{"full_name":"Admin"}');
  update profiles set role = 'admin' where id = '${admin}';
  insert into addresses (user_id, recipient_name, phone, line1, city, pincode, is_default)
  values
    ('${buyer1}', 'Buyer One', '9000000001', '1 Road', 'Kochi', '695001', true),
    ('${buyer2}', 'Buyer Two', '9000000002', '2 Road', 'Kollam', '695002', true);

  insert into products (id, seller_id, title, slug, asking_price_paise, quantity, is_unique, status, auction_consent)
  values
    ('10000000-0000-4000-8000-000000000001', '${seller}', 'Jacket', 'jacket', 100000, 1, true, 'active', true),
    ('10000000-0000-4000-8000-000000000002', '${seller}', 'Knit', 'knit', 80000, 1, true, 'active', true),
    ('10000000-0000-4000-8000-000000000003', '${seller}', 'Bag', 'bag', 50000, 1, true, 'active', true);
`);

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label} ${detail}`);
  }
}
async function asUser(id) {
  await db.query("select set_config('test.uid', $1, false)", [id ?? ""]);
  await db.query("select set_config('test.role', 'authenticated', false)");
}
async function asService() {
  await db.query("select set_config('test.uid', '', false)");
  await db.query("select set_config('test.role', 'service_role', false)");
}
async function expectError(label, fn, pattern) {
  try {
    await fn();
    check(label, false, "(no error raised)");
  } catch (error) {
    check(label, pattern.test(error.message), `(got: ${error.message})`);
  }
}
const q = async (text, params = []) => (await db.query(text, params)).rows[0] ?? null;

// ---------------------------------------------------------------- schedule
await asUser(seller);
const scheduled = await db.query(
  "select public.schedule_auction('10000000-0000-4000-8000-000000000001', now(), 45) as id",
);
const auctionId = scheduled.rows[0].id;
const auction = await q("select * from auctions where id = $1", [auctionId]);
check("seller can schedule an auction", Boolean(auctionId) && auction.status === "scheduled");
check(
  "starting price is 50% of asking, rounded to ₹50",
  auction.starting_price_paise === 50000,
  `(got ${auction.starting_price_paise})`,
);
check(
  "listing is held as reserved",
  (await q("select status from products where id = '10000000-0000-4000-8000-000000000001'")).status ===
    "reserved",
);
await expectError(
  "cannot schedule an already-reserved listing twice",
  () => db.query("select public.schedule_auction('10000000-0000-4000-8000-000000000001', now(), 45)"),
  /Only active listings can be auctioned/,
);

// ---------------------------------------------------------------- start
await db.query("select public.start_auction($1)", [auctionId]);
check(
  "auction goes live",
  (await q("select status from auctions where id = $1", [auctionId])).status === "live",
);

// ---------------------------------------------------------------- bidding
await asUser(seller);
await expectError(
  "seller cannot bid on their own auction",
  () => db.query("select public.place_bid($1, 50000)", [auctionId]),
  /own auction/,
);

await asUser(buyer1);
await expectError(
  "bid below the starting price is rejected",
  () => db.query("select public.place_bid($1, 49999)", [auctionId]),
  /at least 50000/,
);
const first = await q("select public.place_bid($1, 50000) as r", [auctionId]);
check("first bid at starting price is accepted", first.r.amount_paise === 50000);

await asUser(buyer2);
const SECOND = 55000; // ₹500 increment at ₹500
await db.query("select public.place_bid($1, $2)", [auctionId, SECOND]);
let state = await q("select * from auctions where id = $1", [auctionId]);
check(
  "a higher bid becomes the current bid and leader",
  state.current_bid_paise === SECOND && state.highest_bidder_id === buyer2,
);
check("bid count is tracked", state.bid_count === 2, `(got ${state.bid_count})`);

await asUser(buyer1);
await expectError(
  "bid below current + increment is rejected",
  () => db.query("select public.place_bid($1, 56000)", [auctionId]),
  /at least 60000/,
);

// ---------------------------------------------------------------- anti-snipe
await asService();
await db.query("update auctions set ends_at = now() + interval '30 seconds' where id = $1", [
  auctionId,
]);
const before = await q("select ends_at from auctions where id = $1", [auctionId]);
await asUser(buyer1);
const sniped = await q("select public.place_bid($1, 60000) as r", [auctionId]);
check("a late bid reports an extension", sniped.r.extended === true);
state = await q("select * from auctions where id = $1", [auctionId]);
check(
  "anti-snipe pushes the end time out",
  new Date(state.ends_at) > new Date(before.ends_at),
);

// ---------------------------------------------------------------- proxy bids
// buyer1 leads at 60,000. buyer2 leaves a ₹1,200 ceiling; the engine should
// take the lead at the minimum increment.
await asUser(buyer2);
await db.query("select public.set_proxy_bid($1, 120000)", [auctionId]);
state = await q("select * from auctions where id = $1", [auctionId]);
check(
  "proxy bidder takes the lead automatically",
  state.highest_bidder_id === buyer2 && state.current_bid_paise === 65000,
  `(leader ${state.highest_bidder_id}, price ${state.current_bid_paise})`,
);

// buyer1 overbids manually; buyer2's hidden ceiling should answer.
await asUser(buyer1);
await db.query("select public.place_bid($1, 105000)", [auctionId]);
state = await q("select * from auctions where id = $1", [auctionId]);
check(
  "proxy answers a manual overbid up to its ceiling",
  state.highest_bidder_id === buyer2 && state.current_bid_paise === 115000,
  `(leader ${state.highest_bidder_id}, price ${state.current_bid_paise})`,
);

// ---------------------------------------------------------------- close + settle
await asService();
await db.query("update auctions set ends_at = now() - interval '1 second' where id = $1", [auctionId]);
const closed = await q("select public.run_maintenance() as r");
check("maintenance closes the finished auction", closed.r.auctionsClosed >= 1);

state = await q("select * from auctions where id = $1", [auctionId]);
check("auction is completed", state.status === "completed");
const order = await q("select * from orders where auction_id = $1", [auctionId]);
check("winner gets an order", Boolean(order) && order.buyer_id === buyer2);
check(
  "order total equals the winning bid",
  Number(order.subtotal_paise) === state.current_bid_paise &&
    Number(order.total_paise) === state.current_bid_paise,
);
check(
  "order has a payment deadline",
  order.payment_deadline !== null && order.status === "pending_payment",
);
const item = await q("select * from order_items where order_id = $1", [order.id]);
check("order has the listing attached", item?.product_id === "10000000-0000-4000-8000-000000000001");

const settlement = await q("select * from seller_settlements where order_id = $1", [order.id]);
const expectedCommission = Math.floor(((state.current_bid_paise - 100000) * 5) / 100);
check(
  "seller settlement pays the bid minus 5% of the excess over asking",
  Number(settlement.seller_payout_paise) === state.current_bid_paise - expectedCommission,
  `(payout ${settlement.seller_payout_paise}, bid ${state.current_bid_paise})`,
);
check(
  "commission row matches the payout",
  Number(settlement.platform_commission_paise) === expectedCommission,
);
check(
  "a bid above asking is recorded as sold, not subsidised",
  Number(settlement.platform_subsidy_paise) === 0,
);
const fin = await q("select * from auction_financial_records where auction_id = $1", [auctionId]);
check("financial record is written", fin?.winning_bid_paise === state.current_bid_paise);

// ---------------------------------------------------------------- second chance
await asService();
await db.query("update orders set payment_deadline = now() - interval '1 hour' where id = $1", [
  order.id,
]);
const swept = await q("select public.run_maintenance() as r");
check("maintenance expires the unpaid auction order", swept.r.expiredAuctions >= 1);
check(
  "unpaid order is cancelled",
  (await q("select status from orders where id = $1", [order.id])).status === "cancelled",
);
const offer = await q("select * from second_chance_offers where auction_id = $1", [auctionId]);
check("runner-up gets a second-chance offer", Boolean(offer));
check(
  "second-chance offer goes to the other bidder",
  offer?.buyer_id === buyer1,
  `(offered to ${offer?.buyer_id})`,
);

if (offer) {
  await asUser(offer.buyer_id);
  const scOrder = await q("select public.accept_second_chance_offer($1) as id", [offer.id]);
  check("accepted second-chance offer creates an order", Boolean(scOrder.id));
  check(
    "second-chance order is pending payment",
    (await q("select status from orders where id = $1", [scOrder.id])).status === "pending_payment",
  );
}

// ---------------------------------------------------------------- no bids
await asUser(seller);
const noBidAuction = (
  await db.query("select public.schedule_auction('10000000-0000-4000-8000-000000000002', now(), 45) as id")
).rows[0].id;
await db.query("select public.start_auction($1)", [noBidAuction]);
await asService();
await db.query("update auctions set ends_at = now() - interval '1 second' where id = $1", [
  noBidAuction,
]);
await db.query("select public.run_maintenance()");
const noBid = await q("select * from auctions where id = $1", [noBidAuction]);
check("auction with no bids completes", noBid.status === "completed");
check(
  "listing returns to active when nobody bid",
  (await q("select status from products where id = '10000000-0000-4000-8000-000000000002'")).status ===
    "active",
);
check(
  "no-bid auction records outcome",
  (await q("select outcome from auction_financial_records where auction_id = $1", [noBidAuction]))
    .outcome === "no_bids",
);

// ---------------------------------------------------------------- penalties
check(
  "non-paying winner is penalised",
  (await q("select count(*)::int as n from bidder_penalties where user_id = $1", [buyer2])).n === 1,
);

// ---------------------------------------------------------------- affiliate
await asUser(buyer3);
const myAffiliate = await q("select public.affiliate_my_account() as r");
const code = myAffiliate.r.account.code;
check("any user can open an affiliate account", /^[a-z0-9]{4,20}$/.test(code));
check(
  "affiliate link contains the code",
  myAffiliate.r.link.endsWith(`/?ref=${code}`),
  `(link ${myAffiliate.r.link})`,
);

await asUser(buyer1);
const selfReferral = await q("select public.affiliate_attribute_signup($1) as r", [code]);
check(
  "a user is attributed to the affiliate",
  selfReferral.r === myAffiliate.r.account.id,
  `(got ${selfReferral.r})`,
);
check(
  "referral row is written once",
  (await q("select count(*)::int as n from affiliate_referrals where referred_user_id = $1", [buyer1]))
    .n === 1,
);
const secondSelf = await q("select public.affiliate_attribute_signup($1) as r", [code]);
check(
  "signup attribution is idempotent",
  secondSelf.r === myAffiliate.r.account.id &&
    (await q("select count(*)::int as n from affiliate_referrals where referred_user_id = $1", [buyer1]))
      .n === 1,
);
check(
  "tracking a click is accepted",
  (await q("select public.affiliate_track_click($1, '/product/jacket') as r", [code])).r === true,
);
check(
  "an unknown code is rejected",
  (await q("select public.affiliate_track_click('nope1234') as r")).r === false,
);

await asService();
const affiliateOrder = await q(`
  insert into orders (order_number, buyer_id, seller_id, status, source,
    subtotal_paise, shipping_paise, total_paise, payment_status, payment_method,
    shipping_address, paid_at)
  values ('AFF-1', '${buyer1}', '${seller}', 'paid', 'buy_now',
    50000, 0, 50000, 'paid', 'upi', '{}', now())
  returning *
`);
const commission = await q("select * from affiliate_commissions where order_id = $1", [
  affiliateOrder.id,
]);
check("paid order creates a commission", Boolean(commission));
check(
  "commission is 5% of the item subtotal",
  commission?.amount_paise === 2500,
  `(got ${commission?.amount_paise})`,
);
check("commission starts pending with no unlock date", commission?.status === "pending" && !commission?.eligible_at);
check(
  "affiliate totals are updated",
  (
    await q("select total_orders, total_earned_paise from affiliate_accounts where code = $1", [code])
  ).total_earned_paise === 2500,
);

await asUser(buyer3);
const dashboard = await q("select public.affiliate_dashboard() as r");
check(
  "dashboard counts clicks and signups",
  dashboard.r.clicks30d === 1 && dashboard.r.account.total_signups === 1,
  `(clicks ${dashboard.r.clicks30d}, signups ${dashboard.r.account.total_signups})`,
);
check("dashboard reports pending earnings", dashboard.r.pendingPaise === 2500);
check("dashboard lists the commission", dashboard.r.recent.length === 1);
const selfAttribute = await q("select public.affiliate_attribute_signup($1) as r", [code]);
check("affiliate cannot refer themselves", selfAttribute.r === null);

// Earnings wait for delivery, then the return window.
await asUser(admin);
await expectError(
  "admin cannot release an earning before delivery",
  () => db.query("select public.admin_review_affiliate_commission($1, 'approve')", [commission.id]),
  /return window/i,
);

await asService();
await db.query("update orders set status = 'delivered' where id = $1", [affiliateOrder.id]);
const afterDelivery = await q("select * from affiliate_commissions where id = $1", [commission.id]);
check(
  "delivery sets the return-window unlock date",
  afterDelivery.eligible_at &&
    new Date(afterDelivery.eligible_at).getTime() > Date.now() + 6 * 86_400_000,
  `(eligible_at ${afterDelivery.eligible_at})`,
);
check("earning is still pending during the return window", afterDelivery.status === "pending");

await asUser(admin);
await expectError(
  "admin cannot release inside the return window",
  () => db.query("select public.admin_review_affiliate_commission($1, 'approve')", [commission.id]),
  /return window/i,
);

await asService();
await db.query(
  "update affiliate_commissions set eligible_at = now() - interval '1 minute' where id = $1",
  [commission.id],
);
const released = await q("select public.release_affiliate_commissions() as n");
check("maintenance releases earnings past the return window", released.n === 1);
check(
  "released earning is approved",
  (await q("select status from affiliate_commissions where id = $1", [commission.id])).status ===
    "approved",
);

await asUser(buyer3);
const paidDashboard = await q("select public.affiliate_dashboard() as r");
check("released earnings show as available", paidDashboard.r.availablePaise === 2500);

await asUser(admin);
await db.query("select public.admin_review_affiliate_commission($1, 'pay')", [commission.id]);
check(
  "admin can mark an approved earning paid",
  (await q("select status from affiliate_commissions where id = $1", [commission.id])).status ===
    "paid",
);

// A returned order voids its earning.
await asService();
const returnedOrder = await q(`
  insert into orders (order_number, buyer_id, seller_id, status, source,
    subtotal_paise, shipping_paise, total_paise, payment_status, payment_method,
    shipping_address, paid_at)
  values ('AFF-2', '${buyer1}', '${seller}', 'paid', 'buy_now',
    30000, 0, 30000, 'paid', 'upi', '{}', now())
  returning *
`);
check(
  "a second paid order also earns",
  Boolean(await q("select 1 as n from affiliate_commissions where order_id = $1", [returnedOrder.id])),
);
await db.query("update orders set status = 'returned' where id = $1", [returnedOrder.id]);
check(
  "a returned order voids the earning",
  (await q("select status from affiliate_commissions where order_id = $1", [returnedOrder.id]))
    .status === "void",
);

// Admin-managed external links for colleges and creators.
await asUser(admin);
const created = await q(
  "select public.admin_create_affiliate('Campus Finds', 'club@college.edu', 'campus', 'college', 4.5) as r",
);
check("admin can create an external link", created?.r?.code === "campus" && created?.r?.user_id === null);
check(
  "external link keeps its type and rate",
  created?.r?.kind === "college" && Number(created?.r?.commission_pct) === 4.5,
  `(kind ${created?.r?.kind}, pct ${created?.r?.commission_pct})`,
);
await db.query("select public.admin_update_affiliate($1, null, null, null, null, 6, null)", [
  created.r.id,
]);
check(
  "admin can change a link's commission",
  Number(
    (await q("select commission_pct from affiliate_accounts where id = $1", [created.r.id]))
      .commission_pct,
  ) === 6,
);
const listed = await q("select public.admin_list_affiliates() as r");
check(
  "admin list includes every link and its earnings",
  listed.r.accounts.length === 2 && listed.r.commissions.length === 2,
  `(accounts ${listed.r.accounts.length}, commissions ${listed.r.commissions.length})`,
);

await db.query("select public.admin_set_affiliate_status($1, 'paused')", [dashboard.r.account.id]);
check(
  "admin can pause an affiliate",
  (await q("select status from affiliate_accounts where code = $1", [code])).status === "paused",
);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall auction checks passed");
