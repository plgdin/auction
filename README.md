# lelam.co marketplace

A pre-owned marketplace for Trivandrum with private offers, cash-on-delivery checkout, seller tools, and an admin console. React + TypeScript + Vite on the front end, Supabase (Postgres, Auth, Storage, Realtime) on the back end.

## Run locally

```sh
npm install
cp .env.example .env.local   # then paste your Supabase URL + anon key
npm run dev
```

Open the localhost URL printed by Vite (usually http://localhost:5173).

```sh
npm run build  # Type check and production build
npm run preview
npm test       # Playwright browser checks
```

For a fresh machine, install the test browser with `npx playwright install chromium` before running tests.

`.env.local` is git-ignored. Only the public Supabase URL and anon key belong there.

## Backend setup

The database lives in `supabase/migrations/`. Apply the files in order:

1. `supabase/migrations/20260101000000_marketplace_schema.sql`
2. `supabase/migrations/20260101000100_supabase_backend.sql`

Either push them with the CLI:

```sh
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

or paste each file into the Supabase dashboard **SQL Editor** and run it. The addendum is idempotent, so re-running it is safe.

The SQL creates the schema, RLS policies, RPCs, the `product-images` storage bucket, the 16 broad categories, and Realtime publications. It promotes `admin@lelam.com` to admin if that auth user exists; create that user first, or run the final `update public.profiles ...` block again after signing up.

### Auth notes

- New accounts are created through Supabase Auth. If email confirmation is enabled, the signup screen asks the user to confirm before signing in. Disable **Confirm email** under Authentication → Providers → Email for frictionless local testing.
- The browser never sees the service-role key. Payment verification runs in Edge Functions.

### Payments

Cash on delivery is live and is the default at checkout. Online payments (UPI/card) stay disabled until the Razorpay keys are configured:

```sh
npx supabase functions deploy razorpay-create-order
npx supabase functions deploy razorpay-verify-payment
npx supabase secrets set RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=...
```

Then add `VITE_RAZORPAY_KEY_ID` to `.env.local`. Without it, the UPI and card options render disabled and checkout uses COD.

### Auctions

The auction engine is intentionally off (`auction_engine_enabled = false`). Auction tables are read-only from the client, and the UI surfaces a "not configured" message instead of accepting bids.

## Included

- Email/password auth with buyer, seller, and admin roles
- Listing creation with photo upload to Supabase Storage, editing, pausing, and removal
- 16-category catalog, search, filters, and saved products
- Private offers with expiry, seller accept/decline, and offer checkout
- Cart checkout grouped per seller, COD live, online payments scaffolded
- Shipment timeline, returns, reviews, and notifications
- Seller dashboard for listings, offers, orders, earnings, and payouts
- Admin console for listing moderation, reports, users, settings, and settlements
- Row Level Security on every table, with public data exposed through safe views

## Ground rules

- All money is stored as integer paise. The UI formats it for display.
- Writes go through Postgres RPCs or RLS-scoped tables; the client never mutates orders, offers, products, or payments directly.
- The legacy Express/PGlite server in `server/` is not used by this app and can be ignored.

## Visual inspiration & photography

Original design informed by the editorial curation and slow-fashion approach of [Rogue + Runway](https://www.databending.ca/work/rogue-runway/), [Born Again Thrift SF](https://dianabenavides.dev/projects/born-again-thrift-sf), and [La Fair Art](https://www.lunarinnovate.com/en/portfolio/la-fair-art).

Demonstration photography: [Unsplash](https://unsplash.com). Replace demonstration photos with your actual inventory before launch.
