-- SQL Seed script for Lelam eAuctions & Platform FAQs
-- Run this in your Supabase SQL Editor to populate the faq_items table.

-- Clear existing faqs if you want a clean state:
-- TRUNCATE TABLE faq_items;

INSERT INTO faq_items (question, answer, category, display_order, is_active) VALUES
('Is Lelam affiliated with MSTC India or any government agency?', 
 'No, Lelam is a completely independent, third-party platform. We are not officially affiliated, authorized, or endorsed by MSTC India, the Indian Government, or any public sector undertaking. We only provide analytical value-added services for public eAuctions data.', 
 'mstc', 1, true),

-- MSTC eAuctions Help
('How does bidding work in MSTC eAuctions, and how does Lelam assist in the process?', 
 'Bidding in MSTC eAuctions is conducted on the official MSTC e-commerce portal during the scheduled auction time. Lelam is an independent, third-party assistive platform that helps buyers analyze MSTC catalogs, estimate market values, calculate projected transportation and unloading costs, and assess potential ROI. Bidders must register and place actual bids on the official MSTC platform.', 
 'mstc', 2, true),

('Why are photos sometimes missing or different from the actual scrap items on MSTC eAuctions, and how can Lelam help?', 
 'MSTC eAuctions feature scrap and surplus materials which are stored in open environments and subject to deterioration. Because of this, MSTC rarely uploads high-quality photos to prevent misleading interpretations, advising buyers to inspect materials in person. Lelam assists by aggregating available catalog details, providing documents, and helping you analyze lot specifications to make better-informed inspection and bidding decisions.', 
 'mstc', 3, true),

('How is the Pre-Bid EMD (Earnest Money Deposit) handled and refunded for MSTC eAuctions?', 
 'Pre-Bid EMD is managed directly by MSTC and the respective sellers. For unsuccessful bids, the EMD is typically refunded back to the buyer''s ledger on the MSTC portal. Please note that Lelam has no access to your financial transactions or EMD payments; all payments, challans, and refunds must be managed directly through the official MSTC portal.', 
 'mstc', 4, true),

('What should I do if my Pre-Bid EMD is not credited in my MSTC ledger for an eAuction?', 
 'EMD credit delays on MSTC usually happen if multiple transactions are sent using a single NEFT/RTGS challan, or if the deposit is made more than 3 days after challan generation. You should double-check your transaction references and contact the respective MSTC branch officer. As Lelam is an independent utility, we do not handle or process any payments or deposits.', 
 'mstc', 5, true),

('Why do MSTC eAuctions often run late into the night or go into extensions?', 
 'MSTC eAuctions automatically enter extensions if active bidding continues near the closing time. This system ensures fair competition for the lot. Lelam helps you prepare for these long sessions by providing real-time valuation metrics and an interactive bid-and-cost calculator so you can calculate your break-even bid threshold in advance.', 
 'mstc', 6, true),

('How do I submit my Pollution Control Board (PCB) documents for e-waste or hazardous scrap eAuctions?', 
 'For e-waste and restricted scrap categories, buyers must submit their Consent to Operate and PCB passbooks to the concerned MSTC dealing officer listed in the eAuction catalogue. Lelam provides a consolidated view of these key contacts and eligibility criteria extracted from the official eAuction PDF to simplify your preparation.', 
 'mstc', 7, true),

-- Lelam Platform Help
('What is Lelam and how does it work for eAuctions?', 
 'Lelam is an advanced assistant and intelligence platform for industrial and government eAuctions. Our system automatically scrapes, normalizes, and indexes public catalogs from portals like MSTC. We then apply statistical models and NLP search capabilities to help you search, analyze, and estimate the value of scrap, vehicles, and raw materials.', 
 'lelam', 8, true),

('How do I search for specific materials or locations of eAuctions on Lelam?', 
 'You can use our hybrid search bar on the homepage. Our NLP-powered eAuctions search understands typos, synonyms (like "mild steel" for "MS scrap"), and locations (like "in Kerala" or "near Mumbai"). You can search for active eAuctions by material type, auction number, seller, or state.', 
 'lelam', 9, true),

('How does the Live Bid & Cost Calculator work for eAuctions?', 
 'When viewing an eAuction listing on Lelam, you can use our dynamic calculator to build custom quotes. You can input your bid price per metric ton, and the system automatically calculates extra charges such as GST, TCS, Customs duties, loading fees, and transport costs to give you an accurate landed cost and ROI estimate.', 
 'lelam', 10, true),

('Why is valuation or market pricing not available for some eAuction catalogs?', 
 'Valuation predictions for eAuctions require sufficient historical data and stable market price indices (like LME or local scrap rates). For highly custom, mixed, or rare eAuction lots (such as mixed plant machinery, unsorted office waste, or unique property lots), our linear regression models do not have standardized pricing parameters. In these cases, we disable the automated valuation panel to prevent inaccurate projections.', 
 'lelam', 11, true),

('Can I place bids directly on eAuctions through the Lelam website?', 
 'No, Lelam is an assistive analytical tool and does not host the eAuctions bidding environment. To place bids, you must log in to the official MSTC e-commerce platform and use their bidding interface.', 
 'lelam', 12, true),

('How does the Scrap Metal Price regression model for eAuctions work?', 
 'Our system runs a trend-prediction model for eAuctions utilizing historical market prices from Indian scrap hubs and global metal exchanges (like LME). It maps these benchmarks to the specific eAuction catalog specifications (material type, grade, and location) to predict a fair market price range.', 
 'lelam', 13, true),

('What is the "Interested" or bookmarking feature for eAuctions?', 
 'If you find an eAuction catalog or listing that you want to keep track of, you can click the Heart icon on the card. This saves the listing to your watchlist so you can easily access it later and receive updates when the opening date approaches.', 
 'lelam', 14, true),

('How do I access the PDF catalogs and official documents for eAuctions on Lelam?', 
 'We index and host official eAuction catalogs and terms sheets in our secure Supabase storage. When viewing an eAuction details page, you can open or download the original PDF document to read the complete official terms.', 
 'lelam', 15, true),

('How often is the eAuctions catalog data on Lelam updated?', 
 'Our scraping system runs multiple times a day to search for new eAuction catalog releases and update active schedules. Any new eAuctions published on MSTC are processed and made searchable on Lelam within a few hours.', 
 'lelam', 16, true),

('Do I need to pay to use Lelam\'s analytical tools for eAuctions?', 
 'Lelam offers free access to eAuction catalog searches, basic details, and standard calculators. Advanced analytics, trend histories, and automated price prediction models for eAuctions are available to registered business users.', 
 'lelam', 17, true);
