/**
 * GeM Download Document Page Parser
 *
 * Extracts document metadata and download action links from the
 * GeM Forward Auction "Download Document" page (/eprocure/eauction-download-document/<id>/...).
 */

export interface GeMDocumentEntry {
  sr_no: string;
  description: string;
  size_mb: string;
  size_bytes?: number;
  approval_date_time?: string;
  status?: string;
  download_url?: string;
  download_action?: string;
}

export interface GeMDocumentPageDetails {
  auction_id?: string;
  reference_no?: string;
  office_zone?: string;
  seller_name?: string;
  auction_brief?: string;
  documents: GeMDocumentEntry[];
  notice_link?: string;
  business_rules_link?: string;
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

export function parseGemDocumentPageHtml(html: string): GeMDocumentPageDetails {
  if (!html || typeof html !== "string") {
    return { documents: [] };
  }

  const extractField = (label: string): string => {
    const patterns = [
      new RegExp(`${label}\\s*[:=-]\\s*([^\\n<]+)`, "i"),
      new RegExp(`${label}[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>`, "i"),
      new RegExp(`${label}[\\s\\S]*?<div[^>]*>([\\s\\S]*?)<\\/div>`, "i"),
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
  const sellerName = extractField("Seller\\s*\\/\\s*Auctioneer\\s*Name");
  const auctionBrief = extractField("Auction\\s*Brief");

  // Navigation Links
  let noticeLink = "";
  const noticeMatch = html.match(/href=["']([^"']*(?:view-auction-notice)[^"']*)["']/i);
  if (noticeMatch) noticeLink = noticeMatch[1];

  let businessRulesLink = "";
  const rulesMatch = html.match(/href=["']([^"']*(?:view-configure-rule)[^"']*)["']/i);
  if (rulesMatch) businessRulesLink = rulesMatch[1];

  // Documents Table
  const documents: GeMDocumentEntry[] = [];
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];

  for (const tableHtml of tableMatches) {
    if (/Document\s*Description|Size\s*\(MB\)|Approval\s*Date|Action/i.test(tableHtml)) {
      const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      for (const row of rows) {
        if (/<th>/i.test(row)) continue; // Skip header
        const cells = row.match(/<td[\s\S]*?<\/td>/gi) || [];
        if (cells.length >= 4) {
          const srNo = cleanText(cells[0]);
          const description = cleanText(cells[1]);
          const sizeMb = cleanText(cells[2]);
          const approvalDateTime = cleanText(cells[3]);
          const status = cells.length >= 5 ? cleanText(cells[4]) : undefined;

          // Extract action / link
          const actionCell = cells[cells.length - 1];
          let downloadUrl = "";
          let downloadAction = "";

          const hrefMatch = actionCell.match(/href=["']([^"']+)["']/i);
          if (hrefMatch && !hrefMatch[1].startsWith("javascript:")) {
            downloadUrl = hrefMatch[1];
          }

          const onclickMatch = actionCell.match(/onclick=["']([^"']+)["']/i);
          if (onclickMatch) {
            downloadAction = onclickMatch[1];
          }

          let sizeBytes: number | undefined;
          const mbVal = parseFloat(sizeMb);
          if (!isNaN(mbVal)) {
            sizeBytes = Math.round(mbVal * 1024 * 1024);
          }

          documents.push({
            sr_no: srNo || String(documents.length + 1),
            description: description || "GeM Forward Auction Document",
            size_mb: sizeMb,
            size_bytes: sizeBytes,
            approval_date_time: approvalDateTime || undefined,
            status: status || "Approved",
            download_url: downloadUrl || undefined,
            download_action: downloadAction || undefined,
          });
        }
      }
    }
  }

  return {
    auction_id: auctionId || undefined,
    reference_no: referenceNo || undefined,
    office_zone: officeZone || undefined,
    seller_name: sellerName || undefined,
    auction_brief: auctionBrief || undefined,
    documents,
    notice_link: noticeLink || undefined,
    business_rules_link: businessRulesLink || undefined,
  };
}
