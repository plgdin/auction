# Auction Platform - Detailed Sitemap

## 1. Public Zone (Home & Discovery)
**Target Audience**: Unauthenticated Users, Guests, Potential Bidders

* **1.1 Home Page (`/`)**
  * Hero Banner & Call to Action
  * Featured Live Auctions & Featured Tenders
  * Service Categories
  * Announcements & Platform Statistics
  * How It Works Workflow
* **1.2 Auction Directory (`/auctions`)**
  * Search & Filtering Engine (By Category, Price, Status)
  * Live & Upcoming Auction Data Grid
* **1.3 Tender Directory (`/tenders`)**
  * Open Tenders List with Status Indicators (Open, Closed, Evaluation)
* **1.4 Auction/Tender Detail Page (`/auctions/:id` or `/tenders/:id`)**
  * Item Metadata, Asset Descriptions, and Terms
  * Image Gallery & Interactive Document Previews
  * Live Countdown & Current Bid (Read-only for guests)
* **1.5 Information & Legal**
  * **About Us (`/about`)**: Platform Mission, Vision, and Leadership.
  * **Contact (`/contact`)**: Helpdesk Routing, Enquiry Form, Office Locations.
  * **FAQ (`/faq`)**: Knowledge base for Buyers and Sellers.
  * **System Notices (`/notices`)**: Terms & Conditions, Legal Policies, Disclaimers.
  * **News (`/news`)**: Press Releases and Industry Updates.

---

## 2. Authentication Zone
**Target Audience**: Users requiring secure system access

* **2.1 Login (`/auth/login`)**
  * Email & Password Authentication
* **2.2 Registration (`/auth/register`)**
  * Account Creation (Buyer / Seller role selection)
  * KYC / Organization Details Input
* **2.3 Password Recovery (`/auth/forgot-password`)**
  * Email Verification & OTP Request
* **2.4 Password Reset (`/auth/reset-password`)**
  * Secure Token Entry & New Password Configuration

---

## 3. Buyer Dashboard
**Target Audience**: Standard Authenticated Users / Bidders

* **3.1 Overview (`/dashboard`)**
  * High-level Statistics (Active Bids, Wallet Balance, Won Auctions)
  * Quick Links to crucial actions
* **3.2 Auction Activity**
  * **My Bids (`/dashboard/bids`)**: Complete history of all placed bids, tracking win/loss/outbid status.
  * **Watchlist (`/dashboard/watchlist`)**: Saved upcoming auctions for quick access.
* **3.3 Procurement & Assets**
  * **Wallet & EMD (`/dashboard/wallet`)**: Virtual balance, Earnest Money Deposits, Transaction Ledger, and Payment/Receipt generation.
  * **My Tenders (`/dashboard/tenders`)**: Status tracking of submitted sealed bids.
  * **Document Vault (`/dashboard/documents`)**: Centralized, searchable file manager for all uploaded PDFs, images, and KYC documents.
* **3.4 Account Management**
  * **Notifications (`/dashboard/notifications`)**: Inbox for system alerts, outbid warnings, and win confirmations.
  * **Profile Settings (`/dashboard/profile`)**: Personal details, organization info, and communication preferences (Email vs. Push).

---

## 4. Seller Portal
**Target Audience**: Approved Organizations with elevated 'Seller' Roles

* **4.1 Seller Analytics (`/seller`)**
  * Revenue Tracking and Bid Volume Metrics
  * Active Auction Performance summaries
* **4.2 Manage Auctions (`/seller/auctions`)**
  * Data grid of all seller-created auctions (Draft, Upcoming, Active, Closed).
* **4.3 Create/Edit Auction (`/seller/auctions/create`)**
  * Multi-step form for Auction Metadata (Title, Location, Category).
  * Reserve Price and Date/Time Configuration.
  * Drag-and-drop Image & Document Uploaders.

---

## 5. Admin Control Panel
**Target Audience**: Platform Super Admins and Operators

* **5.1 User Management (`/admin` - Users Tab)**
  * Approve pending seller/organization accounts.
  * View all user profiles and KYC data.
  * Suspend / Ban malicious or non-compliant accounts.
* **5.2 Reports & Analytics (`/admin` - Reports Tab)**
  * Platform-wide Revenue and Bid Volume Charts.
  * Category Performance Tracking.
  * CSV / PDF Export placeholders for financial reporting.
* **5.3 System Management (`/admin` - System Tab)**
  * **Global Announcements**: Publish persistent red-banner alerts to all active users simultaneously.
  * **Direct Alerting**: Send targeted push notifications/messages to a specific user's inbox.
