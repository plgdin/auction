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
├── services/       # Supabase database interaction layer
├── store/          # Zustand global state management
└── types/          # TypeScript interfaces (database schema)
```
