# SEO / social preview / sitemap / 404 migration

Date: 2026-11-18

## 1. Issues fixed

| Issue | Fix |
|---|---|
| Every route returned identical `index.html`; metadata injected after hydration | Vercel Node functions inject route-specific metadata into the built SPA shell before the response is sent |
| WhatsApp/Telegram/Discord/Facebook saw homepage tags | Full `og:*` and `twitter:*` tags now exist in the initial HTML, with absolute HTTPS image URLs |
| Missing/empty images produced broken previews | `absoluteUrl()` falls back to `https://lelam.co/images/gpt/hero-jacket.jpg` (900×1125) and declares its real dimensions |
| Static sitemap could not list live listings | `/sitemap.xml` is now a live sitemap index with product, auction, category and static children generated from Supabase |
| Vercel returned HTTP 200 for unknown routes | Render function returns 404 for unknown paths, nonexistent products and nonexistent auctions |
| Legacy `#/order/:id` notification hrefs broke | New SQL migration + client normalization + server 308 redirect; historical migrations untouched |

## 2. Architecture for server-generated metadata

Lightweight Vercel Node functions layered over the existing React + Vite SPA. No Next.js, no framework migration, no change to BrowserRouter or business logic.

```
GET /product/:id  ─┐
GET /auction/:id  ─┤
GET /products     ─┼─ vercel.json rewrite ─> /api/render?path=/<path>
GET /auctions     ─┤                          │
GET /<unknown>    ─┘                          ├─ server/lib/data.ts     (Supabase anon, seed fallback)
                                              ├─ server/lib/meta.ts     (mirror of src/lib/seo.ts)
                                              ├─ server/lib/html.ts     (strip defaults, inject head)
                                              └─ server/lib/shell.generated.ts (built dist/index.html)
```

- Sources live in `server/`; `npm run build` bundles each endpoint with esbuild into **one self-contained file** (`api/render.js`, `api/sitemap.js`, `api/health.js`). Vercel transpiles every file in `api/` independently, so a deployed function cannot import `./lib/*` at runtime — bundling removes all relative imports from the shipped file.
- `server/lib/shell.generated.ts` is generated from `dist/index.html` by a Vite `closeBundle` plugin. Vite emits stable `/assets/app.js` and `/assets/index.css` names so the committed shell stays valid even if a platform bundles functions before running the build.
- `src/lib/seo.ts` is preserved unchanged. Pure builders moved to `src/lib/seo-meta.ts`, shared by server and client so hydration never strips server JSON-LD.
- `vite.config.ts` includes a dev middleware that calls the exact same `renderRoute()` / `buildSitemap()` functions, so local tests exercise production-equivalent HTML.
- Metadata parity: title, description, canonical, robots, `og:type/url/site_name/title/description/image/image:alt`, `twitter:card/title/description/image`, JSON-LD. Auction pages gain JSON-LD that the client did not previously emit.
- Images: relative paths resolved against `https://lelam.co`; absolute URLs kept. Crawler-visible dimensions are declared only for the known fallback image.

## 3. Social preview verification

Verified against raw HTTP responses (Playwright `request`, no JavaScript execution):

- `/product/p-1` → title `The worn-in denim jacket · ₹1,450 | Lelam`, canonical `https://lelam.co/product/p-1`, `og:image https://lelam.co/images/denim.jpg`, `twitter:card summary_large_image`, JSON-LD `Product`.
- `/auction/a-1` → title `The worn-in denim jacket · Live Auction | Lelam`, `og:type product`, JSON-LD `Product`.
- `/products` and `/products?category=Women` → category-specific title/description/canonical.
- Live Supabase product `664d6b4f-…` → image `https://lelam.co/images/bag.jpg`, correct title and JSON-LD.
- Exactly one `og:title` and one canonical tag (default tags stripped before injection).

Tests: `tests/seo-server.spec.ts` — product/auction initial HTML, WhatsApp OG, Twitter Card, canonicals, JSON-LD, sitemap, 404s, legacy redirects, Vercel handlers, assets/API.

## 4. Dynamic sitemap

- `/sitemap.xml` → `<sitemapindex>` pointing to four child files.
- `/sitemap-static.xml` → homepage, `/sell`, four policy pages. Login, register, cart, checkout, account, admin, seller, orders are excluded.
- `/sitemap-categories.xml` → nine public category URLs.
- `/sitemap-products.xml` → live rows from anon-readable `public_products` view (active/reserved only, blocked sellers filtered by the view). `lastmod` from `created_at`.
- `/sitemap-auctions.xml` → only `live`/`scheduled` auctions; `lastmod` from `ends_at` or `created_at`.
- URLs deduplicated. New published listings appear on the next request; no manual edit needed. CDN cache 1 hour.
- Demo seed data is used only when Supabase is unavailable; sold/pending demo listings are filtered out.

