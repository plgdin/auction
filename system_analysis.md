# Auction-Platform Comprehensive System Analysis

This document provides a detailed overview of the entire Auction-Platform application, a robust enterprise e-Auction and e-Procurement platform. 

---

## 1. Directory & Folder Structure

The project follows a highly modular React + Vite architecture. The root folder is split between configuration files, public assets, database scripts, and the primary source code (`src/`).

```text
D:\Website\Auction-Platform\
├── .env.local                 # Environment variables (Vite & Supabase keys)
├── package.json               # NPM dependencies (React 19, Zustand, Supabase, Tailwind v4)
├── vercel.json                # Vercel SPA routing rules (rewrites all routes to index.html)
├── vite.config.ts             # Vite bundler configuration
├── index.html                 # App entry point with dynamic SEO meta tags
├── supabase/
│   └── migrations/            # SQL scripts for database schemas, RLS policies, & RPC functions
└── src/                       # Application Source Code
    ├── App.tsx                # Main RouterProvider wrapper and Error Boundary
    ├── main.tsx               # React DOM rendering entry
    ├── index.css              # Global styles and Tailwind imports
    ├── types/                 # TypeScript interfaces
    │   └── database.types.ts  # Interfaces mirroring the Supabase schema (Auction, Bid, Profile)
    ├── store/                 # Zustand state management
    │   ├── appStore.ts        # Global UI state (e.g., sidebar toggles)
    │   └── authStore.ts       # Active user session and profile data
    ├── services/              # API interaction layer (Supabase clients)
    │   ├── adminService.ts    # Admin functions (user roles, announcements, global analytics)
    │   ├── auctionService.ts  # Core auction CRUD, bidding logic, and watchlist
    │   ├── authService.ts     # Login, registration, password resets
    │   ├── emailTemplateService.ts # Transactional email template generator
    │   ├── paymentService.ts  # EMD deposits, wallet top-ups, receipt fetching
    │   ├── storageService.ts  # Supabase bucket interactions for images and PDFs
    │   └── tenderService.ts   # e-Tendering specific logic
    ├── router/                
    │   └── index.tsx          # Centralized React Router configuration and route protection
    ├── layouts/               # High-level UI shells
    │   ├── AuthLayout.tsx     # Minimal layout for login/register
    │   ├── DashboardLayout.tsx# Authenticated dashboard with Sidebar and TopBar
    │   └── MainLayout.tsx     # Public-facing layout with Header and Footer
    ├── hooks/                 
    │   └── useAuctionRealtime.ts # Supabase Realtime channel listeners for live bidding
    ├── components/            # Reusable UI modular blocks
    │   ├── admin/             # Admin specific (SystemManagement, UserManagement)
    │   ├── auction/           # Auction specific (BiddingPanel, CountdownTimer, ImageGallery)
    │   ├── common/            # Shared UI (Sidebar, TopBar, AnnouncementBanner, ErrorBoundary)
    │   ├── forms/             # Authentication forms (Login, Register)
    │   ├── home/              # Public landing page sections (Hero, HowItWorks)
    │   ├── payment/           # Payment Modals and Receipt rendering
    │   └── tender/            # Tender specific (Submission forms)
    └── pages/                 # Full Page Views mapped to Routes (See Sitemap below)
```

---

## 2. Application Sitemap & Routing

The application utilizes `react-router-dom` to segment the platform into three main zones: Public, Auth, and Secure Dashboards.

### Public Zone (Unauthenticated Access)
- `/` - Home Page (Hero, Featured Auctions, Service Categories)
- `/auctions` - Global Auction Directory (Filterable grid of active auctions)
- `/auctions/:id` - Auction Detail Page (Public view of details; login required to bid)
- `/tenders` - Global e-Tender Directory
- `/tenders/:id` - Tender Detail Page
- `/about` - About Auction
- `/contact` - Helpdesk & Contact
- `/faq` - Frequently Asked Questions
- `/notices` - System Notices & Legal
- `/news` - Industry News

