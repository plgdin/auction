# Routing migration report — Hash routing → React Router BrowserRouter

Date: 2026-11-18

## 1. Audit findings (before migration)

- App had **no React Router usage** despite `react-router-dom` being installed.
- Routing was a hand-rolled hash router: `src/lib/router.ts` (`useRoute`) + `src/components/Link.tsx` (`Link`, `navigate`).
- `App.tsx` dispatched pages with a manual `if (path === ...)` chain.
- Routes lived in the URL fragment (`/#/products`), invisible to servers and crawlers.
- No per-product SEO metadata. `index.html` hardcodes homepage title, canonical and OG/Twitter tags.
- Hash fragments broke nested anchors and query parsing (`#/product/1#anchor`, `#/products?q=x#anchor`).
- Google OAuth redirect, affiliate links and notification hrefs all encoded `#/...`.
- `vercel.json` did not exist; deep links had no server-side fallback.

## 2. Migration implemented

- `src/main.tsx`: app wrapped in `BrowserRouter`.
- `src/App.tsx`: replaced manual route chain with declarative `<Routes>`/`<Route>`; added wildcard `NotFound` (404) with `noindex` metadata; added legacy `/#/path` → `/path` redirect.
- `src/components/Link.tsx`: `Link` now wraps React Router `Link`; `navigate()` delegates to `useNavigate()` through `RouterNavigationBridge`; legacy `#/` strings still normalised.
- `src/lib/router.ts`: `useRoute()` now derives `{ path, query, anchor, raw }` from `useLocation()`; query object memoised to avoid effect churn; added `currentPath()`.
- Route params: product, auction and order detail pages now use `useParams()`.
- Auth: `promptAuth`, `withNext`, `AuthPage` next-redirect and Google OAuth callback use clean paths; added open-redirect guard (`//`).
- Tab writers (Account, Admin, Auctions, SellerDashboard) now use `navigate()` instead of `window.location.hash`.
- Affiliate URLs now clean (`/products?ref=CODE`); click tracking records pathname + search.
- Notifications/seed data hrefs converted to clean paths.
- Raw `<a href="#/...">` in `parallax-scrolling.tsx` converted to router `Link`.
- Added `vercel.json` with SPA fallback that excludes `/api`, `/ws`, static asset prefixes and root metadata files.
- Added `src/lib/seo.ts` and wired product, category, auction and 404 pages for title/description/canonical/OG/Twitter/JSON-LD.
- Updated sitemap, llms.txt and Playwright tests to clean URLs.

## 3. Routes migrated

| Old hash URL | New clean URL | Page |
|---|---|---|
| `/#/` | `/` | Home |
| `/#/products` | `/products` | Products |
| `/#/shop` | `/shop` (redirect → `/products`) | Products |
| `/#/product/:id` | `/product/:id` | Product detail |
| `/#/cart` | `/cart` | Cart |
| `/#/checkout` | `/checkout` | Checkout |
| `/#/auctions` | `/auctions` | Auctions |
| `/#/auction/:id` | `/auction/:id` | Auction detail |
| `/#/login` | `/login` | Sign in |
| `/#/register` | `/register` | Register |
| `/#/sell` | `/sell` | Sell landing |
| `/#/sell/new` | `/sell/new` | Listing form |
| `/#/seller` | `/seller` | Seller dashboard |
| `/#/account` | `/account` | Account |
| `/#/admin` | `/admin` | Admin |
| `/#/order-confirmed/:id` | `/order-confirmed/:id` | Order confirmation |
| `/#/order-success/:id` | `/order-success/:id` | Order confirmation |
| `/#/payment-failed` / `/#/payment-failed/:id` | `/payment-failed(/:id)` | Payment failed |
| `/#/orders/:id` | `/orders/:id` | Order detail |
| `/#/terms` | `/terms` | Terms |
| `/#/privacy` | `/privacy` | Privacy |
| `/#/returns` | `/returns` | Returns |
| `/#/auction-terms` | `/auction-terms` | Auction terms |
| unknown | `*` → NotFound | 404 |

Query forms preserved: `/products?q=`, `/products?category=`, `/account?tab=`, `/seller?tab=`, `/admin?tab=`, `/auctions?tab=`, `/checkout?product=`, `/checkout?offer=`, `/product/:id?offer=1`, `/payment-failed?order=`, `/?ref=`.

## 4. Verification

- `npm run build`: passes (`tsc -b && vite build`).
- Direct URL / refresh: HTTP 200 + SPA HTML on `/`, `/products`, `/product/p-1`, `/auctions`, `/auction/a-1`, `/checkout?product=p-1`, `/login`, `/account?tab=orders`, `/orders/o-1`, `/terms`, and unknown routes (in-app 404).
- Static assets: `/images/auction.svg`, `/robots.txt`, `/sitemap.xml` serve real files, not HTML.
- `vercel.json`: valid JSON; SPA fallback excludes `/api`, `/ws`, asset prefixes, favicons/PWA icons, and metadata files.
- New `tests/routing-migration.spec.ts`: **5/5 pass** — direct access + refresh on all 21 migrated routes, legacy hash redirect, back/forward, 404 + `noindex`, product canonical/OG/JSON-LD.
- Full existing suite: 9 pass / 8 fail after migration. The 8 failures are pre-existing test defects unrelated to routing (stale mobile-nav label, missing checkbox/session setup in affiliate tests, text expectation mismatch, async catalog ID race). No routing failure remains.

## 5. Remaining SEO limitations

All items below have since been addressed. See `SEO_MIGRATION.md`:

- Server-generated HTML now carries route-specific metadata (product, auction, category, 404).
- Non-JS crawlers now receive the correct OG/Twitter tags and JSON-LD.
- Sitemap is generated live from Supabase, with a sitemap index and child files.
- Unknown routes and missing listings now return genuine HTTP 404.
- Legacy singular order notification URLs are normalized in SQL and in the client.

Remaining caveat: the visible page content is still client-rendered. Server HTML contains metadata plus the SPA shell, not pre-rendered body text. Crawlers that execute JavaScript see the full page; those that do not see metadata only.
