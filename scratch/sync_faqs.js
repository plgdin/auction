import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_FAQ_ITEMS = [
  {
    question: 'Is Lelam affiliated with MSTC India or any government agency?',
    answer: 'No, Lelam is a completely independent, third-party platform. We are not officially affiliated, authorized, or endorsed by MSTC India, the Indian Government, or any public sector undertaking. We only provide analytical value-added services for public eAuctions data.',
    category: 'mstc',
    display_order: 1,
    is_active: true
  },
  {
    question: 'How does bidding work in MSTC eAuctions, and how does Lelam assist in the process?',
    answer: 'Bidding in MSTC eAuctions is conducted on the official MSTC e-commerce portal during the scheduled auction time. Lelam is an independent, third-party assistive platform that helps buyers analyze MSTC catalogs, estimate market values, calculate projected transportation and unloading costs, and assess potential ROI. Bidders must register and place actual bids on the official MSTC platform.',
    category: 'mstc',
    display_order: 2,
    is_active: true
  },
  {
    question: 'Why are photos sometimes missing or different from the actual scrap items on MSTC eAuctions, and how can Lelam help?',
    answer: 'MSTC eAuctions feature scrap and surplus materials which are stored in open environments and subject to deterioration. Because of this, MSTC rarely uploads high-quality photos to prevent misleading interpretations, advising buyers to inspect materials in person. Lelam assists by aggregating available catalog details, providing documents, and helping you analyze lot specifications to make better-informed inspection and bidding decisions.',
    category: 'mstc',
    display_order: 3,
    is_active: true
  },
  {
    question: 'How is the Pre-Bid EMD (Earnest Money Deposit) handled and refunded for MSTC eAuctions?',
    answer: "Pre-Bid EMD is managed directly by MSTC and the respective sellers. For unsuccessful bids, the EMD is typically refunded back to the buyer's ledger on the MSTC portal. Please note that Lelam has no access to your financial transactions or EMD payments; all payments, challans, and refunds must be managed directly through the official MSTC portal.",
    category: 'mstc',
    display_order: 4,
    is_active: true
  },
  {
    question: 'What should I do if my Pre-Bid EMD is not credited in my MSTC ledger for an eAuction?',
    answer: 'EMD credit delays on MSTC usually happen if multiple transactions are sent using a single NEFT/RTGS challan, or if the deposit is made more than 3 days after challan generation. You should double-check your transaction references and contact the respective MSTC branch officer. As Lelam is an independent utility, we do not handle or process any payments or deposits.',
    category: 'mstc',
    display_order: 5,
    is_active: true
  },
  {
    question: 'Why do MSTC eAuctions often run late into the night or go into extensions?',
    answer: 'MSTC eAuctions automatically enter extensions if active bidding continues near the closing time. This system ensures fair competition for the lot. Lelam helps you prepare for these long sessions by providing real-time valuation metrics and an interactive bid-and-cost calculator so you can calculate your break-even bid threshold in advance.',
    category: 'mstc',
    display_order: 6,
    is_active: true
  },
  {
    question: 'How do I submit my Pollution Control Board (PCB) documents for e-waste or hazardous scrap eAuctions?',
    answer: 'For e-waste and restricted scrap categories, buyers must submit their Consent to Operate and PCB passbooks to the concerned MSTC dealing officer listed in the eAuction catalogue. Lelam provides a consolidated view of these key contacts and eligibility criteria extracted from the official eAuction PDF to simplify your preparation.',
    category: 'mstc',
    display_order: 7,
    is_active: true
  },
  {
    question: 'What is Lelam and how does it work for eAuctions?',
    answer: 'Lelam is an advanced assistant and intelligence platform for industrial and government eAuctions. Our system automatically scrapes, normalizes, and indexes public catalogs from portals like MSTC. We then apply statistical models and NLP search capabilities to help you search, analyze, and estimate the value of scrap, vehicles, and raw materials.',
    category: 'lelam',
    display_order: 8,
    is_active: true
  },
  {
    question: 'How do I search for specific materials or locations of eAuctions on Lelam?',
    answer: 'You can use our hybrid search bar on the homepage. Our NLP-powered eAuctions search understands typos, synonyms (like "mild steel" for "MS scrap"), and locations (like "in Kerala" or "near Mumbai"). You can search for active eAuctions by material type, auction number, seller, or state.',
    category: 'lelam',
    display_order: 9,
    is_active: true
  },
  {
    question: 'How does the Live Bid & Cost Calculator work for eAuctions?',
    answer: 'When viewing an eAuction listing on Lelam, you can use our dynamic calculator to build custom quotes. You can input your bid price per metric ton, and the system automatically calculates extra charges such as GST, TCS, Customs duties, loading fees, and transport costs to give you an accurate landed cost and ROI estimate.',
    category: 'lelam',
    display_order: 10,
    is_active: true
  },
  {
    question: 'Why is valuation or market pricing not available for some eAuction catalogs?',
    answer: 'Valuation predictions for eAuctions require sufficient historical data and stable market price indices (like LME or local scrap rates). For highly custom, mixed, or rare eAuction lots (such as mixed plant machinery, unsorted office waste, or unique property lots), our linear regression models do not have standardized pricing parameters. In these cases, we disable the automated valuation panel to prevent inaccurate projections.',
    category: 'lelam',
    display_order: 11,
    is_active: true
  },
  {
    question: 'Can I place bids directly on eAuctions through the Lelam website?',
    answer: 'No, Lelam is an assistive analytical tool and does not host the eAuctions bidding environment. To place bids, you must log in to the official MSTC e-commerce platform and use their bidding interface.',
    category: 'lelam',
    display_order: 12,
    is_active: true
  },
  {
    question: 'How does the Scrap Metal Price regression model for eAuctions work?',
    answer: 'Our system runs a trend-prediction model for eAuctions utilizing historical market prices from Indian scrap hubs and global metal exchanges (like LME). It maps these benchmarks to the specific eAuction catalog specifications (material type, grade, and location) to predict a fair market price range.',
    category: 'lelam',
    display_order: 13,
    is_active: true
  },
  {
    question: 'What is the "Interested" or bookmarking feature for eAuctions?',
    answer: 'If you find an eAuction catalog or listing that you want to keep track of, you can click the Heart icon on the card. This saves the listing to your watchlist so you can easily access it later and receive updates when the opening date approaches.',
    category: 'lelam',
    display_order: 14,
    is_active: true
  },
  {
    question: 'How do I access the PDF catalogs and official documents for eAuctions on Lelam?',
    answer: 'We index and host official eAuction catalogs and terms sheets in our secure Supabase storage. When viewing an eAuction details page, you can open or download the original PDF document to read the complete official terms.',
    category: 'lelam',
    display_order: 15,
    is_active: true
  },
  {
    question: 'How often is the eAuctions catalog data on Lelam updated?',
    answer: 'Our scraping system runs multiple times a day to search for new eAuction catalog releases and update active schedules. Any new eAuctions published on MSTC are processed and made searchable on Lelam within a few hours.',
    category: 'lelam',
    display_order: 16,
    is_active: true
  },
  {
    question: 'Do I need to pay to use Lelam\'s analytical tools for eAuctions?',
    answer: 'Lelam offers free access to eAuction catalog searches, basic details, and standard calculators. Advanced analytics, trend histories, and automated price prediction models for eAuctions are available to registered business users.',
    category: 'lelam',
    display_order: 17,
    is_active: true
  }
];

async function sync() {
  console.log('Truncating faq_items table...');
  const { error: deleteError } = await supabase
    .from('faq_items')
    .delete()
    .neq('question', 'FORCE_DELETION_TRICK'); // deletes all rows

  if (deleteError) {
    console.error('Error truncating:', deleteError);
    return;
  }

  console.log('Inserting synchronized FAQ items...');
  const { error: insertError } = await supabase
    .from('faq_items')
    .insert(DEFAULT_FAQ_ITEMS);

  if (insertError) {
    console.error('Error inserting:', insertError);
  } else {
    console.log('Successfully synchronized FAQ items in database!');
  }
}

sync();
