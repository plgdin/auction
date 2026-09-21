/**
 * GeM Business Rules HTML Parser
 *
 * Extracts vital financial, scheduling, and seller intelligence from the
 * GeM Forward Auction "Business Rules" page (/eprocure/view-configure-rule/<id>/...).
 *
 * Captures authoritative Opening Price (Reserve Price), Minimum Bid Increment,
 * Auto-Extension rules, Reference Number, and Office/Zone hierarchy.
 */

export interface GeMBusinessRuleItem {
  sr_no: string;
  item_name: string;
  opening_price_text: string;
  opening_price_value: number | null;
  increment_price_text: string;
  increment_price_value: number | null;
  extension_increment_price_text?: string;
  extension_increment_price_value?: number | null;
}

export interface GeMBusinessRules {
  auction_id?: string;
  reference_no?: string;
  office_zone?: string;
  seller_name?: string;
  seller_role?: string;
  auto_extension?: string;
  auto_extension_mode?: string;
  auction_method?: string;
  auction_brief?: string;
  auction_start_date?: string | null;
  auction_end_date?: string | null;
  extend_time_last_bid_min?: number | null;
  extend_time_by_min?: number | null;
  opening_price_value?: number | null;
  opening_price_text?: string;
  bid_increment_amount?: number | null;
  bid_increment_text?: string;
  items: GeMBusinessRuleItem[];
  notice_link?: string;
  download_doc_link?: string;
}