### Authentication Zone
- `/auth/login` - User Login
- `/auth/register` - New Organization / User Registration
- `/auth/forgot-password` - Password Recovery
- `/auth/reset-password` - Password Reset Execution

### Secure Dashboard Zone (Requires Login)
**Buyer / General Dashboard (`/dashboard`)**
- `/dashboard` - Overview (Wallet balance, quick stats)
- `/dashboard/bids` - My Bids (History of active/won bids)
- `/dashboard/tenders` - My Tenders (Submitted tender tracking)
- `/dashboard/watchlist` - Watchlist (Saved upcoming auctions)
- `/dashboard/wallet` - Wallet & EMD (Funds management and deposit)
- `/dashboard/documents` - Document Vault (Centralized file manager for KYC/attachments)
- `/dashboard/notifications` - Alert Center (Inbox for outbid/win alerts)
- `/dashboard/profile` - Profile Settings (User data & Alert preferences)

**Seller Portal (`/seller`)** *(Requires `seller` or `admin` role)*
- `/seller` - Seller Analytics Dashboard (Revenue, active auctions)
- `/seller/auctions` - Manage Auctions (List of seller's created auctions)
- `/seller/auctions/create` - Create New Auction (Multi-step form & file upload)
- `/seller/auctions/:id/edit` - Edit Existing Auction

**Admin Control Panel (`/admin`)** *(Requires `admin` or `superadmin` role)*
- `/admin` - Tabbed Enterprise Dashboard
  - *User Management*: Approve sellers, suspend accounts
  - *Reports & Analytics*: CSV exports, platform metrics
  - *System Management*: Push global announcements, send direct messages

---

## 3. Core Workflows

### A. The Bidding & Procurement Workflow (Buyer)
1. **Discovery**: The user browses the public `/auctions` list and clicks into an `AuctionDetail` page.
2. **Qualification (EMD)**: To participate, the user must have sufficient Earnest Money Deposit. They navigate to `/dashboard/wallet` to top up their virtual balance using the `PaymentModal`.
3. **Live Bidding**: In the `AuctionDetail` page, the user accesses the `BiddingPanel`. 
4. **Realtime Engine**: The frontend subscribes to Supabase Realtime via `useAuctionRealtime.ts`. Bids are processed via a server-side PostgreSQL RPC (`place_bid`) to prevent race conditions and sniping.
5. **Winning**: If the countdown expires and the user is the highest bidder, the auction status turns to `closed`. The user receives an automated notification (via `emailTemplateService.ts` and in-app alerts).

### B. The Asset Liquidation Workflow (Seller)
1. **Creation**: A registered seller navigates to `/seller/auctions/create`.
2. **Drafting**: They fill out extensive metadata (lot details, reserve price, dates).
3. **Asset Upload**: The user uploads images and PDF documents. The `storageService.ts` handles pushing these to the Supabase `auction-assets` bucket and generating public URLs.
4. **Publishing**: The auction is set to `upcoming` or `active` status.
5. **Monitoring**: The seller tracks realtime engagement on the `/seller` analytics dashboard.

### C. The Administrative Workflow (Super Admin)
1. **Governance**: The Admin monitors platform health via `/admin`.
2. **Access Control**: They can elevate a standard user to a `seller` allowing them to list assets.
3. **Broadcasting**: During maintenance or urgent updates, the Admin uses the "System Management" tab to publish an Announcement. This immediately triggers the `AnnouncementBanner.tsx` across the screen of every active user.
4. **Targeted Alerting**: The Admin can push direct in-app notifications to a specific user's Bell dropdown.

### D. The File Management Workflow (Document Center)
1. **Aggregation**: The new `DocumentVault` fetches data across disparate tables (`auction_documents`, `tender_documents`) based on the active user's ID.
2. **Interaction**: Users can view a sanitized, chronological list of their files.
3. **Preview/Extract**: Clicking "Preview" opens an in-app modal using `<object>` rendering (for PDFs) or `<img />`. Clicking "Download" triggers a browser-level Blob extraction via `storageService`.
