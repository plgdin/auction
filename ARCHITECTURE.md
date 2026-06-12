# MSTC-Assist Project Vision & Architecture

## Project Overview

This project is **NOT** a clone or replacement of the official MSTC eCommerce platform. The goal is **not to host auctions or conduct bidding independently**. Instead, this project is an **AI-powered auction discovery and assistance platform** that helps users quickly find relevant auction items listed on the official MSTC website.

The current MSTC workflow requires users to:

* Navigate through multiple pages.
* Apply several filters.
* Open numerous auction listings.
* Download large PDF catalogues.
* Manually search through those PDFs to determine whether the desired items are available.

Our platform simplifies this process by creating a searchable index of auction catalogue information and presenting it through a modern, user-friendly interface.

The user should ideally be able to:

1. Open our website.
2. Search for an item (for example: "Hyundai i10 Kerala", "Generator 15kVA", "Office furniture", etc.).
3. Instantly view matching auction lots and metadata.
4. Click a button to open the corresponding official MSTC auction page.
5. Complete registration, bidding, payment, and all legal transactions directly on the official MSTC portal.

Our website acts only as an **auction assistant and search engine**.

---

## Core Philosophy

The project should always follow these principles:

* Never scrape or copy proprietary backend logic from MSTC.
* Never impersonate or replace the official MSTC platform.
* Never conduct auctions or collect bids independently.
* Never process official payments or replace the official bidding workflow.
* Always redirect users to the official MSTC listing for actual participation.

The platform's purpose is to **reduce friction and improve discoverability**.

---

## System Architecture

The platform consists of four major layers:

### 1. Data Collection Layer

A dedicated Python worker periodically checks the MSTC website for new or updated auction listings.

Responsibilities:

* Visit configured MSTC pages.
* Detect newly published auctions.
* Extract auction metadata.
* Download associated PDF catalogue files.
* Store basic information in a staging database.

This process should be scheduled automatically using cron jobs or background workers.

---

### 2. PDF Processing Layer

Downloaded PDF catalogues are processed automatically.

Pipeline:

1. Download PDF.
2. Store original PDF in Supabase Storage.
3. Extract text using PDF parsing libraries.
4. Parse structured information from the extracted text.
5. Normalize the data into searchable fields.
6. Save processed results into PostgreSQL (Supabase).

Preferred technologies:

* Python
* Playwright (for crawling)
* pdfplumber / PyMuPDF
* Camelot (for table extraction)
* OCR only when necessary.

---

### 3. Search & Indexing Layer

The parsed data is transformed into a structured database optimized for searching.

Instead of storing only raw PDF text, the system should identify and normalize fields such as:

* Auction ID
* Lot Number
* Category
* Item Name
* Brand
* Model
* Description
* Quantity
* Reserve Price
* Inspection Date
* Location
* Auction Closing Date
* Official MSTC URL
* PDF URL
* Search Keywords

The frontend should never need to parse PDFs directly; it should query this indexed database.

---

### 4. User Experience Layer

The React frontend provides a simplified interface over the indexed data.

Main features:

* Global search.
* Advanced filtering.
* Category browsing.
* Smart recommendations.
* Saved searches.
* Notifications for newly listed matching items.
* AI-generated summaries of auction catalogues.
* Direct links to official MSTC listings.

The frontend should always display a clear "View Official MSTC Listing" or "Open on MSTC" action.

---

## Technology Stack

Frontend:

* React 19
* TypeScript
* Vite
* Tailwind CSS
* React Router
* Zustand
* TanStack Query
* Framer Motion

Backend Services:

* Supabase PostgreSQL
* Supabase Authentication
* Supabase Storage
* Supabase Realtime (where useful)

Background Worker:

* Python
* Playwright
* pdfplumber
* PyMuPDF
* BeautifulSoup
* APScheduler or cron jobs

Hosting:

* Vercel for the frontend.
* Supabase for the database and storage.
* A dedicated Python worker hosted on Railway, Render, or a VPS for scraping and PDF processing.

---

## Data Pipeline

The complete automated workflow should follow this sequence:

MSTC Website
→ Background Scraper
→ Detect New Auction
→ Download PDF
→ Upload PDF to Supabase Storage
→ Parse PDF Contents
→ Extract Structured Metadata
→ Save Structured Records into Supabase Database
→ Build Search Index
→ Display Results in React Frontend
→ User Clicks "Open Official MSTC Listing"
→ User Completes Auction Process on MSTC

---

## Database Design Philosophy

The database should support the following logical entities:

* auction_sources
* pdf_files
* extracted_items
* raw_pdf_text
* saved_searches
* user_notifications
* parsing_jobs
* crawler_jobs

A single auction PDF may contain multiple individual auction lots. Therefore, the system should treat each extracted lot as an independent searchable record linked back to the original MSTC auction.

---

## Background Job Strategy

The scraper and parser should run independently from the frontend.

Recommended schedule:

* Check for new auctions every 30 minutes.
* Download new PDFs immediately.
* Parse queued PDFs every 5 minutes.
* Refresh active auction information every 2 hours.
* Archive expired auctions once per day.

The React frontend should never perform scraping or parsing directly.

---

## Development Guidelines

Whenever implementing new features:

* Preserve the existing architecture.
* Build modular and reusable components.
* Separate frontend, parser, and crawler responsibilities.
* Abstract all database access into service layers.
* Never hardcode MSTC-specific data.
* Build every feature assuming the indexed database is the source of truth.

Before generating code, always ask:
"Does this feature help users discover and navigate MSTC auctions more efficiently?"

If the answer is yes, it belongs in this project.

---

## Long-Term Vision

The long-term objective is to build the best auction discovery assistant for MSTC users.

Potential future features:

* AI-powered natural language search.
* Saved search alerts.
* Email and push notifications for matching items.
* AI summaries of auction catalogues.
* Personalized recommendations.
* Cross-auction comparison tools.
* Unified dashboard for tracking interesting auctions.
* Mobile-friendly experience with one-click redirection to official MSTC pages.

The platform should always function as a **smart assistant and indexing layer** that enhances the user experience while leaving the official auction process entirely within the MSTC ecosystem.
