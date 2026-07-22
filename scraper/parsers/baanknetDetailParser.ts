/**
 * BaankNet Detail Page Parser
 *
 * Extracts rich property data from individual BaankNet auction detail pages
 * and Property Listing cards. Handles:
 * - Photo gallery URLs
 * - Borrower / guarantor names
 * - Property descriptions
 * - EMD amounts and dates
 * - Document download links
 * - Property physical attributes (area, furnishing, possession)
 */
import { logger } from "../utils/logger.js";

const log = logger.child({ module: "baanknetDetailParser" });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DetailPageData {
  photoUrls: string[];
  thumbnailUrl: string;
  borrowerName: string;
  description: string;
  documentUrl: string;
  carpetArea: string;
  furnishing: string;
  possessionStatus: string;
  actionType: string;
  district: string;
  inspectionStartDate: string;
  inspectionEndDate: string;
  emdEndDate: string;
}

// ─── DOM Extraction Functions (run inside Puppeteer page context) ────────────

/**
 * Extracts detail data from an eAuction detail page.
 * Runs inside the browser via page.evaluate().
 *
 * BaankNet eAuction detail pages use Angular Material components.
 * The URL pattern is: /eauction-psb/xcommon/view-auction-notice/{id}
 */
export function extractEAuctionDetail(): DetailPageData {
  const bodyText = document.body?.innerText || "";

  // Photos: look for image elements in gallery/carousel sections
  const photoUrls: string[] = [];
  const images = document.querySelectorAll(
    "img[src*='property'], img[src*='photo'], img[src*='image'], " +
    "img[src*='upload'], img[src*='asset'], " +
    ".carousel img, .gallery img, .photo-gallery img, " +
    "[class*='gallery'] img, [class*='carousel'] img, [class*='photo'] img"
  );
  images.forEach((img) => {
    const src = (img as HTMLImageElement).src || img.getAttribute("data-src") || "";
    if (src && !src.includes("favicon") && !src.includes("logo") && !src.includes("icon")) {
      photoUrls.push(src);
    }
  });

  // Borrower / Guarantor name
  let borrowerName = "";
  const borrowerMatch = bodyText.match(
    /(?:Borrower|Guarantor|Defaulter)\s*(?:Name)?\s*:?\s*([^\n]{3,80})/i
  );
  if (borrowerMatch) {
    borrowerName = borrowerMatch[1].trim();
  }

  // Property description
  let description = "";
  const descMatch = bodyText.match(
    /(?:Property\s*Description|Description\s*of\s*Property|Asset\s*Description)\s*:?\s*([\s\S]{10,500}?)(?=\n\s*\n|\n\s*(?:Reserve|Bank|Auction|EMD|Contact|Inspection))/i
  );
  if (descMatch) {
    description = descMatch[1].trim();
  }

  // Document download link
  let documentUrl = "";
  const docLink = document.querySelector(
    'a[href*="file-download"], a[href*="download"], a[href*="notice"], ' +
    'a[href*="document"], a[href*=".pdf"]'
  ) as HTMLAnchorElement | null;
  if (docLink) {
    documentUrl = docLink.href || docLink.getAttribute("href") || "";
  }

  // Carpet area
  let carpetArea = "";
  const areaMatch = bodyText.match(
    /(?:Carpet|Built[\s-]*Up|Super\s*Built[\s-]*Up|Plot|Land)\s*Area\s*:?\s*([\d,.]+\s*(?:sq\.?\s*(?:feet|ft|meter|metre|mtr)|sqft|sqm))/i
  );
  if (areaMatch) {
    carpetArea = areaMatch[1].trim();
  }

  // Furnishing
  let furnishing = "";
  const furnMatch = bodyText.match(/Furnish(?:ing|ed)?\s*(?:Status)?\s*:?\s*(Furnished|Unfurnished|Semi[\s-]*Furnished)/i);
  if (furnMatch) {
    furnishing = furnMatch[1].trim();
  }

  // Possession status
  let possessionStatus = "";
  const possMatch = bodyText.match(/Possession\s*(?:Status)?\s*:?\s*(Physical|Symbolic|Not\s*(?:Available|Taken))/i);
  if (possMatch) {
    possessionStatus = possMatch[1].trim();
  }

  // Type of action (SARFAESI / IBC / DRT)
  let actionType = "";
  const actionMatch = bodyText.match(/(?:Type\s*of\s*Action|Action\s*Type|Under)\s*:?\s*((?:Under\s*)?SARFAESI|IBC|DRT|NCLT)/i);
  if (actionMatch) {
    actionType = actionMatch[1].replace(/^Under\s*/i, "").trim().toUpperCase();
  }

  // District
  let district = "";
  const districtMatch = bodyText.match(/District\s*:?\s*([A-Za-z\s]{2,40})/i);
  if (districtMatch) {
    district = districtMatch[1].trim();
  }

  // Inspection dates
  let inspectionStartDate = "";
  let inspectionEndDate = "";
  const inspStartMatch = bodyText.match(
    /Inspection\s*Start\s*(?:Date\s*(?:&\s*Time)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
  );
  const inspEndMatch = bodyText.match(
    /Inspection\s*End\s*(?:Date\s*(?:&?\s*[Tt]ime)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
  );
  if (inspStartMatch) inspectionStartDate = inspStartMatch[1].trim();
  if (inspEndMatch) inspectionEndDate = inspEndMatch[1].trim();

  // EMD end date
  let emdEndDate = "";
  const emdMatch = bodyText.match(
    /EMD\s*(?:End|Last|Due|Deadline)?\s*(?:Date\s*(?:&\s*Time)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
  );
  if (emdMatch) {
    emdEndDate = emdMatch[1].trim();
  }

  return {
    photoUrls,
    thumbnailUrl: photoUrls[0] || "",
    borrowerName,
    description,
    documentUrl,
    carpetArea,
    furnishing,
    possessionStatus,
    actionType,
    district,
    inspectionStartDate,
    inspectionEndDate,
    emdEndDate,
  };
}

/**
 * Extracts listing card data from BaankNet Property Listing page.
 * Each card in the Property module has a different DOM structure
 * than eAuction cards: photos, area, furnishing, possession, etc.
 *
 * Runs inside the browser via page.evaluate().
 */
export function extractPropertyListingCards(): {
  auctionId: string;
  bankPropertyId: string;
  title: string;
  reservePrice: string;
  bankName: string;
  location: string;
  address: string;
  startDate: string;
  endDate: string;
  detailUrl: string;
  carpetArea: string;
  furnishing: string;
  possessionStatus: string;
  actionType: string;
  district: string;
  state: string;
  city: string;
  inspectionStartDate: string;
  inspectionEndDate: string;
  emdEndDate: string;
  thumbnailUrl: string;
  photoUrls: string[];
  status: string;
}[] {
  const items: ReturnType<typeof extractPropertyListingCards> = [];

  // Property listing cards have a distinct card layout with images, area, etc.
  const cards = document.querySelectorAll(
    ".card, [class*='property-card'], [class*='listing-card'], " +
    "[class*='property-list'], [class*='result-card']"
  );

  // If no cards found with class selectors, try broader approach
  const effectiveCards = cards.length > 0
    ? cards
    : document.querySelectorAll("[class*='col-'] > div, .row > div > div");

  effectiveCards.forEach((card) => {
    const text = (card as HTMLElement).innerText || "";
    // Property listing cards always have Property ID
    if (!text.includes("Property ID") && !text.includes("Auction")) return;
    // Skip navigation, header, footer elements
    if (text.length < 50 || text.length > 5000) return;

    // Title: first substantial heading
    const titleEl = card.querySelector("h3, h4, h5, [class*='title']") as HTMLElement;
    const title = titleEl?.innerText?.trim() || "";
    if (!title) return;

    // Property ID
    const propIdMatch = text.match(/Property\s*ID\s*:?\s*(\S+)/i);
    const bankPropertyId = propIdMatch ? propIdMatch[1] : "";

    // Reserve price
    const priceMatch = text.match(/₹\s*([\d,.]+\s*(?:Lakh?|Lac|Crore?|Cr)?)/i);
    const reservePrice = priceMatch ? `₹ ${priceMatch[1]}` : "";

    // Bank name
    const bankEl = card.querySelector("[class*='bank'], [class*='Bank']") as HTMLElement;
    let bankName = bankEl?.innerText?.trim() || "";
    if (!bankName) {
      const bankMatch = text.match(/(?:🏛|Bank\s*(?:Name)?\s*:?\s*)([A-Za-z\s]+(?:Bank|of\s+\w+))/i);
      bankName = bankMatch ? bankMatch[1].trim() : "";
    }

    // Area
    const areaMatch = text.match(
      /(?:Carpet|Built[\s-]*Up|Area)\s*:?\s*([\d,.]+\s*(?:sq\.?\s*(?:feet|ft|meter|metre)|sqft|sqm))/i
    );
    const carpetArea = areaMatch ? areaMatch[1].trim() : "";

    // Furnishing
    const furnMatch = text.match(/Furnish(?:ing|ed)?\s*:?\s*(Furnished|Unfurnished|Semi[\s-]*Furnished)/i);
    const furnishing = furnMatch ? furnMatch[1].trim() : "";

    // Possession
    const possMatch = text.match(/Possession\s*(?:Status)?\s*:?\s*(Physical|Symbolic)/i);
    const possessionStatus = possMatch ? possMatch[1].trim() : "";

    // Action type
    const actionMatch = text.match(/(?:Type\s*of\s*Action|Under)\s*:?\s*((?:Under\s*)?SARFAESI|IBC|DRT)/i);
    const actionType = actionMatch ? actionMatch[1].replace(/^Under\s*/i, "").trim().toUpperCase() : "";

    // Location fields
    const stateMatch = text.match(/State\s*:?\s*([A-Za-z\s]+?)(?=\n|District|City)/i);
    const districtMatch = text.match(/District\s*:?\s*([A-Za-z\s]+?)(?=\n|City|State)/i);
    const cityMatch = text.match(/City\s*:?\s*([A-Za-z\s]+?)(?=\n|State|District|Inspection)/i);

    const state = stateMatch ? stateMatch[1].trim() : "";
    const district = districtMatch ? districtMatch[1].trim() : "";
    const city = cityMatch ? cityMatch[1].trim() : "";

    // Dates
    const auctionStartMatch = text.match(
      /Auction\s*Start\s*(?:Date\s*(?:&\s*Time)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
    );
    const auctionEndMatch = text.match(
      /Auction\s*End\s*(?:Date\s*(?:&?\s*[Tt]ime)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
    );
    const inspStartMatch = text.match(
      /Inspection\s*Start\s*(?:Date\s*(?:&\s*Time)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
    );
    const inspEndMatch = text.match(
      /Inspection\s*End\s*(?:Date\s*(?:&?\s*[Tt]ime)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
    );
    const emdMatch = text.match(
      /EMD\s*(?:End|Last|Due)?\s*(?:Date\s*(?:&\s*Time)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
    );

    // Photos
    const imgs = card.querySelectorAll("img");
    const photoUrls: string[] = [];
    imgs.forEach((img) => {
      const src = (img as HTMLImageElement).src || img.getAttribute("data-src") || "";
      if (src && !src.includes("favicon") && !src.includes("logo") && !src.includes("icon") && !src.includes("placeholder")) {
        photoUrls.push(src);
      }
    });

    // Detail link
    const detailLink = card.querySelector(
      'a[href*="view-property"], a[href*="property-detail"], a[href*="View Details"], ' +
      'button[class*="detail"], a[class*="detail"]'
    ) as HTMLAnchorElement | null;
    const detailUrl = detailLink?.href || detailLink?.getAttribute("href") || "";

    // Status badge
    const statusBadge = card.querySelector("[class*='badge'], [class*='status']") as HTMLElement;
    const status = statusBadge?.innerText?.trim().toUpperCase() || "UPCOMING";

    items.push({
      auctionId: bankPropertyId, // Property listings may not have separate auction IDs
      bankPropertyId,
      title,
      reservePrice,
      bankName,
      location: `${state}, ${city}`.replace(/(^,\s*|,\s*$)/g, ""),
      address: "",
      startDate: auctionStartMatch ? auctionStartMatch[1] : "",
      endDate: auctionEndMatch ? auctionEndMatch[1] : "",
      detailUrl,
      carpetArea,
      furnishing,
      possessionStatus,
      actionType,
      district,
      state,
      city,
      inspectionStartDate: inspStartMatch ? inspStartMatch[1] : "",
      inspectionEndDate: inspEndMatch ? inspEndMatch[1] : "",
      emdEndDate: emdMatch ? emdMatch[1] : "",
      thumbnailUrl: photoUrls[0] || "",
      photoUrls,
      status,
    });
  });

  return items;
}

/**
 * Extracts listing data from BaankNet IBC eAuction page.
 * IBC cards are on ibbi.baanknet.com with a different Angular app.
 * Runs inside the browser via page.evaluate().
 */
export function extractIBCListingCards(): {
  auctionId: string;
  title: string;
  reservePrice: string;
  bankName: string;
  location: string;
  startDate: string;
  endDate: string;
  detailUrl: string;
  status: string;
}[] {
  const items: ReturnType<typeof extractIBCListingCards> = [];

  const cards = document.querySelectorAll(
    ".card, [class*='asset-card'], [class*='listing-card'], " +
    "[class*='result'], [class*='item']"
  );

  cards.forEach((card) => {
    const text = (card as HTMLElement).innerText || "";
    // IBC cards typically contain Asset ID or some identifier
    if (text.length < 30 || text.length > 5000) return;
    if (!text.match(/(?:Asset|Auction|Property|Sale)\s*(?:ID|No)/i) && !text.includes("Reserve")) return;

    const idMatch = text.match(/(?:Asset|Auction)\s*(?:ID|No\.?)\s*:?\s*(\S+)/i);
    if (!idMatch) return;

    const titleEl = card.querySelector("h3, h4, h5, [class*='title']") as HTMLElement;
    const title = titleEl?.innerText?.trim() || text.split("\n")[0]?.trim() || "";

    const priceMatch = text.match(/Reserve\s*(?:Price)?\s*:?\s*₹?\s*([\d,.]+\s*(?:Lakh?|Lac|Crore?|Cr)?)/i);
    const bankMatch = text.match(/(?:Bank|Institution|Creditor)\s*:?\s*([A-Za-z\s]+?)(?=\n|$)/i);

    const locationMatch = text.match(/(?:Location|State|City)\s*:?\s*([A-Za-z,\s]+?)(?=\n|$)/i);

    const startMatch = text.match(/(?:Start|Auction\s*Start)\s*(?:Date)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);
    const endMatch = text.match(/(?:End|Auction\s*End|Closing)\s*(?:Date)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);

    const detailLink = card.querySelector(
      'a[href*="view-asset"], a[href*="asset-detail"], a[href*="home-view-asset"]'
    ) as HTMLAnchorElement | null;

    items.push({
      auctionId: idMatch[1],
      title: title || "IBC Auction Asset",
      reservePrice: priceMatch ? `₹ ${priceMatch[1]}` : "",
      bankName: bankMatch ? bankMatch[1].trim() : "",
      location: locationMatch ? locationMatch[1].trim() : "",
      startDate: startMatch ? startMatch[1] : "",
      endDate: endMatch ? endMatch[1] : "",
      detailUrl: detailLink?.href || detailLink?.getAttribute("href") || "",
      status: "UPCOMING",
    });
  });

  return items;
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/**
 * Merge detail page data into an existing raw item, filling in missing fields.
 */
export function mergeDetailData(
  item: {
    borrowerName?: string;
    description?: string;
    documentUrl?: string;
    carpetArea?: string;
    furnishing?: string;
    possessionStatus?: string;
    actionType?: string;
    district?: string;
    inspectionStartDate?: string;
    inspectionEndDate?: string;
    emdEndDate?: string;
    photoUrls?: string[];
    thumbnailUrl?: string;
  },
  detail: DetailPageData
): void {
  if (!item.borrowerName && detail.borrowerName) {
    item.borrowerName = detail.borrowerName;
  }
  if (!item.description && detail.description) {
    item.description = detail.description;
  }
  if (!item.documentUrl && detail.documentUrl) {
    item.documentUrl = detail.documentUrl;
  }
  if (!item.carpetArea && detail.carpetArea) {
    item.carpetArea = detail.carpetArea;
  }
  if (!item.furnishing && detail.furnishing) {
    item.furnishing = detail.furnishing;
  }
  if (!item.possessionStatus && detail.possessionStatus) {
    item.possessionStatus = detail.possessionStatus;
  }
  if (!item.actionType && detail.actionType) {
    item.actionType = detail.actionType;
  }
  if (!item.district && detail.district) {
    item.district = detail.district;
  }
  if (!item.inspectionStartDate && detail.inspectionStartDate) {
    item.inspectionStartDate = detail.inspectionStartDate;
  }
  if (!item.inspectionEndDate && detail.inspectionEndDate) {
    item.inspectionEndDate = detail.inspectionEndDate;
  }
  if (!item.emdEndDate && detail.emdEndDate) {
    item.emdEndDate = detail.emdEndDate;
  }
  if (detail.photoUrls.length > 0) {
    const existing = new Set(item.photoUrls || []);
    for (const url of detail.photoUrls) {
      existing.add(url);
    }
    item.photoUrls = Array.from(existing);
    if (!item.thumbnailUrl) {
      item.thumbnailUrl = detail.thumbnailUrl;
    }
  }
}
