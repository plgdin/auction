/**
 * GeM Notice Text Parser
 *
 * Extracts structured data from GeM notice PDF text content.
 * This parser processes the text extracted from the HTML-to-PDF notice documents
 * we generate, providing deeper intelligence than the raw HTML parser alone.
 *
 * Extracts:
 *   - Bill of Quantities (BOQ) items
 *   - Technical specifications (brand, model, year)
 *   - Payment and delivery terms
 *   - Inspection details
 *   - Warranty information
 */

import { logger } from "../../utils/common/logger.js";

const log = logger.child({ module: "gemNoticeTextParser" });

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BoqItem {
  serialNo: string;
  itemName: string;
  quantity: string;
  unit: string;
  purchasedYear: string | null;
  brandName: string | null;
  specifications: string | null;
}

export interface GeMNoticeIntelligence {
  boqItems: BoqItem[];
  technicalSpecs: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  inspectionDate: string | null;
  inspectionLocation: string | null;
  inspectionContact: string | null;
  warrantyInfo: string | null;
  packagingRequirements: string | null;
  additionalConditions: string[];
  contactNames: string[];
  contactPhones: string[];
  contactEmails: string[];
}

// ─── BOQ Extraction ─────────────────────────────────────────────────────────

/**
 * Extract Bill of Quantities items from tabular text content.
 * GeM BOQ tables typically have columns: S.No, Item Name, Qty, Unit, Year, Brand
 */
function extractBoqItems(text: string): BoqItem[] {
  const items: BoqItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Find table header to identify column positions
  let tableStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (
      (lower.includes("item") && (lower.includes("qty") || lower.includes("quantity"))) ||
      (lower.includes("s.no") && lower.includes("name"))
    ) {
      tableStartIndex = i + 1;
      break;
    }
  }

  if (tableStartIndex < 0) {
    // If no explicit table header found, look for any line starting with "1." or "1 " followed by item text
    for (let i = 0; i < lines.length; i++) {
      if (/^(?:1[.)]\s+|1\s+)[A-Z]{3,}/i.test(lines[i])) {
        tableStartIndex = i;
        break;
      }
    }
  }

  if (tableStartIndex < 0) return items;

  // Parse rows after header
  for (let i = tableStartIndex; i < lines.length && items.length < 100; i++) {
    const line = lines[i];

    // Pattern 1: Standard row: "1 Item description text 100 Nos 2020 Brand XYZ"
    const rowMatch1 = line.match(
      /^(\d{1,3})[.)]?\s+(.{3,120}?)\s+(\d[\d,.]*)\s*(nos|pcs|kg|mt|ton|lot|set|unit|pair|ltr|kl|mtr|sqm|sqft|each)?(?:\s+|$)/i
    );

    // Pattern 2: Military / Central Govt format: "1. WIRE CUTTER KG 1" or "2. PICKET ALL SIZE NOS 164"
    const rowMatch2 = line.match(
      /^(\d{1,3})[.)]?\s+(.{3,120}?)\s+(nos|pcs|kg|mt|ton|lot|set|unit|pair|ltr|kl|mtr|sqm|sqft|each)\s+(\d[\d,.]*)(?:\s+|$)/i
    );

    if (rowMatch2) {
      const item: BoqItem = {
        serialNo: rowMatch2[1],
        itemName: rowMatch2[2].trim(),
        quantity: rowMatch2[4].replace(/,/g, ""),
        unit: (rowMatch2[3] || "nos").toLowerCase(),
        purchasedYear: null,
        brandName: null,
        specifications: null,
      };
      items.push(item);
    } else if (rowMatch1) {
      const item: BoqItem = {
        serialNo: rowMatch1[1],
        itemName: rowMatch1[2].trim(),
        quantity: rowMatch1[3].replace(/,/g, ""),
        unit: (rowMatch1[4] || "nos").toLowerCase(),
        purchasedYear: null,
        brandName: null,
        specifications: null,
      };

      // Try to extract year (4-digit year in the remainder)
      const remainder = line.substring(rowMatch1[0].length);
      const yearMatch = remainder.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        item.purchasedYear = yearMatch[0];
      }

      // Try to extract brand from remainder or next line
      const brandMatch = remainder.match(/(?:brand|make)\s*:?\s*([A-Za-z0-9\s&.-]{3,40})/i);
      if (brandMatch) {
        item.brandName = brandMatch[1].trim();
      } else if (i + 1 < lines.length && !lines[i + 1].match(/^\d{1,3}[.)]?\s/)) {
        // Next line might be brand/specs continuation
        const nextLine = lines[i + 1];
        if (nextLine.length < 80 && !nextLine.match(/total|grand|sub\s*total/i)) {
          item.specifications = nextLine.trim();
          i++; // Skip the consumed line
        }
      }

      items.push(item);
    }
  }

  return items;
}

