# MSTC-Assist Enterprise Architecture

This document defines the canonical system architecture and user workflow for the **MSTC-Assist** platform. 

Unlike a traditional e-commerce or bidding application, this architecture strictly positions the project as an **AI-powered discovery assistant and search engine**. It continuously indexes public data and elegantly funnels users back to the official ecosystem for legal and financial transactions.

## Enterprise Architecture Diagram

```mermaid
flowchart TD
    %% Global Styling Definitions
    classDef worker fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef storage fill:#0369a1,stroke:#38bdf8,stroke-width:2px,color:#fff
    classDef module fill:#334155,stroke:#cbd5e1,stroke-width:1px,color:#f8fafc
    classDef external fill:#4c1d95,stroke:#a78bfa,stroke-width:3px,color:#fff,stroke-dasharray: 5 5

    %% Layer 1
    subgraph Layer1 [Layer 1 — Data Collection Pipeline Python Worker]
        direction TB
        A1[Scheduler / Cron Job]:::worker --> A2[Python Scraper - Playwright]:::worker
        A2 --> A3[Auction Metadata + PDF Downloader]:::worker
        A3 --> A4[(Supabase Storage - Original PDFs)]:::storage
        A4 --> A5[PDF Parser - pdfplumber / PyMuPDF]:::worker
        A5 --> A6[Metadata Extractor & AI Classifier]:::worker
        A6 --> A7[(Supabase PostgreSQL Search Index)]:::storage
    end

    %% Layer 2
    subgraph Layer2 [Layer 2 — MSTC-Assist Discovery Platform React + TypeScript]
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
            U2(Saved Searches):::module
            U3(Notifications & Alerts):::module
            U4(User Profile):::module
            U5(Search History):::module
        end
        
        subgraph AssistMod [C. Assistance Features]
            direction TB
            AS1(PDF Preview):::module
            AS2(Favourite Items):::module
            AS3(Recently Added Auctions):::module
            AS4(Recommended Auctions):::module
            AS5(Compare Items):::module
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

## Architecture Layer Breakdown

### Layer 1: Data Collection Pipeline (Backend Worker)
This is a completely isolated, headless Python environment. It acts as the engine of the platform. Its sole responsibility is to operate on a background cron schedule, scrape new listings from the official MSTC site, download their dense PDF catalogues, and use programmatic parsing tools (`pdfplumber`) to extract structured data (brands, models, quantities, reserve prices). The extracted data is stored cleanly inside a PostgreSQL Search Index (Supabase), completely divorcing the raw PDF from the end-user.

### Layer 2: MSTC-Assist Discovery Platform (React + TypeScript)
This is the user-facing Single Page Application (SPA). **It does not scrape data and it does not parse PDFs.** It simply connects to the Supabase Search Index API to display the pre-processed data instantly. This layer focuses entirely on User Experience (UX)—providing lightning-fast global searches, highly specific smart filters, saved alerts, and AI-generated text summaries that prevent users from having to read long, unformatted PDFs.

### Layer 3: Official MSTC Handoff
This layer represents the hard boundary of our application. We are an assistant, not a broker. Once the user utilizes our platform to successfully discover and research an auction lot they are interested in, they click a Call-to-Action button on our `Item Detail Page`. This safely redirects them directly to that item's page on the official MSTC portal, where they must log in to submit Earnest Money Deposits (EMD) and place live bids.
