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
  bidIncrementText?: string;
  emdAccountNumber?: string;
  emdAccountIfsc?: string;
  emdBankName?: string;
  outstandingDuesText?: string;
  tenderFeeText?: string;
  cersaiId?: string;
  titleType?: string;
  encumbrancesText?: string;
  branchName?: string;
  officerDesignation?: string;
  officerEmail?: string;
  contactPerson: string;
  contactPhone: string;
  lenderName: string;
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string;
  boundaries?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
  corporateDebtorName?: string;
  corporateDebtorCin?: string;
  liquidatorRegNo?: string;
  liquidatorEmail?: string;
  ncltBench?: string;
  ncltCaseNo?: string;
  processMemoUrl?: string;
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
  const bodyText = document.body?.innerText || document.body?.textContent || "";

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

    if (lower.includes("/property/images/") || lower.includes("_compressed") || lower.includes("/uploads/") || lower.includes("/asset/") || lower.includes("/assets/")) {
      return true;
    }

    const junkKeywords = [
      "favicon", "logo", "icon", "banner", "footer", "header", "psb-",
      "ebkray", "faq", "hassle", "social", "facebook", "twitter", "linkedin",
      "instagram", "youtube", "play.google", "apple.com", "placeholder",
      "avatar", "client-logo", "bank-logo", "app-store", "sprite", "list-icon", "amenities",
      "whatsapp", "telegram", "email", "call", "phone", "rating", "star"
    ];
    for (const kw of junkKeywords) {
      if (lower.includes(kw)) return false;
    }
    if (img) {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && h > 0 && (w < 40 || h < 40)) return false;
    }
    return true;
  }

  const photoUrls: string[] = [];
  
  // 1. All images on detail page (including carousels, sliders, galleries, cards)
  const images = document.querySelectorAll(
    "img, .carousel img, .gallery img, .photo-gallery img, " +
    "[class*='gallery'] img, [class*='carousel'] img, [class*='photo'] img, [class*='slider'] img, " +
    "img[src*='property'], img[src*='photo'], img[src*='upload'], img[src*='asset'], img[src*='image']"
  );
  images.forEach((img) => {
    const htmlImg = img as HTMLImageElement;
    const src = htmlImg.src || 
                htmlImg.getAttribute("data-src") || 
                htmlImg.getAttribute("data-lazy") || 
                htmlImg.getAttribute("data-original") || 
                htmlImg.getAttribute("lazy-src") || 
                htmlImg.getAttribute("data-img") ||
                htmlImg.getAttribute("data-image") ||
                "";
    if (src && isValidPhotoInline(src, htmlImg)) {
      const fullUrl = src.startsWith("http") ? src : (src.startsWith("/") ? `https://baanknet.com${src}` : `https://baanknet.com/${src}`);
      if (!photoUrls.includes(fullUrl)) {
        photoUrls.push(fullUrl);
      }
    }
  });

  // 2. Search background-image in inline styles
  const bgElements = document.querySelectorAll("[style*='background-image'], [style*='background']");
  bgElements.forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") || "";
    const bgMatch = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
    if (bgMatch && bgMatch[1]) {
      const src = bgMatch[1];
      if (isValidPhotoInline(src)) {
        const fullUrl = src.startsWith("http") ? src : (src.startsWith("/") ? `https://baanknet.com${src}` : `https://baanknet.com/${src}`);
        if (!photoUrls.includes(fullUrl)) {
          photoUrls.push(fullUrl);
        }
      }
    }
  });

  // 3. Search high-res image anchor tags (e.g. lightbox, popup links)
  const imageLinks = document.querySelectorAll("a[href*='.jpg'], a[href*='.jpeg'], a[href*='.png'], a[href*='.webp']");
  imageLinks.forEach((a) => {
    const href = (a as HTMLAnchorElement).href || a.getAttribute("href") || "";
    if (href && isValidPhotoInline(href)) {
      const fullUrl = href.startsWith("http") ? href : (href.startsWith("/") ? `https://baanknet.com${href}` : `https://baanknet.com/${href}`);
      if (!photoUrls.includes(fullUrl)) {
        photoUrls.push(fullUrl);
      }
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

  function normalizeDocUrlInline(rawUrl: string): string | null {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    const trimmed = rawUrl.trim();
    if (
      !trimmed ||
      trimmed.startsWith("javascript:") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:")
    ) {
      return null;
    }

    // Ignore known image and static asset extensions
    const lower = trimmed.toLowerCase();
    if (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".svg") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".ico") ||
      lower.endsWith(".css") ||
      lower.endsWith(".js")
    ) {
      return null;
    }

    try {
      const defaultHost = (typeof window !== "undefined" && window.location?.origin) || "https://baanknet.com";
      let resolved = trimmed;
      if (resolved.startsWith("//")) {
        resolved = `https:${resolved}`;
      } else if (resolved.startsWith("/")) {
        resolved = `${defaultHost}${resolved}`;
      } else if (!resolved.startsWith("http://") && !resolved.startsWith("https://")) {
        resolved = `${defaultHost}/${resolved}`;
      }

      const u = new URL(resolved);
      if (u.hostname.includes("baanknet.com") || u.hostname.includes("ibbi.baanknet.com")) {
        u.protocol = "https:";
      }

      // Ignore if resolved URL is just pointing to the current page without query or extension
      if (typeof window !== "undefined" && window.location) {
        if (u.origin === window.location.origin && u.pathname === window.location.pathname && !u.search && !u.pathname.endsWith(".pdf")) {
          return null;
        }
      }

      // Strip trailing slash on pathname
      let pathname = u.pathname;
      if (pathname.length > 1 && pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }
      u.pathname = pathname;

      // Canonicalize and sort query params (strip tracking/cache-busters)
      const params = new URLSearchParams(u.search);
      const trackingKeys = ["_", "t", "ts", "timestamp", "sessionid", "token", "nocache", "rand"];
      for (const key of Array.from(params.keys())) {
        if (trackingKeys.includes(key.toLowerCase())) {
          params.delete(key);
        }
      }
      params.sort();
      u.search = params.toString() ? `?${params.toString()}` : "";
      u.hash = "";

      return u.toString();
    } catch {
      return null;
    }
  }

  const documentUrls: string[] = [];
  const addDocCandidate = (rawHref: string) => {
    const canonical = normalizeDocUrlInline(rawHref);
    if (canonical && !documentUrls.includes(canonical)) {
      documentUrls.push(canonical);
    }
  };

  // 1. Direct href keywords & attributes (PDFs, downloads, notices, tenders, annexures, getfile, form-g, etc.)
  const directDocElements = document.querySelectorAll(
    'a[href*="file-download"], a[href*="download"], a[href*="notice"], ' +
    'a[href*="document"], a[href*=".pdf"], a[href*="tender"], a[href*="annexure"], ' +
    'a[href*="sale-notice"], a[href*="possession"], a[href*="process-memo"], a[href*="form-g"], ' +
    'a[href*="getfile"], a[href*="view-document"], a[href*="download-attachment"], a[href*="client-document"], ' +
    'button[data-url], button[data-file], button[data-href], button[data-download], button[data-pdf], ' +
    'button[onclick*="download"], a[onclick*="download"], a[onclick*="window.open"], [data-document-url]'
  );
  directDocElements.forEach((el) => {
    const rawHrefAttr = el.getAttribute("href") || "";
    if (rawHrefAttr.startsWith("#") || rawHrefAttr.startsWith("javascript:")) return;

    let href = el.getAttribute("href") || 
               (el as HTMLAnchorElement).href || 
               el.getAttribute("data-url") || 
               el.getAttribute("data-file") || 
               el.getAttribute("data-href") || 
               el.getAttribute("data-download") || 
               el.getAttribute("data-pdf") || 
               el.getAttribute("data-document-url") || 
               "";
    if (!href) {
      const onclick = el.getAttribute("onclick") || "";
      const match = onclick.match(/['"](https?:\/\/[^'"]+|\/[^'"]+)['"]/);
      if (match) href = match[1];
    }
    if (href) addDocCandidate(href);
  });

  // 2. Container heading / section matching:
  // Any <a> or <button> inside a container whose header/title matches document keywords
  const candidateContainers = document.querySelectorAll(
    'div, section, article, table, tr, li, .card, .panel, .tab-pane, .accordion-item, [class*="document"], [class*="attachment"], [class*="tab"], [class*="accordion"]'
  );
  candidateContainers.forEach((container) => {
    const headingEl = container.querySelector(
      'h1, h2, h3, h4, h5, h6, th, label, .card-header, .accordion-header, [class*="title"], [class*="header"]'
    );
    const headingText = headingEl ? (headingEl.textContent || "") : "";
    if (
      /document|attachment|annexure|notice|form|tender|download|legal|file\s*detail/i.test(headingText) ||
      /document|attachment|annexure|notice|form|tender/i.test(container.className || "")
    ) {
      // Extract any <a> with href inside this container
      const links = container.querySelectorAll("a[href], button[data-url], button[data-file], button[data-href], button[onclick]");
      links.forEach((linkEl) => {
        const rawHrefAttr = linkEl.getAttribute("href") || "";
        if (rawHrefAttr.startsWith("#") || rawHrefAttr.startsWith("javascript:")) return;

        let href = linkEl.getAttribute("href") || 
                   (linkEl as HTMLAnchorElement).href || 
                   linkEl.getAttribute("data-url") || 
                   linkEl.getAttribute("data-file") || 
                   linkEl.getAttribute("data-href") || "";
        if (!href) {
          const onclick = linkEl.getAttribute("onclick") || "";
          const match = onclick.match(/['"](https?:\/\/[^'"]+|\/[^'"]+)['"]/);
          if (match) href = match[1];
        }
        if (href) addDocCandidate(href);
      });
    }
  });

  // 3. Fallback: Table cells labeled "Download", "View Notice", "Tender Document", etc.
  const tableCells = document.querySelectorAll("td, th");
  tableCells.forEach((cell) => {
    const text = cell.textContent?.trim() || "";
    if (/download|view\s*notice|view\s*doc|view\s*pdf|notice\s*pdf/i.test(text)) {
      const link = cell.querySelector("a[href], button");
      if (link) {
        const href = (link as HTMLAnchorElement).href || link.getAttribute("href") || link.getAttribute("data-url") || "";
        if (href) addDocCandidate(href);
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
  const districtMatch = bodyText.match(/District\s*:?\s*([A-Za-z\s]{2,30}?)(?=\r?\n|$|\t|\s{2,}|Inspection|EMD|Reserve|Bank|Type|Borrower|Area)/i);
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

  let bidIncrementText = "";
  const bidIncMatch = bodyText.match(/(?:Bid\s*Increment|Bid\s*Multiplier|Minimum\s*(?:Bid\s*)?Increment|Increment\s*Value)\s*:?\s*(?:₹|Rs\.?)?\s*([\d,.]+\s*(?:Lakh|Lac|Crore|Cr|K)?)/i);
  if (bidIncMatch) bidIncrementText = `₹ ${bidIncMatch[1].trim()}`;

  let emdAccountNumber = "";
  const accMatch = bodyText.match(/(?:A\/[Cc]\s*(?:No\.?|Number)?|Account\s*(?:No\.?|Number)?)\s*:?\s*([0-9]{9,18})/i);
  if (accMatch) emdAccountNumber = accMatch[1].trim();

  let emdAccountIfsc = "";
  const ifscMatch = bodyText.match(/(?:IFSC(?:\s*Code)?|RTGS\/NEFT\s*IFSC|IFS\s*Code)\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})/i);
  if (ifscMatch) emdAccountIfsc = ifscMatch[1].trim().toUpperCase();

  let emdBankName = "";
  const emdBankMatch = bodyText.match(/(?:EMD\s*Remittance\s*Bank|Bank\s*Branch\s*Name|Beneficiary\s*Bank)\s*:?\s*([A-Za-z\s&]+(?:Bank|Branch))/i);
  if (emdBankMatch) emdBankName = emdBankMatch[1].trim();

  let outstandingDuesText = "";
  const duesMatch = bodyText.match(/(?:Total\s*Outstanding|Outstanding\s*(?:Amount|Dues)|Demand\s*Notice\s*Amount|Recovery\s*Amount)\s*:?\s*(?:₹|Rs\.?)?\s*([\d,.]+\s*(?:Lakh|Lac|Crore|Cr)?)/i);
  if (duesMatch) outstandingDuesText = `₹ ${duesMatch[1].trim()}`;

  let tenderFeeText = "";
  const feeMatch = bodyText.match(/(?:Tender\s*Fee|Processing\s*Fee|Application\s*Fee)\s*:?\s*(?:₹|Rs\.?)?\s*([\d,.]+\s*(?:Lakh|Lac|Crore|Cr)?)/i);
  if (feeMatch) tenderFeeText = `₹ ${feeMatch[1].trim()}`;

  let cersaiId = "";
  const cersaiMatch = bodyText.match(/(?:CERSAI\s*(?:ID|No\.?|Number|Security\s*Interest)?|Security\s*Interest\s*ID)\s*:?\s*([A-Za-z0-9_-]{6,30})/i);
  if (cersaiMatch) cersaiId = cersaiMatch[1].trim();

  let titleType = "";
  const titleTypeMatch = bodyText.match(/(?:Title\s*Type|Property\s*Nature|Type\s*of\s*Ownership|Ownership\s*Type|Title)\s*:?\s*(Freehold|Leasehold|Cooperative\s*Society|Society\s*Share|Allotment)/i);
  if (titleTypeMatch) {
    titleType = titleTypeMatch[1].trim();
  } else if (/freehold/i.test(bodyText)) {
    titleType = "Freehold";
  } else if (/leasehold/i.test(bodyText)) {
    titleType = "Leasehold";
  }

  let encumbrancesText = "";
  const encMatch = bodyText.match(/(?:Encumbrance|Known\s*Encumbrances?|Known\s*Liabilities|Pending\s*Dues)\s*:?\s*([^\n]{3,200})/i);
  if (encMatch) {
    encumbrancesText = encMatch[1].trim();
  } else if (bodyText.includes("Free from all encumbrances") || bodyText.includes("Not known to bank")) {
    encumbrancesText = "Free from all encumbrances to bank's knowledge";
  }

  let branchName = "";
  const branchMatch = bodyText.match(/(?:Branch\s*(?:Name)?|SARB|SAMB|Asset\s*Recovery\s*Branch|Asset\s*Management\s*Branch)\s*:?\s*([A-Za-z0-9\s,-]+?)(?=\n|District|City|State|Pin|Tel|Phone|Email|$)/i);
  if (branchMatch) branchName = branchMatch[1].trim();

  let contactPerson = "";
  let contactPhone = "";
  const contactPersonMatch = bodyText.match(
    /(?:Contact\s*Person|Authorized\s*Officer|Nodal\s*Officer)\s*:?\s*([^\n]{3,60})/i
  );
  if (contactPersonMatch) contactPerson = contactPersonMatch[1].trim();
  const phoneMatch = bodyText.match(/(?:Contact\s*(?:No\.?|Number)?|Mobile|Phone)\s*:?\s*(\+?91[\s-]?\d{10}|\d{10})/i);
  if (phoneMatch) contactPhone = phoneMatch[1].trim();

  let officerDesignation = "";
  const desigMatch = bodyText.match(/(?:Designation|Officer\s*Designation)\s*:?\s*([^\n]{3,60})/i);
  if (desigMatch) {
    officerDesignation = desigMatch[1].trim();
  } else {
    const desigFallback = bodyText.match(/(Chief\s*Manager|Assistant\s*General\s*Manager|AGM|DGM|General\s*Manager|Authorized\s*Officer|Recovery\s*Officer|Branch\s*Manager)/i);
    if (desigFallback) officerDesignation = desigFallback[1].trim();
  }

  let officerEmail = "";
  const emailMatch = bodyText.match(/(?:Email|E-mail|Mail)\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    officerEmail = emailMatch[1].trim();
  } else {
    const anyEmail = bodyText.match(/\b([a-zA-Z0-9._%+-]+@(?:pnb|sbi|bankofbaroda|canarabank|unionbankofindia|indianbank|ucobank|bankofindia|psballiance|baanknet)\.[a-zA-Z.]+)\b/i);
    if (anyEmail) officerEmail = anyEmail[1].trim();
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  let mapUrl = "";

  const mapLink = document.querySelector('a[href*="google.com/maps"], a[href*="maps.google"], a[href*="goo.gl/maps"]') as HTMLAnchorElement | null;
  if (mapLink && mapLink.href) {
    mapUrl = mapLink.href;
    const coordMatch = mapUrl.match(/[@=]([-0-9.]+),([-0-9.]+)/);
    if (coordMatch) {
      latitude = parseFloat(coordMatch[1]);
      longitude = parseFloat(coordMatch[2]);
    }
  }

  if (!latitude) {
    const latLongMatch = bodyText.match(/(?:Lat(?:itude)?|GPS)\s*:?\s*([-0-9.]+)\s*[,;/ ]\s*(?:Long(?:itude)?|Lng)\s*:?\s*([-0-9.]+)/i);
    if (latLongMatch) {
      latitude = parseFloat(latLongMatch[1]);
      longitude = parseFloat(latLongMatch[2]);
      if (!mapUrl) mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    }
  }

  let boundaries: { north?: string; south?: string; east?: string; west?: string } | undefined = undefined;
  const northM = bodyText.match(/North\s*(?:By|Side)?\s*:?\s*([^\n,]{3,60})/i);
  const southM = bodyText.match(/South\s*(?:By|Side)?\s*:?\s*([^\n,]{3,60})/i);
  const eastM = bodyText.match(/East\s*(?:By|Side)?\s*:?\s*([^\n,]{3,60})/i);
  const westM = bodyText.match(/West\s*(?:By|Side)?\s*:?\s*([^\n,]{3,60})/i);

  if (northM || southM || eastM || westM) {
    boundaries = {
      north: northM ? northM[1].trim() : undefined,
      south: southM ? southM[1].trim() : undefined,
      east: eastM ? eastM[1].trim() : undefined,
      west: westM ? westM[1].trim() : undefined,
    };
  }

  let corporateDebtorName = "";
  const cdMatch = bodyText.match(/(?:Corporate\s*Debtor|Company\s*in\s*Liquidation|CD\s*Name)\s*:?\s*([^\n]{3,80})/i);
  if (cdMatch) corporateDebtorName = cdMatch[1].trim();

  let corporateDebtorCin = "";
  const cinMatch = bodyText.match(/\b([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/);
  if (cinMatch) corporateDebtorCin = cinMatch[1].trim().toUpperCase();

  let liquidatorRegNo = "";
  const ipRegMatch = bodyText.match(/(IBBI\/IPA-[A-Za-z0-9\/\-_]+)/i);
  if (ipRegMatch) liquidatorRegNo = ipRegMatch[1].trim();

  let liquidatorEmail = "";
  const liqEmailMatch = bodyText.match(/(?:Liquidator|RP|IP)\s*(?:Email|Mail)?\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (liqEmailMatch) liquidatorEmail = liqEmailMatch[1].trim();

  let ncltBench = "";
  const ncltBenchMatch = bodyText.match(/(NCLT\s*[A-Za-z\s]+(?:Bench)?(?:\s*-\s*[A-Z0-9]+)?)/i);
  if (ncltBenchMatch) ncltBench = ncltBenchMatch[1].trim();

  let ncltCaseNo = "";
  const ncltCaseMatch = bodyText.match(/((?:CP|CA)\s*(?:\(IB\))?\s*(?:No\.?)?\s*[\d\/\w-]+)/i);
  if (ncltCaseMatch) ncltCaseNo = ncltCaseMatch[1].trim();

  let processMemoUrl = "";
  const memoEl = document.querySelector('a[href*="process-memo"], a[href*="memo"], a[href*="form-g"]') as HTMLAnchorElement | null;
  if (memoEl && memoEl.href) processMemoUrl = memoEl.href;

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
    bidIncrementText,
    emdAccountNumber,
    emdAccountIfsc,
    emdBankName,
    outstandingDuesText,
    tenderFeeText,
    cersaiId,
    titleType,
    encumbrancesText,
    branchName,
    officerDesignation,
    officerEmail,
    contactPerson,
    contactPhone,
    lenderName,
    latitude,
    longitude,
    mapUrl,
    boundaries,
    corporateDebtorName,
    corporateDebtorCin,
    liquidatorRegNo,
    liquidatorEmail,
    ncltBench,
    ncltCaseNo,
    processMemoUrl,
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

  function isGarbageTitle(str: string): boolean {
    if (!str || str.length < 3) return true;
    const lower = str.toLowerCase().trim();
    return (
      lower.startsWith("showing") ||
      lower.includes("results") ||
      lower.includes("properties found") ||
      lower.includes("sort by") ||
      lower.includes("filter") ||
      lower.includes("page ") ||
      lower.includes("search results") ||
      lower.includes("view details") ||
      lower.includes("reserve price") ||
      lower.includes("bank property id") ||
      lower.includes("10000+")
    );
  }

  function isBankOrGarbage(str: string): boolean {
    if (!str || str.length < 2) return true;
    const lower = str.toLowerCase().trim();
    return (
      lower.includes("bank") ||
      lower.includes("lender") ||
      lower.includes("finance") ||
      lower.includes("financial") ||
      lower.includes("arc") ||
      lower.includes("nbfc") ||
      lower.includes("corporation") ||
      lower.includes("ltd") ||
      lower.includes("pvt") ||
      lower.includes("limited") ||
      lower.includes("showing") ||
      lower.includes("result") ||
      lower.includes("property id") ||
      lower.includes("auction id") ||
      lower.includes("details")
    );
  }

  const cards = document.querySelectorAll(
    "app-property-card, mat-card.property-card, .property-card, [class*='property-card'], " +
    "[class*='listing-card'], [class*='property-list'], [class*='property-item']"
  );

  const effectiveCards = cards.length > 0
    ? cards
    : document.querySelectorAll(".card, [class*='result-card'], .row > div, div[class*='box']");

  effectiveCards.forEach((card) => {
    const text = (card as HTMLElement).innerText || "";
    if (text.length < 30 || text.length > 8000) return;
    if (!text.includes("Property") && !text.includes("Auction") && !text.includes("₹") && !text.includes("Reserve")) return;

    // Filter out search filter headers and counter bars
    if (text.toLowerCase().includes("showing") && !text.includes("₹") && !text.includes("Reserve")) return;

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

    // Extract area first for fallback title synthesis
    const areaMatch = text.match(
      /(?:Carpet|Built[\s-]*Up|Area)\s*:?\s*([\d,.]+\s*(?:sq\.?\s*(?:feet|ft|meter|metre)|sqft|sqm))/i
    );
    const carpetArea = areaMatch ? areaMatch[1].trim() : "";

    // Extract state, district, and city with strict anti-bank filtering
    const stateMatch = text.match(/State\s*:?\s*([A-Za-z\s]+?)(?=\n|District|City|Pincode|Pin|$)/i);
    const rawState = stateMatch ? stateMatch[1].trim() : "";
    const state = !isBankOrGarbage(rawState) ? rawState : "";

    const districtMatch = text.match(/District\s*:?\s*([A-Za-z\s]+?)(?=\n|City|State|Pincode|Pin|$)/i);
    const rawDistrict = districtMatch ? districtMatch[1].trim() : "";
    const district = !isBankOrGarbage(rawDistrict) ? rawDistrict : "";

    const cityMatch = text.match(/City\s*:?\s*([A-Za-z\s]+?)(?=\n|State|District|Inspection|Pincode|Pin|$)/i);
    const rawCity = cityMatch ? cityMatch[1].trim() : "";
    const city = !isBankOrGarbage(rawCity) ? rawCity : "";

    // Robust title extraction
    let title = "";
    const candidateEls = card.querySelectorAll("h3, h4, h5, [class*='title'], [class*='name'], a[href*='property'], strong, b");
    for (const el of candidateEls) {
      const candidate = (el as HTMLElement).innerText?.trim() || "";
      if (!isGarbageTitle(candidate)) {
        title = candidate;
        break;
      }
    }

    if (!title) {
      const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 3);
      for (const line of lines) {
        if (!isGarbageTitle(line) && !line.includes(":") && !line.includes("₹")) {
          title = line;
          break;
        }
      }
    }

    // Synthesize clean title if still empty or generic
    if (!title || isGarbageTitle(title)) {
      const areaPrefix = carpetArea ? `${carpetArea} ` : "";
      const locSuffix = city ? ` in ${city}` : (state ? ` in ${state}` : "");
      title = `${areaPrefix}Bank Foreclosure Property${locSuffix}`;
    }

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

    const furnMatch = text.match(/Furnish(?:ing|ed)?\s*:?\s*(Furnished|Unfurnished|Semi[\s-]*Furnished)/i);
    const furnishing = furnMatch ? furnMatch[1].trim() : "";

    const possMatch = text.match(/Possession\s*(?:Status)?\s*:?\s*(Physical|Symbolic)/i);
    const possessionStatus = possMatch ? possMatch[1].trim() : "";

    const actionMatch = text.match(/(?:Type\s*of\s*Action|Under)\s*:?\s*((?:Under\s*)?SARFAESI|IBC|DRT)/i);
    const actionType = actionMatch ? actionMatch[1].replace(/^Under\s*/i, "").trim().toUpperCase() : "";

    const locParts = [city, state].filter(Boolean);
    const location = locParts.length > 0 ? locParts.join(", ") : "India";

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

export function extractVehicleListingCards(knownLenders: string[] = []): {
  auctionId: string;
  bankPropertyId?: string;
  title: string;
  propertyType: string;
  reservePrice: string;
  bankName: string;
  location: string;
  address: string;
  state: string;
  city: string;
  district?: string;
  startDate: string;
  endDate: string;
  emdEndDate?: string;
  inspectionStartDate?: string;
  inspectionEndDate?: string;
  detailUrl: string;
  thumbnailUrl?: string;
  photoUrls?: string[];
  status: string;
  regYear?: string;
  fuelType?: string;
  odometer?: string;
  transmission?: string;
  regNo?: string;
  insurancePolicy?: string;
}[] {
  if (typeof (window as any).__name === "undefined") {
    (window as any).__name = (target: any) => target;
  }
  const items: ReturnType<typeof extractVehicleListingCards> = [];

  function matchLenderInline(text: string, lenders: string[]): string {
    for (const lender of lenders) {
      const escaped = lender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(text)) return lender;
    }
    return "";
  }

  function isBankOrGarbage(str: string): boolean {
    if (!str || str.length < 2) return true;
    const lower = str.toLowerCase().trim();
    return (
      lower.includes("bank") ||
      lower.includes("lender") ||
      lower.includes("finance") ||
      lower.includes("showing") ||
      lower.includes("result") ||
      lower.includes("filter")
    );
  }

  const cards = document.querySelectorAll(
    ".infinite-scroll-component > div > div, .card, [class*='vehicle-card'], [class*='listing'], div[class*='rounded-lg bg-white']"
  );

  cards.forEach((card) => {
    const text = (card as HTMLElement).innerText || "";
    if (text.length < 20 || text.length > 8000) return;
    if (!text.includes("₹") && !text.match(/(?:Reserve|Vehicle|Sale|Asset|Auction|Lac|Cr|Lakh)/i)) return;

    const detailLink = card.querySelector(
      'a[href*="vehicle-detail"], a[href*="view"], a[href*="detail"], button'
    ) as HTMLAnchorElement | null;
    let detailUrl = detailLink?.href || detailLink?.getAttribute("href") || "";

    const idMatch = text.match(/Asset\s*ID\s*:?\s*([A-Za-z0-9_-]+)/i);
    const urlIdMatch = detailUrl.match(/vehicle-detail\/([A-Za-z0-9_-]+)/i);
    const auctionId = idMatch ? idMatch[1] : (urlIdMatch ? urlIdMatch[1] : "");

    if (!auctionId && !detailUrl.includes("vehicle")) return;
    const finalId = auctionId || `VEH_${Math.abs(text.slice(0, 30).split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`;

    const titleEl = card.querySelector("h6, h5, h4, h3, [class*='title'], strong") as HTMLElement;
    let title = titleEl?.innerText?.trim() || "";
    if (!title || title.toLowerCase().startsWith("showing") || title.includes("Results")) {
      const firstLine = text.split("\n").filter(l => l.trim().length > 5 && !l.includes("Results") && !l.includes("Asset ID"))[0];
      title = firstLine || "Bank Auction Vehicle";
    }

    const priceMatch = text.match(/(?:Reserve\s*Price|Price)\s*:?\s*(?:₹|Rs\.?)?\s*([\d,.]+\s*(?:Lakh|Crore|Lac|Cr)?)/i) ||
      text.match(/₹\s*([\d,.]+\s*(?:Lakh?|Lac|Crore?|Cr)?)/i) ||
      text.match(/([\d,.]+\s*(?:Lac|Lakh|Cr|Crore))/i);
    const reservePrice = priceMatch ? `₹ ${priceMatch[1]}` : "";

    let bankName = matchLenderInline(text, knownLenders);
    if (!bankName) {
      const bankMatch = text.match(/(?:Bank\s*of\s*[A-Za-z]+|State\s*Bank\s*of\s*India|Punjab\s*National\s*Bank|Canara\s*Bank|Union\s*Bank|Indian\s*Bank|UCO\s*Bank|Central\s*Bank)/i);
      bankName = bankMatch ? bankMatch[0].trim() : "";
    }

    // Vehicle Specifications
    const regYearMatch = text.match(/Registration\s*Year\s*:?\s*(\d{4})/i);
    const regYear = regYearMatch ? regYearMatch[1] : undefined;

    const fuelMatch = text.match(/Fuel\s*Type\s*:?\s*(Diesel|Petrol|CNG|Electric|LPG|Hybrid)/i);
    const fuelType = fuelMatch ? fuelMatch[1] : undefined;

    const odoMatch = text.match(/Odometer\s*:?\s*([\d,.]+\s*(?:km|kms)?|NA)/i);
    const odometer = odoMatch ? odoMatch[1] : undefined;

    const transMatch = text.match(/Transmission\s*:?\s*(Manual|Automatic|Other)/i);
    const transmission = transMatch ? transMatch[1] : undefined;

    const regNoMatch = text.match(/Registration\s*No\.?\s*:?\s*([A-Za-z0-9*_-]+)/i);
    const regNo = regNoMatch ? regNoMatch[1] : undefined;

    const insMatch = text.match(/Insurance\s*(?:Policy)?\s*:?\s*(Yes|No|Expired|Valid)/i);
    const insurancePolicy = insMatch ? insMatch[1] : undefined;

    // Location extraction
    const locMatch = text.match(/(?:Gorakhpur|Mumbai|Delhi|Bengaluru|Chennai|Kolkata|Hyderabad|Pune|Ahmedabad|Ernakulam|Raigarh|Bilaspur|Ratlam|Lucknow|Jaipur|Surat|Kanpur|Nagpur|Indore|Thane|Bhopal|Visakhapatnam|Pimpri|Patna|Vadodara|Ghaziabad|Ludhiana|Agra|Nashik|Faridabad|Meerut|Rajkot|Kalyan|Vasai|Varanasi|Srinagar|Aurangabad|Dhanbad|Amritsar|Navi Mumbai|Allahabad|Ranchi|Howrah|Coimbatore|Jabalpur|Gwalior|Vijayawada|Jodhpur|Madurai|Raipur|Kota|Guwahati|Chandigarh)[A-Za-z,\s]+?(?=\n|Contact|View|$)/i);
    let location = locMatch ? locMatch[0].trim() : "";
    let state = "";
    let city = "";
    let district = "";

    if (location) {
      const parts = location.split(/[,–-]/).map((p: string) => p.trim()).filter((p: string) => !isBankOrGarbage(p));
      if (parts.length >= 3) {
        city = parts[0];
        district = parts[1];
        state = parts[2];
      } else if (parts.length === 2) {
        city = parts[0];
        state = parts[1];
      } else if (parts.length === 1) {
        city = parts[0];
      }
    }

    // Schedule dates
    const startMatch = text.match(/(?:Auction\s*Start|Start)\s*(?:Date\s*(?:&\s*Time)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);
    const endMatch = text.match(/(?:Auction\s*End|End)\s*(?:Date\s*(?:&?\s*[Tt]ime)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);
    const emdMatch = text.match(/EMD\s*End\s*(?:Date\s*(?:&?\s*[Tt]ime)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);
    const inspStartMatch = text.match(/Inspection\s*Start\s*(?:Date\s*(?:&\s*Time)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);
    const inspEndMatch = text.match(/Inspection\s*End\s*(?:Date\s*(?:&?\s*[Tt]ime)?)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);

    // Photos
    const imgs = card.querySelectorAll("img");
    const photoUrls: string[] = [];
    imgs.forEach((img) => {
      const htmlImg = img as HTMLImageElement;
      const src = htmlImg.src || htmlImg.getAttribute("data-src") || htmlImg.getAttribute("data-lazy") || "";
      if (src && !src.endsWith(".svg") && !src.includes("icon") && !src.includes("logo") && !photoUrls.includes(src)) {
        photoUrls.push(src);
      }
    });

    const statusBadge = card.querySelector("[class*='badge'], [class*='text-white'][class*='rounded'], [class*='Upcoming']") as HTMLElement;
    const status = statusBadge?.innerText?.trim().toUpperCase() || "UPCOMING";

    // Detect vehicle type
    let propertyType = "Commercial Vehicle";
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("car") || lowerTitle.includes("alto") || lowerTitle.includes("altroz") || lowerTitle.includes("sedan") || lowerTitle.includes("hatchback") || lowerTitle.includes("swift") || lowerTitle.includes("creta")) {
      propertyType = "Four Wheeler / Car";
    } else if (lowerTitle.includes("bike") || lowerTitle.includes("motorcycle") || lowerTitle.includes("scooter") || lowerTitle.includes("hero") || lowerTitle.includes("honda") || lowerTitle.includes("royal enfield")) {
      propertyType = "Two Wheeler / Bike";
    } else if (lowerTitle.includes("tractor") || lowerTitle.includes("mahindra") || lowerTitle.includes("sonalika") || lowerTitle.includes("swaraj")) {
      propertyType = "Tractor / Agricultural";
    } else if (lowerTitle.includes("truck") || lowerTitle.includes("blazo") || lowerTitle.includes("leyland") || lowerTitle.includes("bharatbenz") || lowerTitle.includes("tata 1212") || lowerTitle.includes("trailer")) {
      propertyType = "Commercial / Truck";
    } else if (lowerTitle.includes("bus")) {
      propertyType = "Commercial / Bus";
    }

    items.push({
      auctionId: finalId,
      bankPropertyId: finalId,
      title,
      propertyType,
      reservePrice,
      bankName: bankName || "Public Sector Bank",
      location: location || state || city || "India",
      address: location,
      state,
      city,
      district,
      startDate: startMatch ? startMatch[1] : "",
      endDate: endMatch ? endMatch[1] : "",
      emdEndDate: emdMatch ? emdMatch[1] : undefined,
      inspectionStartDate: inspStartMatch ? inspStartMatch[1] : undefined,
      inspectionEndDate: inspEndMatch ? inspEndMatch[1] : undefined,
      detailUrl,
      thumbnailUrl: photoUrls[0] || "",
      photoUrls,
      status,
      regYear,
      fuelType,
      odometer,
      transmission,
      regNo,
      insurancePolicy,
    });
  });

  return items;
}

export function extractIBCListingCards(knownLenders: string[] = []): {
  auctionId: string;
  bankPropertyId?: string;
  title: string;
  propertyType?: string;
  reservePrice: string;
  emdAmountText?: string;
  bidIncrementText?: string;
  bankName: string;
  location: string;
  address?: string;
  state?: string;
  city?: string;
  district?: string;
  contactPerson?: string;
  officerDesignation?: string;
  startDate: string;
  endDate: string;
  detailUrl: string;
  status: string;
  corporateDebtorName?: string;
  corporateDebtorCin?: string;
  liquidatorRegNo?: string;
  liquidatorEmail?: string;
  ncltBench?: string;
  ncltCaseNo?: string;
  processMemoUrl?: string;
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

    // 1. Clean Numeric Asset ID
    let rawId = "";
    const idDigitsMatch = text.match(/(?:Asset|Auction|Sale|ID|No\.?)\s*(?:ID|No\.?|Code)?\s*:?\s*(\d+)/i);
    const idAlphaNumMatch = text.match(/(?:Asset|Auction|Sale|ID|No\.?)\s*(?:ID|No\.?|Code)?\s*:?\s*([A-Za-z0-9_-]+)/i);
    if (idDigitsMatch) {
      rawId = idDigitsMatch[1];
    } else if (idAlphaNumMatch) {
      rawId = idAlphaNumMatch[1].replace(/(?:Asset|Classification|Fixed|Location|IP|Reserve).*$/i, "");
    }
    const urlIdMatch = detailUrl.match(/(?:asset|id|view)[/=]([A-Za-z0-9_-]+)/i);
    const auctionId = rawId || (urlIdMatch ? urlIdMatch[1] : "");

    if (!auctionId && !detailUrl.includes("asset")) return;
    const finalId = auctionId || `IBC_${Math.abs(text.slice(0, 30).split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`;

    // 2. Asset Classification / Type
    let classification = "";
    const classMatch = text.match(/Asset\s*Classification\s*:?\s*([A-Za-z0-9\s&,/-]+?)(?=Fixed|Asset|Location|IP|Liquidator|Reserve|EMD|Price|Contact|$)/i);
    if (classMatch) {
      classification = classMatch[1].replace(/Contact\s*Us/i, "").trim();
    }

    // 3. Location / Address
    let locationStr = "";
    const locMatch = text.match(/(?:Fixed\s*Asset\s*Location|Asset\s*Location|Location)\s*:?\s*([A-Za-z0-9\s&,/-]+?)(?=IP|Liquidator|RP|Reserve|EMD|Price|Contact|Classification|$)/i);
    if (locMatch) {
      locationStr = locMatch[1].replace(/Contact\s*Us/i, "").trim();
    }

    // Split location into state, city, district
    let state = "";
    let city = "";
    let district = "";
    if (locationStr) {
      const parts = locationStr.split(/[,–-]/).map((p: string) => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        state = parts[0];
        city = parts[1];
        district = parts[2];
      } else if (parts.length === 2) {
        state = parts[0];
        city = parts[1];
      } else if (parts.length === 1) {
        state = parts[0];
      }
    }

    // 4. IP / Liquidator Name
    let ipName = "";
    const ipMatch = text.match(/(?:IP\s*Name|Liquidator\s*Name|Liquidator|RP\s*Name|IP)\s*:?\s*([A-Za-z0-9\s.,-]+?)(?=Contact|Email|Phone|Reserve|EMD|Price|Asset|$)/i);
    if (ipMatch) {
      ipName = ipMatch[1].replace(/Contact\s*Us/i, "").trim();
    }

    // 5. Title
    let title = "";
    if (classification) {
      const locSuffix = city ? ` in ${city}, ${state}` : (locationStr ? ` in ${locationStr}` : "");
      title = `${classification}${locSuffix}`;
    } else {
      const titleEl = card.querySelector("h3, h4, h5, [class*='title'], strong, b, td:first-child") as HTMLElement;
      const rawTitle = titleEl?.innerText?.trim() || "";
      if (rawTitle && !rawTitle.includes("Asset ID") && !rawTitle.includes("Asset Classification")) {
        title = rawTitle;
      } else {
        title = locationStr ? `Insolvency Asset in ${locationStr}` : "IBC Auction Asset";
      }
    }

    // 6. Financial & Bidding Details
    const priceMatch = text.match(/(?:Reserve\s*Price|Price)\s*:?\s*(?:₹|Rs\.?)?\s*([\d,.]+\s*(?:Lakh|Crore|Lac|Cr)?)/i) ||
      text.match(/₹\s*([\d,.]+\s*(?:Lakh?|Lac|Crore?|Cr)?)/i);
    const emdMatch = text.match(/(?:EMD|Earnest\s*Money)\s*(?:Amount)?\s*:?\s*(?:₹|Rs\.?)?\s*([\d,.]+\s*(?:Lakh|Crore|Lac|Cr)?)/i);
    const incMatch = text.match(/(?:Bid\s*Increment|Increment\s*Amount|Step)\s*:?\s*(?:₹|Rs\.?)?\s*([\d,.]+\s*(?:Lakh|Crore|Lac|Cr)?)/i);

    let bankName = matchLenderInline(text, knownLenders);
    if (!bankName) {
      const bankMatch = text.match(/(?:Bank|Institution|Creditor|Lender)\s*:?\s*([A-Za-z\s]+?)(?=\n|IP|Liquidator|$)/i);
      bankName = bankMatch ? bankMatch[1].trim() : "NCLT / IBBI Insolvency";
    }

    const startMatch = text.match(/(?:Start|Auction\s*Start)\s*(?:Date)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);
    const endMatch = text.match(/(?:End|Auction\s*End|Closing)\s*(?:Date)?\s*:?\s*([\d\-/]+\s+[\d:]+)/i);

    let corporateDebtorName = "";
    const cdMatch = text.match(/(?:Corporate\s*Debtor|Company|CD\s*Name)\s*:?\s*([^\n]{3,80})/i);
    if (cdMatch) corporateDebtorName = cdMatch[1].trim();

    let corporateDebtorCin = "";
    const cinMatch = text.match(/\b([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/);
    if (cinMatch) corporateDebtorCin = cinMatch[1].trim().toUpperCase();

    let liquidatorRegNo = "";
    const ipRegMatch = text.match(/(IBBI\/IPA-[A-Za-z0-9\/\-_]+)/i);
    if (ipRegMatch) liquidatorRegNo = ipRegMatch[1].trim();

    let liquidatorEmail = "";
    const liqEmailMatch = text.match(/(?:Liquidator|RP|IP)?\s*(?:Email|Mail)?\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (liqEmailMatch) liquidatorEmail = liqEmailMatch[1].trim();

    let ncltBench = "";
    const ncltBenchMatch = text.match(/(NCLT\s*[A-Za-z\s]+(?:Bench)?(?:\s*-\s*[A-Z0-9]+)?)/i);
    if (ncltBenchMatch) ncltBench = ncltBenchMatch[1].trim();

    let ncltCaseNo = "";
    const ncltCaseMatch = text.match(/((?:CP|CA)\s*(?:\(IB\))?\s*(?:No\.?)?\s*[\d\/\w-]+)/i);
    if (ncltCaseMatch) ncltCaseNo = ncltCaseMatch[1].trim();

    let processMemoUrl = "";
    const memoLink = card.querySelector('a[href*="process-memo"], a[href*="memo"], a[href*="form-g"]') as HTMLAnchorElement | null;
    if (memoLink && memoLink.href) processMemoUrl = memoLink.href;

    items.push({
      auctionId: finalId,
      bankPropertyId: finalId,
      title: title || "IBC Auction Asset",
      propertyType: classification || "Insolvency Asset",
      reservePrice: priceMatch ? `₹ ${priceMatch[1]}` : "",
      emdAmountText: emdMatch ? `₹ ${emdMatch[1]}` : undefined,
      bidIncrementText: incMatch ? `₹ ${incMatch[1]}` : undefined,
      bankName: bankName || "NCLT / IBBI Insolvency",
      location: locationStr || state || "India",
      address: locationStr,
      state,
      city,
      district,
      contactPerson: ipName || undefined,
      officerDesignation: ipName ? "Insolvency Professional / Liquidator" : undefined,
      startDate: startMatch ? startMatch[1] : "",
      endDate: endMatch ? endMatch[1] : "",
      detailUrl,
      status: "UPCOMING",
      corporateDebtorName: corporateDebtorName || undefined,
      corporateDebtorCin: corporateDebtorCin || undefined,
      liquidatorRegNo: liquidatorRegNo || undefined,
      liquidatorEmail: liquidatorEmail || undefined,
      ncltBench: ncltBench || undefined,
      ncltCaseNo: ncltCaseNo || undefined,
      processMemoUrl: processMemoUrl || undefined,
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
    bidIncrementText?: string;
    emdAccountNumber?: string;
    emdAccountIfsc?: string;
    emdBankName?: string;
    outstandingDuesText?: string;
    tenderFeeText?: string;
    cersaiId?: string;
    titleType?: string;
    encumbrancesText?: string;
    branchName?: string;
    officerDesignation?: string;
    officerEmail?: string;
    contactPerson?: string;
    contactPhone?: string;
    bankName?: string;
    photoUrls?: string[];
    thumbnailUrl?: string;
    latitude?: number | null;
    longitude?: number | null;
    mapUrl?: string;
    boundaries?: { north?: string; south?: string; east?: string; west?: string };
    corporateDebtorName?: string;
    corporateDebtorCin?: string;
    liquidatorRegNo?: string;
    liquidatorEmail?: string;
    ncltBench?: string;
    ncltCaseNo?: string;
    processMemoUrl?: string;
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
  if (!item.bidIncrementText && detail.bidIncrementText) {
    item.bidIncrementText = detail.bidIncrementText;
  }
  if (!item.emdAccountNumber && detail.emdAccountNumber) {
    item.emdAccountNumber = detail.emdAccountNumber;
  }
  if (!item.emdAccountIfsc && detail.emdAccountIfsc) {
    item.emdAccountIfsc = detail.emdAccountIfsc;
  }
  if (!item.emdBankName && detail.emdBankName) {
    item.emdBankName = detail.emdBankName;
  }
  if (!item.outstandingDuesText && detail.outstandingDuesText) {
    item.outstandingDuesText = detail.outstandingDuesText;
  }
  if (!item.tenderFeeText && detail.tenderFeeText) {
    item.tenderFeeText = detail.tenderFeeText;
  }
  if (!item.cersaiId && detail.cersaiId) {
    item.cersaiId = detail.cersaiId;
  }
  if (!item.titleType && detail.titleType) {
    item.titleType = detail.titleType;
  }
  if (!item.encumbrancesText && detail.encumbrancesText) {
    item.encumbrancesText = detail.encumbrancesText;
  }
  if (!item.branchName && detail.branchName) {
    item.branchName = detail.branchName;
  }
  if (!item.officerDesignation && detail.officerDesignation) {
    item.officerDesignation = detail.officerDesignation;
  }
  if (!item.officerEmail && detail.officerEmail) {
    item.officerEmail = detail.officerEmail;
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
  if (item.latitude === undefined && detail.latitude !== undefined) {
    item.latitude = detail.latitude;
  }
  if (item.longitude === undefined && detail.longitude !== undefined) {
    item.longitude = detail.longitude;
  }
  if (!item.mapUrl && detail.mapUrl) {
    item.mapUrl = detail.mapUrl;
  }
  if (!item.boundaries && detail.boundaries) {
    item.boundaries = detail.boundaries;
  }
  if (!item.corporateDebtorName && detail.corporateDebtorName) {
    item.corporateDebtorName = detail.corporateDebtorName;
  }
  if (!item.corporateDebtorCin && detail.corporateDebtorCin) {
    item.corporateDebtorCin = detail.corporateDebtorCin;
  }
  if (!item.liquidatorRegNo && detail.liquidatorRegNo) {
    item.liquidatorRegNo = detail.liquidatorRegNo;
  }
  if (!item.liquidatorEmail && detail.liquidatorEmail) {
    item.liquidatorEmail = detail.liquidatorEmail;
  }
  if (!item.ncltBench && detail.ncltBench) {
    item.ncltBench = detail.ncltBench;
  }
  if (!item.ncltCaseNo && detail.ncltCaseNo) {
    item.ncltCaseNo = detail.ncltCaseNo;
  }
  if (!item.processMemoUrl && detail.processMemoUrl) {
    item.processMemoUrl = detail.processMemoUrl;
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

/**
 * Pure helper to normalize and deduplicate document URLs outside the browser context.
 */
export function normalizeDocumentUrl(
  rawUrl: string,
  baseOrigin: string = "https://baanknet.com"
): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (
    !trimmed ||
    trimmed.startsWith("javascript:") ||
    trimmed === "#" ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".ico") ||
    lower.endsWith(".css") ||
    lower.endsWith(".js")
  ) {
    return null;
  }

  try {
    let resolved = trimmed;
    if (resolved.startsWith("//")) {
      resolved = `https:${resolved}`;
    } else if (resolved.startsWith("/")) {
      resolved = `${baseOrigin}${resolved}`;
    } else if (!resolved.startsWith("http://") && !resolved.startsWith("https://")) {
      resolved = `${baseOrigin}/${resolved}`;
    }

    const u = new URL(resolved);
    if (u.hostname.includes("baanknet.com") || u.hostname.includes("ibbi.baanknet.com")) {
      u.protocol = "https:";
    }

    let pathname = u.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    u.pathname = pathname;

    const params = new URLSearchParams(u.search);
    const trackingKeys = ["_", "t", "ts", "timestamp", "sessionid", "token", "nocache", "rand"];
    for (const key of Array.from(params.keys())) {
      if (trackingKeys.includes(key.toLowerCase())) {
        params.delete(key);
      }
    }
    params.sort();
    u.search = params.toString() ? `?${params.toString()}` : "";
    u.hash = "";

    return u.toString();
  } catch {
    return null;
  }
}