// ─── Section Extraction ─────────────────────────────────────────────────────

/**
 * Extract a labeled section's content from document text.
 */
function extractSection(text: string, ...sectionLabels: string[]): string | null {
  for (const label of sectionLabels) {
    const pattern = new RegExp(
      `${label}\\s*:?\\s*([\\s\\S]{10,500}?)(?=\\n\\s*\\n|\\n\\s*(?:[A-Z][a-z]+\\s+[A-Z]|\\d+\\.|$))`,
      "i"
    );
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/\s+/g, " ").trim();
      if (cleaned.length > 10) return cleaned;
    }
  }
  return null;
}

// ─── Contact Extraction ─────────────────────────────────────────────────────

function extractContacts(text: string): {
  names: string[];
  phones: string[];
  emails: string[];
} {
  const names: string[] = [];
  const phones: string[] = [];
  const emails: string[] = [];

  // Phone numbers (Indian mobile)
  const phoneRegex = /\b([6-9]\d{9})\b/g;
  let phoneMatch;
  while ((phoneMatch = phoneRegex.exec(text)) !== null) {
    if (!phones.includes(phoneMatch[1])) phones.push(phoneMatch[1]);
  }

  // Emails (exclude system/support emails)
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let emailMatch;
  while ((emailMatch = emailRegex.exec(text)) !== null) {
    const email = emailMatch[1].toLowerCase();
    if (
      !email.includes("helpdesk") &&
      !email.includes("support") &&
      !email.includes("noreply") &&
      !email.includes("gem.gov") &&
      !emails.includes(email)
    ) {
      emails.push(email);
    }
  }

  // Named contacts
  const namePattern =
    /(?:contact\s*person|officer|auctioneer|seller)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g;
  let nameMatch;
  while ((nameMatch = namePattern.exec(text)) !== null) {
    const name = nameMatch[1].trim();
    if (name.length > 3 && !names.includes(name)) names.push(name);
  }

  return { names, phones, emails };
}

// ─── Main Parser ────────────────────────────────────────────────────────────

/**
 * Parse deep intelligence from GeM notice PDF text.
 */
export function parseGemNoticeText(text: string): GeMNoticeIntelligence {
  const result: GeMNoticeIntelligence = {
    boqItems: [],
    technicalSpecs: null,
    paymentTerms: null,
    deliveryTerms: null,
    inspectionDate: null,
    inspectionLocation: null,
    inspectionContact: null,
    warrantyInfo: null,
    packagingRequirements: null,
    additionalConditions: [],
    contactNames: [],
    contactPhones: [],
    contactEmails: [],
  };

  if (!text || text.trim().length < 50) return result;

  // 1. BOQ items
  result.boqItems = extractBoqItems(text);

  // 2. Technical specifications
  result.technicalSpecs = extractSection(
    text,
    "technical specification",
    "specifications",
    "technical details",
    "item specification"
  );

  // 3. Payment terms
  result.paymentTerms = extractSection(
    text,
    "payment term",
    "payment condition",
    "mode of payment",
    "payment schedule"
  );

  // 4. Delivery terms
  result.deliveryTerms = extractSection(
    text,
    "delivery term",
    "delivery condition",
    "delivery schedule",
    "lifting period"
  );

  // 5. Inspection details
  const inspDateMatch = text.match(
    /(?:inspection|viewing)\s*(?:date|period|time)\s*:?\s*([\d\-/]+\s*(?:to\s*[\d\-/]+)?)/i
  );
  if (inspDateMatch) result.inspectionDate = inspDateMatch[1].trim();

  const inspLocMatch = text.match(
    /(?:inspection|viewing)\s*(?:location|place|venue|address)\s*:?\s*([^\n]{10,100})/i
  );
  if (inspLocMatch) result.inspectionLocation = inspLocMatch[1].trim();

  const inspContactMatch = text.match(
    /(?:inspection|viewing)\s*(?:contact|officer)\s*:?\s*([^\n]{5,60})/i
  );
  if (inspContactMatch) result.inspectionContact = inspContactMatch[1].trim();

  // 6. Warranty
  result.warrantyInfo = extractSection(
    text,
    "warranty",
    "guarantee",
    "defect liability"
  );

  // 7. Packaging
  result.packagingRequirements = extractSection(
    text,
    "packaging",
    "packing requirement",
    "packing instruction"
  );

  // 8. Additional conditions
  const condPattern = /(?:additional\s*condition|special\s*condition|other\s*condition)\s*:?\s*([^\n]{10,200})/gi;
  let condMatch;
  while ((condMatch = condPattern.exec(text)) !== null) {
    result.additionalConditions.push(condMatch[1].trim());
  }

  // 9. Contacts
  const contacts = extractContacts(text);
  result.contactNames = contacts.names;
  result.contactPhones = contacts.phones;
  result.contactEmails = contacts.emails;

  return result;
}
