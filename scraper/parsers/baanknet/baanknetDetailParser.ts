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
import { logger } from "../../utils/common/logger.js";

const log = logger.child({ module: "baanknetDetailParser" });

/**
 * IMPORTANT: extractEAuctionDetail, extractPropertyListingCards, and
 * extractIBCListingCards all run inside `page.evaluate()`. Puppeteer
 * serializes ONLY the function body to the browser — it does NOT carry
 * along module imports or outer closures.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DetailPageData {
  photoUrls: string[];
  thumbnailUrl: string;
  borrowerName: string;
  borrowerNames: string[];
  description: string;
  documentUrl: string;
  documentUrls: string[];
  carpetArea: string;
  furnishing: string;
  possessionStatus: string;
  actionType: string;
  district: string;
  inspectionStartDate: string;
  inspectionEndDate: string;
  emdEndDate: string;
  emdAmountText: string;
  contactPerson: string;
  contactPhone: string;
  lenderName: string;
}

// ─── DOM Extraction Functions (run inside Puppeteer page context) ────────────

/**
 * Extracts detail data from an eAuction detail page.
 * Runs inside the browser via page.evaluate().
 */
export function extractEAuctionDetail(knownLenders: string[] = []): DetailPageData {
  if (typeof (window as any).__name === "undefined") {
    (window as any).__name = (target: any) => target;
  }
  const bodyText = document.body?.innerText || "";

  function matchLenderInline(text: string, lenders: string[]): string {
    for (const lender of lenders) {
      const escaped = lender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(text)) return lender;
    }
    return "";
  }

  function isValidPhotoInline(src: string, img?: HTMLImageElement): boolean {
    if (!src || typeof src !== "string") return false;
    const lower = src.toLowerCase();
    if (lower.includes(".svg") || lower.endsWith(".svg")) return false;

    if (lower.includes("/property/images/") || lower.includes("_compressed")) {
      return true;
    }

    const junkKeywords = [
      "favicon", "logo", "icon", "banner", "footer", "header", "psb-",
      "ebkray", "faq", "hassle", "social", "facebook", "twitter", "linkedin",
      "instagram", "youtube", "play.google", "apple.com", "placeholder",
      "avatar", "client-logo", "bank-logo", "app-store", "sprite", "list-icon", "amenities"
    ];
    for (const kw of junkKeywords) {
      if (lower.includes(kw)) return false;
    }
    if (img) {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && h > 0 && (w < 30 || h < 30)) return false;
    }
    return true;
  }

  const photoUrls: string[] = [];
  const images = document.querySelectorAll(
    ".carousel img, .gallery img, .photo-gallery img, " +
    "[class*='gallery'] img, [class*='carousel'] img, [class*='photo'] img, " +
    "img[src*='property'], img[src*='photo'], img[src*='upload'], img[src*='asset']"
  );
  images.forEach((img) => {
    const htmlImg = img as HTMLImageElement;
    const src = htmlImg.src || 
                htmlImg.getAttribute("data-src") || 
                htmlImg.getAttribute("data-lazy") || 
                htmlImg.getAttribute("data-original") || 
                htmlImg.getAttribute("lazy-src") || 
                "";
    if (src && isValidPhotoInline(src, htmlImg) && !photoUrls.includes(src)) {
      photoUrls.push(src);
    }
  });

  const borrowerNames: string[] = [];
  const borrowerRe = /(?:Borrower|Co-Borrower|Guarantor|Defaulter)\s*(?:Name)?\s*:?\s*([^\n]{3,80})/gi;
  let borrowerMatchIter: RegExpExecArray | null;
  while ((borrowerMatchIter = borrowerRe.exec(bodyText)) !== null) {
    const name = borrowerMatchIter[1].trim();
    if (name && !borrowerNames.includes(name)) borrowerNames.push(name);
  }
  const borrowerName = borrowerNames[0] || "";

  let description = "";
  const descMatch = bodyText.match(
    /(?:Property\s*Description|Description\s*of\s*Property|Asset\s*Description)\s*:?\s*([\s\S]{10,500}?)(?=\n\s*\n|\n\s*(?:Reserve|Bank|Auction|EMD|Contact|Inspection))/i
  );
  if (descMatch) {
    description = descMatch[1].trim();
  }

  const documentUrls: string[] = [];
  const docElements = document.querySelectorAll(
    'a[href*="file-download"], a[href*="download"], a[href*="notice"], ' +
    'a[href*="document"], a[href*=".pdf"], a[href*="tender"], a[href*="annexure"], ' +
    'a[href*="sale-notice"], a[href*="possession"], a[href*="process-memo"], a[href*="form-g"], ' +
    'button[data-url], button[data-file], button[onclick*="download"], a[onclick*="download"], a[onclick*="window.open"]'
  );
  docElements.forEach((el) => {
    let href = (el as HTMLAnchorElement).href || 
               el.getAttribute("href") || 
               el.getAttribute("data-url") || 
               el.getAttribute("data-file") || 
               "";
    if (!href) {
      const onclick = el.getAttribute("onclick") || "";
      const match = onclick.match(/['"](https?:\/\/[^'"]+|\/[^'"]+)['"]/);
      if (match) href = match[1];
    }
    if (href && !href.startsWith("javascript:")) {
      // Normalize relative paths
      const fullUrl = href.startsWith("http") 
        ? href 
        : `https://baanknet.com${href.startsWith("/") ? "" : "/"}${href}`;
      if (!documentUrls.includes(fullUrl)) {
        documentUrls.push(fullUrl);
      }
    }
  });
  const documentUrl = documentUrls[0] || "";

  let carpetArea = "";
  const areaMatch = bodyText.match(
    /(?:Carpet|Built[\s-]*Up|Super\s*Built[\s-]*Up|Plot|Land)\s*Area\s*:?\s*([\d,.]+\s*(?:sq\.?\s*(?:feet|ft|meter|metre|mtr)|sqft|sqm))/i
  );
  if (areaMatch) {
    carpetArea = areaMatch[1].trim();
  }

  let furnishing = "";
  const furnMatch = bodyText.match(/Furnish(?:ing|ed)?\s*(?:Status)?\s*:?\s*(Furnished|Unfurnished|Semi[\s-]*Furnished)/i);
  if (furnMatch) {
    furnishing = furnMatch[1].trim();
  }

  let possessionStatus = "";
  const possMatch = bodyText.match(/Possession\s*(?:Status)?\s*:?\s*(Physical|Symbolic|Not\s*(?:Available|Taken))/i);
  if (possMatch) {
    possessionStatus = possMatch[1].trim();
  }

  let actionType = "";
  const actionMatch = bodyText.match(/(?:Type\s*of\s*Action|Action\s*Type|Under)\s*:?\s*((?:Under\s*)?SARFAESI|IBC|DRT|NCLT)/i);
  if (actionMatch) {
    actionType = actionMatch[1].replace(/^Under\s*/i, "").trim().toUpperCase();
  }

  let district = "";
  const districtMatch = bodyText.match(/District\s*:?\s*([A-Za-z\s]{2,40})/i);
  if (districtMatch) {
    district = districtMatch[1].trim();
  }

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

  let emdEndDate = "";
  const emdMatch = bodyText.match(
    /EMD\s*(?:End|Last|Due|Deadline)?\s*(?:Date\s*(?:&\s*Time)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i
  );
  if (emdMatch) {
    emdEndDate = emdMatch[1].trim();
  }

  let emdAmountText = "";
  const emdAmountMatch = bodyText.match(
    /EMD\s*(?:Amount)?\s*:?\s*(₹\s*[\d,.]+\s*(?:Lakh|Lac|Crore|Cr)?)/i
  );
  if (emdAmountMatch) {
    emdAmountText = emdAmountMatch[1].trim();
  }

  let contactPerson = "";
  let contactPhone = "";
  const contactPersonMatch = bodyText.match(
    /(?:Contact\s*Person|Authorized\s*Officer|Nodal\s*Officer)\s*:?\s*([^\n]{3,60})/i
  );
  if (contactPersonMatch) contactPerson = contactPersonMatch[1].trim();
  const phoneMatch = bodyText.match(/(?:Contact\s*(?:No\.?|Number)?|Mobile|Phone)\s*:?\s*(\+?91[\s-]?\d{10}|\d{10})/i);
  if (phoneMatch) contactPhone = phoneMatch[1].trim();

  let lenderName = matchLenderInline(bodyText, knownLenders);
  if (!lenderName) {
    const lenderFallbackMatch = bodyText.match(
      /(?:🏛|Bank\s*(?:Name)?|Lender)\s*:?\s*([A-Za-z\s&]+(?:Bank|of\s+\w+|Finance|Financial|Housing|ARC|Reconstruction))/i
    );
    if (lenderFallbackMatch) {
      lenderName = lenderFallbackMatch[1].trim();
    }
  }

  return {
    photoUrls,
    thumbnailUrl: photoUrls[0] || "",
    borrowerName,
    borrowerNames,
    description,
    documentUrl,
    documentUrls,
    carpetArea,
    furnishing,
    possessionStatus,
    actionType,
    district,
    inspectionStartDate,
    inspectionEndDate,
    emdEndDate,
    emdAmountText,
    contactPerson,
    contactPhone,
    lenderName,
  };
}

export function extractPropertyListingCards(knownLenders: string[] = []): {
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
  if (typeof (window as any).__name === "undefined") {
    (window as any).__name = (target: any) => target;
  }
  const items: ReturnType<typeof extractPropertyListingCards> = [];

  function matchLenderInline(text: string, lenders: string[]): string {
    for (const lender of lenders) {
      const escaped = lender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(text)) return lender;
    }
    return "";
  }

  function isValidPhotoInline(src: string, img?: HTMLImageElement): boolean {
    if (!src || typeof src !== "string") return false;
    const lower = src.toLowerCase();
    if (lower.includes(".svg") || lower.endsWith(".svg")) return false;

    if (lower.includes("/property/images/") || lower.includes("_compressed")) {
      return true;
    }

    const junkKeywords = [
      "favicon", "logo", "icon", "banner", "footer", "header", "psb-",
      "ebkray", "faq", "hassle", "social", "facebook", "twitter", "linkedin",
      "instagram", "youtube", "play.google", "apple.com", "placeholder",
      "avatar", "client-logo", "bank-logo", "app-store", "sprite", "list-icon", "amenities"
    ];
    for (const kw of junkKeywords) {
      if (lower.includes(kw)) return false;
    }
    if (img) {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && h > 0 && (w < 30 || h < 30)) return false;
    }
    return true;
  }

  const cards = document.querySelectorAll(
    "app-property-card, mat-card, .card, [class*='property-card'], [class*='listing-card'], " +
    "[class*='property-list'], [class*='result-card'], [class*='property-item'], [class*='col-'] > div"
  );

  const effectiveCards = cards.length > 0
    ? cards
    : document.querySelectorAll(".row > div, div[class*='box']");

  effectiveCards.forEach((card) => {
    const text = (card as HTMLElement).innerText || "";
    if (text.length < 30 || text.length > 8000) return;
    if (!text.includes("Property") && !text.includes("Auction") && !text.includes("₹") && !text.includes("Reserve")) return;

    const detailLink = card.querySelector(
      'a[href*="view-property"], a[href*="property-detail"], a[href*="View Details"], ' +
      'a[href*="property"], button[class*="detail"], a[class*="detail"], a'
    ) as HTMLAnchorElement | null;
    const detailUrl = detailLink?.href || detailLink?.getAttribute("href") || "";

    const propIdMatch = text.match(/(?:Property|Asset|Auction)\s*(?:ID|No\.?|Code)?\s*:?\s*([A-Za-z0-9_-]+)/i);
    const urlIdMatch = detailUrl.match(/(?:property|id|asset)[/=]([A-Za-z0-9_-]+)/i);
    const bankPropertyId = propIdMatch ? propIdMatch[1] : (urlIdMatch ? urlIdMatch[1] : "");

    if (!bankPropertyId && !detailUrl.includes("property")) return;
    const finalId = bankPropertyId || `PROP_${Math.abs(text.slice(0, 40).split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`;

    const titleEl = card.querySelector("h3, h4, h5, [class*='title'], [class*='name'], strong, b") as HTMLElement;
    const title = titleEl?.innerText?.trim() || text.split("\n").filter(l => l.trim().length > 3)[0] || "Bank Auction Property";

    const priceMatch = text.match(/₹\s*([\d,.]+\s*(?:Lakh?|Lac|Crore?|Cr)?)/i);
    const reservePrice = priceMatch ? `₹ ${priceMatch[1]}` : "";

    let bankName = matchLenderInline(text, knownLenders);
    if (!bankName) {
      const bankEl = card.querySelector("[class*='bank'], [class*='Bank']") as HTMLElement;
      bankName = bankEl?.innerText?.trim() || "";
    }
    if (!bankName) {
      const bankMatch = text.match(/(?:🏛|Bank\s*(?:Name)?\s*:?\s*)([A-Za-z\s]+(?:Bank|of\s+\w+))/i);
      bankName = bankMatch ? bankMatch[1].trim() : "";
    }

    const areaMatch = text.match(
      /(?:Carpet|Built[\s-]*Up|Area)\s*:?\s*([\d,.]+\s*(?:sq\.?\s*(?:feet|ft|meter|metre)|sqft|sqm))/i
    );
    const carpetArea = areaMatch ? areaMatch[1].trim() : "";

    const furnMatch = text.match(/Furnish(?:ing|ed)?\s*:?\s*(Furnished|Unfurnished|Semi[\s-]*Furnished)/i);
    const furnishing = furnMatch ? furnMatch[1].trim() : "";

    const possMatch = text.match(/Possession\s*(?:Status)?\s*:?\s*(Physical|Symbolic)/i);
    const possessionStatus = possMatch ? possMatch[1].trim() : "";

    const actionMatch = text.match(/(?:Type\s*of\s*Action|Under)\s*:?\s*((?:Under\s*)?SARFAESI|IBC|DRT)/i);
    const actionType = actionMatch ? actionMatch[1].replace(/^Under\s*/i, "").trim().toUpperCase() : "";

    const stateMatch = text.match(/State\s*:?\s*([A-Za-z\s]+?)(?=\n|District|City|$)/i);
    const districtMatch = text.match(/District\s*:?\s*([A-Za-z\s]+?)(?=\n|City|State|$)/i);
    const cityMatch = text.match(/City\s*:?\s*([A-Za-z\s]+?)(?=\n|State|District|Inspection|$)/i);

    const state = stateMatch ? stateMatch[1].trim() : "";
    const district = districtMatch ? districtMatch[1].trim() : "";
    const city = cityMatch ? cityMatch[1].trim() : "";

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

    const imgs = card.querySelectorAll("img");
    const photoUrls: string[] = [];
    imgs.forEach((img) => {
      const htmlImg = img as HTMLImageElement;
      const src = htmlImg.src || 
                  htmlImg.getAttribute("data-src") || 
                  htmlImg.getAttribute("data-lazy") || 
                  htmlImg.getAttribute("data-original") || 
                  htmlImg.getAttribute("lazy-src") || 
                  "";
      if (src && isValidPhotoInline(src, htmlImg) && !photoUrls.includes(src)) {
        photoUrls.push(src);
      }
    });

    const statusBadge = card.querySelector("[class*='badge'], [class*='status']") as HTMLElement;
    const status = statusBadge?.innerText?.trim().toUpperCase() || "UPCOMING";

    items.push({
      auctionId: finalId,
      bankPropertyId: finalId,
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

export function extractIBCListingCards(knownLenders: string[] = []): {
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
  if (typeof (window as any).__name === "undefined") {
    (window as any).__name = (target: any) => target;
  }
  const items: ReturnType<typeof extractIBCListingCards> = [];

  function matchLenderInline(text: string, lenders: string[]): string {
    for (const lender of lenders) {
      const escaped = lender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(text)) return lender;
    }
    return "";
  }

  const cards = document.querySelectorAll(
    "tbody tr, tr.table-row, .card, [class*='asset-card'], [class*='listing-card'], " +
    "[class*='result'], [class*='item'], div[class*='col'] > div"
  );

  cards.forEach((card) => {
    const text = (card as HTMLElement).innerText || "";
    if (text.length < 20 || text.length > 5000) return;
    if (!text.includes("₹") && !text.match(/(?:Asset|Auction|Property|Sale|IBC|ID)/i)) return;

    const detailLink = card.querySelector(
      'a[href*="view-asset"], a[href*="asset-detail"], a[href*="home-view-asset"], a'
    ) as HTMLAnchorElement | null;
    const detailUrl = detailLink?.href || detailLink?.getAttribute("href") || "";

    const idMatch = text.match(/(?:Asset|Auction|Sale|ID|No\.?)\s*(?:ID|No\.?|Code)?\s*:?\s*([A-Za-z0-9_-]+)/i);
    const urlIdMatch = detailUrl.match(/(?:asset|id|view)[/=]([A-Za-z0-9_-]+)/i);
    const auctionId = idMatch ? idMatch[1] : (urlIdMatch ? urlIdMatch[1] : "");

    if (!auctionId && !detailUrl.includes("asset")) return;
    const finalId = auctionId || `IBC_${Math.abs(text.slice(0, 30).split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`;

    const titleEl = card.querySelector("h3, h4, h5, [class*='title'], strong, b, td:first-child") as HTMLElement;
    const title = titleEl?.innerText?.trim() || text.split("\n").filter(l => l.trim().length > 3)[0] || "IBC Auction Asset";

    const priceMatch = text.match(/₹?\s*([\d,.]+\s*(?:Lakh?|Lac|Crore?|Cr)?)/i);
    let bankName = matchLenderInline(text, knownLenders);
    if (!bankName) {
      const bankMatch = text.match(/(?:Bank|Institution|Creditor|Liquidator)\s*:?\s*([A-Za-z\s]+?)(?=\n|$)/i);
      bankName = bankMatch ? bankMatch[1].trim() : "";
    }

    const locationMatch = text.match(/(?:Location|State|City)\s*:?\s*([A-Za-z,\s]+?)(?=\n|$)/i);

    const startMatch = text.match(/(?:Start|Auction\s*Start)\s*(?:Date)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);
    const endMatch = text.match(/(?:End|Auction\s*End|Closing)\s*(?:Date)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);

    items.push({
      auctionId: finalId,
      title: title || "IBC Auction Asset",
      reservePrice: priceMatch ? `₹ ${priceMatch[1]}` : "",
      bankName: bankName || "",
      location: locationMatch ? locationMatch[1].trim() : "",
      startDate: startMatch ? startMatch[1] : "",
      endDate: endMatch ? endMatch[1] : "",
      detailUrl,
      status: "UPCOMING",
    });
  });

  return items;
}

export function mergeDetailData(
  item: {
    borrowerName?: string;
    borrowerNames?: string[];
    description?: string;
    documentUrl?: string;
    documentUrls?: string[];
    carpetArea?: string;
    furnishing?: string;
    possessionStatus?: string;
    actionType?: string;
    district?: string;
    inspectionStartDate?: string;
    inspectionEndDate?: string;
    emdEndDate?: string;
    emdAmountText?: string;
    contactPerson?: string;
    contactPhone?: string;
    bankName?: string;
    photoUrls?: string[];
    thumbnailUrl?: string;
  },
  detail: DetailPageData
): void {
  if (!item.borrowerName && detail.borrowerName) {
    item.borrowerName = detail.borrowerName;
  }
  if (detail.borrowerNames && detail.borrowerNames.length > 0) {
    const existingBorrowers = new Set(item.borrowerNames || []);
    for (const name of detail.borrowerNames) existingBorrowers.add(name);
    item.borrowerNames = Array.from(existingBorrowers);
  }
  if (!item.description && detail.description) {
    item.description = detail.description;
  }
  if (!item.documentUrl && detail.documentUrl) {
    item.documentUrl = detail.documentUrl;
  }
  if (detail.documentUrls && detail.documentUrls.length > 0) {
    const existingDocs = new Set(item.documentUrls || []);
    for (const url of detail.documentUrls) existingDocs.add(url);
    item.documentUrls = Array.from(existingDocs);
  }
  if (!item.emdAmountText && detail.emdAmountText) {
    item.emdAmountText = detail.emdAmountText;
  }
  if (!item.contactPerson && detail.contactPerson) {
    item.contactPerson = detail.contactPerson;
  }
  if (!item.contactPhone && detail.contactPhone) {
    item.contactPhone = detail.contactPhone;
  }
  if ((!item.bankName || item.bankName === "Unknown Bank") && detail.lenderName) {
    item.bankName = detail.lenderName;
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
