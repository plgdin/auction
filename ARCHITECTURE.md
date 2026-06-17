# MSTC-Assist Project Architecture & Design

## 1. Project Overview & Vision
This project is an **AI-powered auction discovery and assistance platform** that helps users quickly find relevant auction items listed on the official MSTC eCommerce website.

It acts strictly as an **auction discovery assistant and search engine**, reducing the friction of finding items across thousands of dense catalog PDFs. Bidders use our platform for discovery, search, and intelligent summaries, and are then redirected to the official MSTC portal for actual participation, registration, bidding, and payment.

---

## 2. Enterprise Architecture

```mermaid
flowchart TD
    %% Global Styling Definitions
    classDef worker fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef storage fill:#0369a1,stroke:#38bdf8,stroke-width:2px,color:#fff
    classDef module fill:#334155,stroke:#cbd5e1,stroke-width:1px,color:#f8fafc
    classDef external fill:#4c1d95,stroke:#a78bfa,stroke-width:3px,color:#fff,stroke-dasharray: 5 5

    %% Layer 1
    subgraph Layer1 [Layer 1 — Data Collection Pipeline (Node.js & Python Workers)]
        direction TB
        A1[Scraper / Cron Job]:::worker --> A2[Puppeteer Crawler]:::worker
        A2 --> A3[Auction Metadata + PDF Downloader]:::worker
        A3 --> A4[(Supabase Storage - Original PDFs)]:::storage
        A4 --> A5[PDF Parser & OCR Engine]:::worker
        A5 --> A6[Metadata Extractor & PDF Renderer]:::worker
        A6 --> A7[(Supabase PostgreSQL Search Index)]:::storage
    end

    %% Layer 2
    subgraph Layer2 [Layer 2 — MSTC-Assist Discovery Platform (React + TS + Vite)]
        direction TB
        
        subgraph SearchMod [A. Search & Discovery]
            direction TB
            S1(Global Search Bar):::module
            S2(Smart Metadata Filters):::module
            S3(Category Browser):::module
            S4(Search Results):::module
            S5(Item Detail Page):::module
            S6(AI Summary Panel):::module
        end
        
        subgraph UserMod [B. User Features]
            direction TB
            U1(Login / Register):::module
            U2(Saved Watchlist):::module
            U3(Notifications & Alerts):::module
            U4(User Profile):::module
        end
    end

    %% Layer 3
    subgraph Layer3 [Layer 3 — Official MSTC Handoff]
        direction TB
        MSTC(((Official MSTC eCommerce Portal))):::external
    end

    %% Architecture Connections
    A7 -. "Queries Data from Index" .-> Layer2
    S5 -- "Open Official MSTC Listing" ---> MSTC
```

### Layer 1: Data Collection & Asset Worker Pipeline
* Headless crawlers navigate configuring pages to detect newly published auctions and retrieve catalog PDFs.
* The **Asset Worker** (`scraper/assetWorker.ts`):
  * Renders PDF pages to images and uploads them to Supabase Storage.
  * Performs OCR to extract hidden quantity data from embedded scanned lot tables/photos.
  * Automatically appends dynamic eligibility notices to catalog data.
  * Populates the PostgreSQL Search Index.

### Layer 2: Discovery Platform
* The user-facing web app connects directly to the Supabase PostgreSQL Search Index.
* Displays listings, filters by category, provides a responsive watchlist, and visualizes extracted lot images/receipts.

### Layer 3: Handoff
* Provides seamless "Open Official MSTC Listing" redirects for active bidding.

---

## 3. Directory & Folder Structure

```text
auction/
├── package.json               # NPM dependencies (React 19, Supabase, Tailwind, Tesseract)
├── vite.config.ts             # Vite bundler configuration
├── index.html                 # App entry point with meta tags
├── supabase/                  # SQL scripts for database schemas & RLS policies
├── public/                    # Static public assets
├── scraper/                   # Backend crawlers and workers
│   ├── scraper.ts             # Main catalog downloader and initial parser
│   ├── assetWorker.ts         # Persistent PDF renderer, OCR processor, and queue consumer
│   ├── config.ts              # Crawler configuration settings
│   ├── parsers/               # Parsing engines
│   │   └── mstcParser.ts      # Main MSTC catalog text extraction parser
│   └── utils/                 # Crawler helper utilities
├── scratch/                   # Temporary development scripts and debugging tools
├── scripts/                   # Launch & build orchestration scripts
└── src/                       # Frontend application source code
    ├── App.tsx                # Application shell and routing setup
    ├── main.tsx               # DOM initialization
    ├── index.css              # Styling sheet
    ├── types/                 # TypeScript interfaces
    ├── store/                 # Zustand state managers
    ├── services/              # API interaction clients
    ├── layouts/               # Page shells (Dashboard, Auth, Main)
    ├── components/            # Reusable UI components
    └── pages/                 # Full Page Views mapped to Routes
```

---

## 4. Database Schema Design

The search index operates on these primary entities in PostgreSQL (Supabase):

* **`mstc_auctions`**: Represents crawled auctions. Key columns:
  * `mstc_auction_number` (Text, Primary Key)
  * `seller_name` (Text)
  * `category_name` (Text)
  * `location` (Text)
  * `raw_materials_text` (JSONB) - Holds parsed items, EMD details, contacts, and eligibility.
  * `asset_status` ('pending', 'completed', 'failed')
  * `preview_image_url` (Text)
  * `extracted_images` (JSONB) - Array of lot-specific image URLs.
* **`profiles`**: User profiles with specific roles (`buyer`, `seller`, `admin`).
* **`watchlist`**: Tracks users' saved/watched auctions.
