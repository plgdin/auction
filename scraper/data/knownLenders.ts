/**
 * Curated list of lenders that post auctions on BaankNet.
 *
 * The old regex-only approach (`/(?:Bank\s*(?:Name)?)\s*:?\s*([A-Za-z\s]+(?:Bank|of\s+\w+))/i`)
 * only matches names containing the literal word "Bank", so every NBFC, ARC,
 * and housing finance company auction fell through to "Unknown Bank".
 *
 * This list is NOT exhaustive — it's seeded from lenders known to post on
 * BaankNet as of this writing. Treat it as a living list: whenever
 * `matchKnownLender` falls back to the regex path and the regex also fails,
 * log the raw text (see `logUnmatchedLender` below) and add the real name
 * here once you spot it in the logs. This is meant to convert from "guess
 * forever" to "learn once, match forever."
 */

// Longest names first so substring matching doesn't stop at a shorter
// prefix that happens to also be a valid lender name.
export const KNOWN_LENDERS: string[] = [
  // Public sector banks
  "State Bank of India",
  "Punjab National Bank",
  "Bank of Baroda",
  "Bank of India",
  "Bank of Maharashtra",
  "Canara Bank",
  "Union Bank of India",
  "Indian Bank",
  "Indian Overseas Bank",
  "UCO Bank",
  "Central Bank of India",
  "Punjab & Sind Bank",

  // Private sector banks
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "IndusInd Bank",
  "Yes Bank",
  "IDFC First Bank",
  "IDBI Bank",
  "Federal Bank",
  "South Indian Bank",
  "Karur Vysya Bank",
  "City Union Bank",
  "Karnataka Bank",
  "RBL Bank",
  "DCB Bank",
  "Bandhan Bank",
  "CSB Bank",
  "Tamilnad Mercantile Bank",
  "Dhanlaxmi Bank",
  "Jammu and Kashmir Bank",

  // Small finance banks
  "AU Small Finance Bank",
  "Equitas Small Finance Bank",
  "Ujjivan Small Finance Bank",
  "ESAF Small Finance Bank",
  "Suryoday Small Finance Bank",
  "Jana Small Finance Bank",
  "Utkarsh Small Finance Bank",
  "Fincare Small Finance Bank",
  "North East Small Finance Bank",
  "Shivalik Small Finance Bank",
  "Unity Small Finance Bank",

  // NBFCs / Housing finance companies (no "Bank" in name — the old regex
  // structurally could not match any of these)
  "Muthoot Finance",
  "Muthoot Fincorp",
  "Manappuram Finance",
  "Bajaj Finance",
  "Bajaj Housing Finance",
  "L&T Finance",
  "Tata Capital",
  "Mahindra Finance",
  "Mahindra Rural Housing Finance",
  "Shriram Finance",
  "Shriram Housing Finance",
  "Cholamandalam Investment and Finance",
  "Sundaram Finance",
  "PNB Housing Finance",
  "LIC Housing Finance",
  "Indiabulls Housing Finance",
  "Aditya Birla Finance",
  "Aditya Birla Housing Finance",
  "Piramal Capital",
  "Piramal Housing Finance",
  "Aavas Financiers",
  "Aptus Value Housing Finance",
  "Home First Finance",
  "Repco Home Finance",
  "Can Fin Homes",
  "GIC Housing Finance",
  "India Shelter Finance",
  "Poonawalla Fincorp",
  "Hero FinCorp",
  "IIFL Finance",
  "IIFL Home Finance",
  "IIFL Samasta Finance",
  "Fedbank Financial Services",
  "Motilal Oswal Home Finance",
  "TVS Credit Services",

  // Asset Reconstruction Companies (ARCs) — separate legal category from
  // banks/NBFCs, but they list SARFAESI auctions on BaankNet the same way
  "Edelweiss Asset Reconstruction Company",
  "Edelweiss ARC",
  "Asset Reconstruction Company (India)",
  "ARCIL",
  "JM Financial Asset Reconstruction Company",
  "Phoenix ARC",
  "Kotak Mahindra Asset Reconstruction Company",
  "UV Asset Reconstruction Company",
  "Reliance Asset Reconstruction Company",
  "Alchemist Asset Reconstruction Company",
  "Omkara Asset Reconstruction",

  // Regional Rural Banks (RRBs) and cooperative banks post occasionally —
  // add specific names here as you see them in scrape logs.
].sort((a, b) => b.length - a.length);

/**
 * Match a known lender name inside a block of card/page text.
 * Returns "" if nothing matched — caller decides the fallback
 * (old regex, or "Unknown Bank").
 */
export function matchKnownLender(text: string): string {
  if (!text) return "";
  for (const lender of KNOWN_LENDERS) {
    // Word-boundary-ish match, case-insensitive, tolerant of the lender
    // name appearing mid-sentence in the card's innerText.
    const escaped = lender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(text)) return lender;
  }
  return "";
}

/**
 * Log a card whose bank name couldn't be resolved by either the known-lender
 * list or the legacy regex, so these can be triaged and added to the list
 * above instead of silently becoming "Unknown Bank" forever.
 */
export function logUnmatchedLenderSample(text: string): string {
  // Return a short, log-friendly excerpt — not the full card text.
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}