function cleanText(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIndianCurrency(valStr?: string | null): number | null {
  if (!valStr) return null;
  const cleaned = valStr.replace(/[^0-9.]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseGeMDateTime(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const cleaned = cleanText(dateStr);
  // Match "DD/MM/YYYY HH:mm" or "DD-MM-YYYY HH:mm"
  const match = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  const hour = match[4] ? parseInt(match[4], 10) : 0;
  const min = match[5] ? parseInt(match[5], 10) : 0;
  const sec = match[6] ? parseInt(match[6], 10) : 0;

  const d = new Date(Date.UTC(year, month, day, hour - 5, min - 30, sec)); // IST is UTC+5:30
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseGemBusinessRulesHtml(html: string): GeMBusinessRules {
  if (!html || typeof html !== "string") {
    return { items: [] };
  }

  const extractField = (label: string): string => {
    // 1. Label with colon or inside table/div structure
    const patterns = [
      new RegExp(`${label}\\s*[:=-]\\s*([^\\n<]+)`, "i"),
      new RegExp(`${label}[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>`, "i"),
      new RegExp(`${label}[\\s\\S]*?<div[^>]*>([\\s\\S]*?)<\\/div>`, "i"),
      new RegExp(`${label}[\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>`, "i"),
      new RegExp(`${label}[\\s\\S]*?<label[^>]*>([\\s\\S]*?)<\\/label>`, "i"),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && cleanText(match[1])) {
        return cleanText(match[1]);
      }
    }
    return "";
  };

  const auctionId = extractField("Auction ID");
  const referenceNo = extractField("Reference No\\.?");
  const officeZone = extractField("Office\\s*\\/\\s*Zone");
  const rawSeller = extractField("Seller\\s*\\/\\s*Auctioneer\\s*Name");
  let sellerName = rawSeller;
  let sellerRole = "Auctioneer";
  if (rawSeller.includes("-")) {
    const parts = rawSeller.split("-");
    sellerName = parts[0].trim();
    sellerRole = parts.slice(1).join("-").trim() || "Auctioneer";
  }

  const autoExtension = extractField("Auto\\s*Extension");
  const autoExtensionMode = extractField("Auto\\s*Extension\\s*Mode");
  const auctionMethod = extractField("Auction\\s*Method");
  const auctionBrief = extractField("Auction\\s*Brief");

  const startStr = extractField("Auction Start Date & Time") || extractField("Start Date & Time");
  const endStr = extractField("Auction End Date & Time") || extractField("End Date & Time");
  const auctionStartDate = parseGeMDateTime(startStr);
  const auctionEndDate = parseGeMDateTime(endStr);

  const lastBidExtendStr = extractField("Extend Time When Valid Bid Received in Last\\(In Minutes\\)") ||
                           extractField("Extend Time When Valid Bid Received");
  const extendByStr = extractField("Extend Time By \\(In Minutes\\)") ||
                      extractField("Extend Time By");

  const extendTimeLastBidMin = lastBidExtendStr ? parseInt(lastBidExtendStr.replace(/\D/g, ""), 10) || null : null;
  const extendTimeByMin = extendByStr ? parseInt(extendByStr.replace(/\D/g, ""), 10) || null : null;

  // Extract navigation links on the business rules page
  let noticeLink = "";
  const noticeMatch = html.match(/href=["']([^"']*(?:view-auction-notice)[^"']*)["']/i);
  if (noticeMatch) noticeLink = noticeMatch[1];

  let downloadDocLink = "";
  const docMatch = html.match(/href=["']([^"']*(?:eauction-download-document)[^"']*)["']/i);
  if (docMatch) downloadDocLink = docMatch[1];

  // Extract Items Table (Opening Price, Increment Price)
  const items: GeMBusinessRuleItem[] = [];
  let totalOpeningPrice = 0;
  let minIncrement: number | null = null;

  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const tableHtml of tableMatches) {
    if (/items?\s*name|Opening\s*Price|Increment\s*Price/i.test(tableHtml)) {
      const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      for (const row of rows) {
        if (/<th>/i.test(row)) continue; // Skip header row
        const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || []).map(cleanText);
        if (cells.length >= 4) {
          const srNo = cells[0] || String(items.length + 1);
          const itemName = cells[1];
          const openingPriceText = cells[2];
          const incrementPriceText = cells[3];
          const extIncrementPriceText = cells[4] || cells[3];

          const openingPriceVal = parseIndianCurrency(openingPriceText);
          const incrementPriceVal = parseIndianCurrency(incrementPriceText);
          const extIncrementVal = parseIndianCurrency(extIncrementPriceText);

          if (openingPriceVal !== null) {
            totalOpeningPrice += openingPriceVal;
          }
          if (incrementPriceVal !== null) {
            if (minIncrement === null || incrementPriceVal < minIncrement) {
              minIncrement = incrementPriceVal;
            }
          }

          items.push({
            sr_no: srNo,
            item_name: itemName,
            opening_price_text: openingPriceText,
            opening_price_value: openingPriceVal,
            increment_price_text: incrementPriceText,
            increment_price_value: incrementPriceVal,
            extension_increment_price_text: extIncrementPriceText,
            extension_increment_price_value: extIncrementVal,
          });
        }
      }
    }
  }

  const openingPriceValue = totalOpeningPrice > 0 ? totalOpeningPrice : (items[0]?.opening_price_value ?? null);
  const openingPriceText = openingPriceValue !== null
    ? `₹${openingPriceValue.toLocaleString("en-IN")}`
    : (items[0]?.opening_price_text ?? undefined);

  const bidIncrementAmount = minIncrement ?? (items[0]?.increment_price_value ?? null);
  const bidIncrementText = bidIncrementAmount !== null
    ? `₹${bidIncrementAmount.toLocaleString("en-IN")}`
    : (items[0]?.increment_price_text ?? undefined);

  return {
    auction_id: auctionId || undefined,
    reference_no: referenceNo || undefined,
    office_zone: officeZone || undefined,
    seller_name: sellerName || undefined,
    seller_role: sellerRole || undefined,
    auto_extension: autoExtension || undefined,
    auto_extension_mode: autoExtensionMode || undefined,
    auction_method: auctionMethod || undefined,
    auction_brief: auctionBrief || undefined,
    auction_start_date: auctionStartDate,
    auction_end_date: auctionEndDate,
    extend_time_last_bid_min: extendTimeLastBidMin,
    extend_time_by_min: extendTimeByMin,
    opening_price_value: openingPriceValue,
    opening_price_text: openingPriceText,
    bid_increment_amount: bidIncrementAmount,
    bid_increment_text: bidIncrementText,
    items,
    notice_link: noticeLink || undefined,
    download_doc_link: downloadDocLink || undefined,
  };
}