## 5. Genuine HTTP 404

- `vercel.json` rewrites all non-asset page paths to `/api/render`.
- `server/lib/render.ts` resolves product and auction IDs via Supabase (with seed fallback). Missing ID → status 404 with `noindex, follow` head and the SPA shell, so the client `NotFound` page still renders.
- Unknown public routes → 404. Valid SPA routes (cart, login, checkout, account, dashboards, order confirmation, etc.) → 200 shell, unchanged.
- Exclusions preserved: `/api`, `/ws`, `/assets`, `/images`, `/fonts`, `/ass`, `/.well-known`, favicons/PWA icons, `robots.txt`, `llms.txt`, `site.webmanifest`, all static file extensions, `index.html`.
- Static `public/sitemap.xml` removed so the dynamic sitemap function owns that path.

## 6. Legacy notification URLs

- `src/components/Link.tsx`: `normalizeHref()` strips `#/` and maps `^/order/` → `/orders/` (strict, so `/order-confirmed/` is untouched).
- `src/App.tsx`: added `/order/:orderId` → `/orders/:orderId` redirect; legacy hash redirect uses the same normalizer.
- `vercel.json`: permanent redirect `/order/:id` → `/orders/:id`.
- New migration `supabase/migrations/20261119000000_notification_href_compat.sql`: BEFORE INSERT trigger normalizes `data->>'href'` for every future notification and backfills existing rows. Historical migrations were deliberately not edited (checksum/deploy safety).

## 7. Files

Created:
- `src/lib/seo-meta.ts`
- `server/render.ts`, `server/sitemap.ts`, `server/health.ts`
- `server/lib/meta.ts`, `server/lib/html.ts`, `server/lib/data.ts`, `server/lib/render.ts`, `server/lib/sitemap.ts`
- `server/lib/shell.generated.ts` (generated by `vite build`)
- `scripts/build-api.mjs` (esbuild bundling of the endpoints into `api/*.js` self-contained functions)
- `tests/seo-server.spec.ts`
- `supabase/migrations/20261119000000_notification_href_compat.sql`
- `SEO_MIGRATION.md`

Modified:
- `src/pages/ProductDetail.tsx`, `src/pages/AuctionDetail.tsx`, `src/pages/Products.tsx`, `src/App.tsx` (use shared builders)
- `vite.config.ts` (SEO dev middleware, shell generation, stable asset names)
- `vercel.json` (function rewrites, sitemap routes, legacy redirect, preserved exclusions)
- `src/components/Link.tsx`, `src/App.tsx`
- `ROUTING_MIGRATION.md`
- Deleted `public/sitemap.xml`

## 8. Deployment / environment

- No new environment variables. Functions reuse `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key, RLS-protected public views) server-side. Add them as Vercel project env vars if they are not already present.
- Vercel build command `npm run build`, output `dist`. The build also bundles the SEO endpoints into `api/render.js`, `api/sitemap.js` and `api/health.js` (esbuild, already present via Vite); those single-file functions are detected automatically — no new runtime dependency.
- Diagnostics: `GET /api/health` reports the Node version, whether the Supabase env vars reached the function, and which server modules loaded.
- Deploy preview before production: verify a shared product URL with WhatsApp's debugger, `/sitemap.xml`, and an unknown route's status code.

## 9. Build and tests

- `npm run build`: passes. Stable `assets/app.js` + `assets/index.css`; pre-existing chunk-size warning only.
- `npx playwright test tests/seo-server.spec.ts --workers=2`: **16 passed**.
- `npx playwright test tests/routing-migration.spec.ts --workers=2`: **5 passed**.
- Full suite: **26 passed / 7 failed**. All 7 failures are pre-existing defects documented in `ROUTING_MIGRATION.md` (stale mobile-nav label, affiliate checkbox/session setup, text expectation mismatch, saved-overlay string, async catalog). No new failure introduced.

## 10. Remaining limitations

- Page body is still client-rendered. Non-JS crawlers receive metadata + empty SPA shell, not pre-rendered listing text. Full text indexing depends on crawlers executing JS.
- Product/auction metadata is cached at the CDN for 5 minutes; the sitemap for 1 hour. No on-demand purge is implemented.
- `og:image` dimensions are only declared for the fallback image; product images are measured by the crawler.
- Supabase anon access cannot expose sold/removed products through `public_products`; auction pages for sold products may fall back to 404 until a service-role reader is configured.
- WhatsApp/Telegram caches previews. Re-scrape after deploy or after changing an image.
