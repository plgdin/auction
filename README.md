# Lelam - Enterprise Lelam & Procurement Platform

![Lelam Logo](/vite.svg)

Lelam is a comprehensive, scalable, and highly secure B2B/B2C marketplace platform explicitly designed for enterprise asset disposal, forward auctions, and e-tendering. Built with a modern React + TypeScript frontend and powered by a Serverless Postgres database via Supabase.

## Core Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **State Management**: Zustand (Client Session & UI State)
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Realtime)
- **Routing**: React Router v7
- **Deployment**: Configured for Vercel (Edge-ready)

## Production Deployment Guide (Vercel)

This application is configured as a Single Page Application (SPA) and is fully optimized for Vercel deployment. 

### 1. Pre-Deployment Configuration
Ensure you have the following Environment Variables ready:
- `VITE_SUPABASE_URL`: Your Supabase project REST URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous API key

### 2. Vercel Deployment Steps
1. Connect your GitHub repository to Vercel.
2. In the Vercel project configuration, set the **Framework Preset** to `Vite`.
3. Vercel will automatically detect the build command (`npm run build`) and output directory (`dist`).
4. In the **Environment Variables** section, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` matching your production Supabase instance.
5. Click **Deploy**. Vercel will process the `vercel.json` file automatically to ensure React Router URLs function correctly on refresh.

---

## Supabase Production Checklist

Before going live, your Supabase backend must have the following configured:

### Database Schema
1. Run the `00001_initial_schema.sql` migration to create tables (`profiles`, `categories`, `auctions`, `bids`, `tenders`, `watchlists`, `audit_logs`, `announcements`, `notifications`).
2. Ensure triggers for timestamp updates (`updated_at`) are active.

### Storage Buckets
1. Create a **public** storage bucket named precisely `auction_documents`.
2. Apply Storage RLS policies allowing authenticated users to `INSERT` into the bucket, and allowing public access to `SELECT`.

### Security (Row Level Security - RLS)
1. Verify that RLS is **ENABLED** on all tables.
2. Verify `00003_bidding_logic.sql` is executed to establish the `place_bid` RPC function. This guarantees atomic, transactional integrity during high-frequency bidding, preventing race conditions and bypassing client-side validation tampering.

---

## Post-Deployment Verification Checklist

Once the Vercel deployment is live, manually verify the following critical user flows:

- [ ] **Authentication**: Create a new buyer account, log out, and log back in.
- [ ] **SPA Routing**: Navigate to `/dashboard`, then hard-refresh (F5) the browser. The page should reload successfully without a 404 error (proving `vercel.json` is working).
- [ ] **Storage Upload**: Log in as a Seller or Admin, navigate to the Document Vault (`/dashboard/documents`), and upload a test file. Ensure it renders correctly.
- [ ] **Realtime Bidding**: Open the same active auction in two different incognito windows. Place a bid in Window A and verify Window B updates the current bid price instantly without a page refresh.
- [ ] **Global Broadcast**: As an Admin, publish an urgent system announcement. Verify the red banner instantly appears across the application.

## Directory Structure
```text
src/
├── components/     # Modular React components (auction, admin, common)
├── hooks/          # Custom React hooks (useAuctionRealtime)
├── layouts/        # Application shell layouts (Main, Dashboard, Auth)
├── pages/          # Full page views (Home, Dashboard, Seller, Admin)
├── services/       # Supabase database interaction layer & valuation models
├── store/          # Zustand global state management
└── types/          # TypeScript interfaces (database schema)

scraper/
├── parsers/        # Modular HTML/JSON parsers (BaankNet, GeM, MSTC)
├── utils/          # Shared utilities (CORS, storage, logger, regexes, alerting)
├── schemas/        # Zod validation schemas for zero-trust ingestion
├── baanknetScraper.ts       # Puppeteer multi-module scraper (SARFAESI, Property, Vehicle, IBC)
├── baanknetAssetWorker.ts   # Document mirroring daemon & PDF archiver
├── gemScraper.ts            # GeM forward auction crawler
└── mstcScraper.ts           # MSTC industrial lot scraper
```

---

## Scraper & Asset Pipeline Architecture

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      1. OFFICIAL DATA SOURCES                          │
 │  • BaankNet (PSB Alliance SARFAESI Foreclosures)                       │
 │  • IBBI / IBC (Corporate Insolvency & Liquidation Assets)              │
 │  • GeM (Government e-Marketplace Forward Auctions & Bids)              │
 │  • MSTC (PSU & Heavy Industry Asset Disposals)                         │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                  2. HEADLESS EXTRACTION & PARSING                      │
 │  • Puppeteer Stealth Engine + Multi-Module DOM Parsers                 │
 │  • Canonical IBC Extractors (CIN, NCLT Bench, Case No, Liquidator Reg) │
 │  • Zod Schema Validation & Data Deduplication                          │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                  3. SYMMETRIC SUPABASE DATABASE UPSERT                 │
 │  • Upserts records to `baanknet_auctions`, `gem_auctions`, etc.        │
 │  • Symmetrically updates titles, categories, addresses, and boundaries │
 │  • Sets `documents_archived = false` for newly discovered notices      │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │              4. ASSET WORKER & DOCUMENT STORAGE MIRRORING              │
 │  • Polls unarchived records (`documents_archived = false`)             │
 │  • Fetches PDF notice, validates `%PDF` magic bytes & content-type     │
 │  • Uploads to private Supabase Storage (`baanknet-documents/...`)      │
 │  • Updates record: `documents_archived = true`, `document_storage_path`│
 │  • Dispatches automated email alerts on unhandled errors via Resend    │
 └────────────────────────────────────────────────────────────────────────┘
```

### Required Environment Variables

| Variable | Description | Required In |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Supabase API REST URL | Scraper / API / Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase elevated admin secret key | Scraper / API |
| `ALLOWED_ORIGINS` | Comma-delimited list of permitted CORS origins (e.g. `https://lelam.co`) | API |
| `INTERNAL_API_SECRET` | Machine-to-machine trigger token for cron/webhooks | API / Worker |
| `RESEND_API_KEY` | API key for transactional email and pipeline failure alerting | API / Worker |
| `ADMIN_ALERT_EMAIL` | Destination inbox for scraping and pipeline error notifications | Worker |

### CLI Commands & Automation

```bash
# Run BaankNet Scraper across all 4 modules (SARFAESI, Property, Vehicle, IBC)
npm run scrape:baanknet

# Run BaankNet Asset Worker in single batch pass
npm run worker:baanknet -- --once

# Run BaankNet Asset Worker as a continuous polling daemon
npm run worker:baanknet

# Retroactively clean and re-parse all existing records
npx tsx scraper/backfillBaanknetListings.ts --apply

# Run the complete test suite
npm test
```

### Security & Destructive Operation Guardrails
- **CORS Protection**: Origin headers are strictly matched against `ALLOWED_ORIGINS` using `api/utils/cors.ts`. Wildcard CORS is disabled on mutating endpoints.
- **Destructive Purge Guard**: Wiping scraped catalogs via `/api/scraper/clear-db/start` requires verified admin authentication AND an explicit header: `x-destructive-confirm: CONFIRM_PURGE_ALL_SCRAPED_DATA`.
