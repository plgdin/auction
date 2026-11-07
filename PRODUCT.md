# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Indian retail buyers (primary audience, rupee commerce, India-first). Thrift sellers list one-of-one pre-owned inventory on the marketplace; buyers browse and bid.

## Product Purpose

Lelam is a thrift / pre-owned marketplace where most items sell at fixed prices, with a twist: products can randomly flip into auctions, where buyers can win items for roughly half their current selling price. Success means buyers score genuine deals through the auction mechanic while sellers convert one-of-one inventory.

## Positioning

A thrift marketplace with a surprise-auction layer — shoppers browse everyday pre-owned goods, and the same item can drop into a live auction at a steep (~50% off) potential discount. The founder previously ran institutional eAuction aggregation (MSTC / BaankNet / GeM direction — see `direction_script.md`); that business model is explicitly in the past, not this product.

## Operating Context

- Buyers and sellers transact in rupees (₹); Razorpay is the integrated payment provider.
- Seller journeys exist in-product: `Sell`, `SellerDashboard`, `Admin`, `Account` pages.
- Server side is an Express app (`server/`) with PGlite storage, Supabase migrations in `supabase/migrations/`, JWT auth, realtime websocket layer (`server/lib/realtime.ts`), and rate limiting.
- Local preview: `npm run dev` (Vite), tests via `npm test` (Playwright).

## Capabilities and Constraints

- Marketplace pages live: Home, Products, ProductDetail, Cart, Checkout, Auctions, AuctionDetail, Auth, Sell, SellerDashboard, Account, Admin, OrderDetail (`src/pages/`).
- Auth, watchlist, cart, checkout, order records are implemented against the local store/backend, not mocked.
- Auctions support live bidding with countdowns (`src/components/Countdown.tsx`, realtime lib).
- Demonstration inventory and photography are illustrative (`src/data.ts`, Unsplash images in `public/images/`); real inventory photos must replace them before launch.
- No live payments/fraud/KYC behind Razorpay integration yet — production launch needs real services for payment capture and settlement. (Delivery/cod and support paths undecided.)

## Brand Commitments

- Name: Lelam / lelam.co.
- Visual direction references explicitly pinned in the README: the editorial curation and slow-fashion approach of Rogue + Runway, Born Again Thrift SF, and La Fair Art. These remain the incumbent visual inspiration; the institutional "OpenAI/Apple/Tendril launch-film" aesthetic in `direction_script.md` described the retired business and is not binding here.

## Evidence on Hand

- Working prototype: full page set, seeded demo inventory, Playwright checks (`tests/`).
- Demonstration photography (Unsplash IDs) in `public/images/` — not real inventory.
- `direction_script.md` documents the retired institutional-product story; treat as history, not product truth.

## Product Principles

- The deal is the hook: the random auction flip and ~half-price win must feel real, explainable, and trustworthy.
- India Retail first: rupee-native pricing, Indian payment rails, mobile-web-first shopping.
- One-of-one honesty: condition, size, and provenance are stated plainly; scarcity is the product.
- Trust before flash: clean Policies, clear seller identity, and safe payment expectations outrank spectacle.

## Accessibility & Inclusion

Keyboard-accessible navigation and native dialogs are existing practices (README); preserve and extend. No formal standard (WCAG target) has been pinned — undecided.
