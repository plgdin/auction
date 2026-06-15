/**
 * MSTC catalog PDF text parser.
 *
 * Extracts structured auction metadata (contacts, EMD, lots, eligibility)
 * from the raw text content of MSTC e-commerce catalog PDFs.
 */
import {
  DEFAULT_MSTC_OFFICER,
  DEFAULT_CONTACT_EMAIL,
  ADMIN_CHARGES,
} from "../config.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CatalogItem {
  sr: number | string;
  description: string;
  qty: string;
  unit: string;
  taxRate: string;
  attachments?: string[];
  images?: string[];
}

export interface KeyContact {
  role: string;
  name: string;
  email: string;
}

export interface DepositDetails {
  emd: string;
  preBidDdg: string;
  adminCharges: string;
}

export interface CatalogSummary {
  overview: string;
  scopeOfWork: string;
  items: CatalogItem[];
  eligibility: string[];
  depositDetails: DepositDetails;
  keyContacts: KeyContact[];
  preview_image_url?: string | null;
  extracted_images?: string[];
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse MSTC catalog PDF text into a structured summary object.
 */
export function parseMstcCatalogText(
  text: string,
  categoryName: string,
  sellerName: string,
  location: string,
): CatalogSummary {
  const lines = text.split("\n").map((l) => l.trim());
  const cleanText = lines.join("\n");

  // 1. Extract Seller / Site Contact Details
  let contactName = "";
  let contactEmail = "";
  let contactPhone = "";

  const contactMatch = cleanText.match(/Contact Person:\s*([^\n]+)/);
  if (contactMatch) {
    contactName = contactMatch[1].trim();
  }
  const emailMatch =
    cleanText.match(/e-Mail\s*:\s*([^\n]+)/i) ||
    cleanText.match(/Seller Email Address\s*([^\n]+)/i);
  if (emailMatch) {
    contactEmail = emailMatch[1].trim();
  }
  const phoneMatch =
    cleanText.match(/Mobile\s*:\s*(\d+)/i) ||
    cleanText.match(/Telephone Number\s*(\d+)/i);
  if (phoneMatch) {
    contactPhone = phoneMatch[1].trim();
  }

  // Fallbacks from Seller Details section
  if (!contactName) {
    const sContact = cleanText.match(/Contact Person([^\n]+)/);
    if (sContact) contactName = sContact[1].trim();
  }
  if (!contactPhone) {
    const sPhone = cleanText.match(/Telephone Number([^\n]+)/);
    if (sPhone) contactPhone = sPhone[1].trim();
  }
  if (!contactEmail) {
    const sEmail = cleanText.match(/Seller Email Address([^\n]+)/);
    if (sEmail) contactEmail = sEmail[1].trim();
  }

  // 2. Extract MSTC Officers
  const officerOneName =
    cleanText.match(/Officer OneName:\s*([^\n]+)/) ||
    cleanText.match(/Officer OneName\s*([^\n]+)/);

  const keyContacts: KeyContact[] = [
    {
      role: "Auction Officer (MSTC)",
      name: officerOneName
        ? officerOneName[1].replace(/\[\]|-/g, "").trim()
        : DEFAULT_MSTC_OFFICER.name,
      email: DEFAULT_MSTC_OFFICER.email,
    },
  ];

  if (contactName) {
    keyContacts.push({
      role: "Site Contact / Engineer",
      name: contactName,
      email: contactEmail || DEFAULT_CONTACT_EMAIL,
    });
  }

  // 3. Extract EMD Details
  let emdValue = "10% of total bid value";
  let preBidDdg = "Not required for registered MSME bidders";

  // Try to find Post-Bid EMD percentage (e.g. "Post Bid EMD % - 25.0")
  const emdPercentMatch =
    cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*\n*([\d\.]+)/i) ||
    cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*([\d\.]+)/i);
  if (emdPercentMatch) {
    emdValue = `${emdPercentMatch[1]}% of total bid value (Post-Bid EMD)`;
  } else {
    // If no percentage is specified, look for general/Pre-Bid EMD
    const preBidMatch = cleanText.match(/Pre-Bid EMD:\s*([^\n]+)/);
    if (preBidMatch) {
      const matchVal = preBidMatch[1].trim();
      if (
        !matchVal.toLowerCase().includes("not a auto") &&
        !matchVal.toLowerCase().includes("item wise")
      ) {
        const numOnly = matchVal.replace(/[^\d]/g, "");
        if (numOnly && parseInt(numOnly, 10) > 100) {
          preBidDdg = `₹${parseInt(numOnly, 10).toLocaleString("en-IN")}`;
          emdValue = "10% of total bid value";
        } else {
          emdValue = matchVal;
        }
      }
    }
  }

  // Extract explicit Pre-Bid EMD Amount
  const explicitPreBidMatch = cleanText.match(
    /(?:Pre-Bid\s*(?:EMD\s*)?Amount|Pre-Bid\s*Amount)[\s\S]{0,50}?(?:Rs\.?|₹)?\s*([\d,]{4,10})/i,
  );
  if (explicitPreBidMatch) {
    const val = explicitPreBidMatch[1].replace(/,/g, "");
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 100) {
      preBidDdg = `₹${num.toLocaleString("en-IN")}`;
    }
  }

  // 4. Extract Lots (Identified Inventory)
  //
  // Lot identifiers from MSTC can be:
  //   - Numeric:       "1", "2", "3"
  //   - Alphanumeric:  "A-1", "DHL-2025-A01-002", "JMN_01/2026-27"
  //   - Single letter: "A", "B"
  //   - Multi-line:    "DHL-2025-" + "\n" + "A01-002"
  //
  // The split on "Lot No - " yields blocks where the lot identifier is everything
  // before the "Lot Name" marker. We join multi-line fragments and accept any
  // non-empty string as a valid identifier.
  const items: CatalogItem[] = [];
  const lotBlocks = cleanText.split(/Lot No\s*-\s*/);

  if (lotBlocks.length > 1) {
    for (let i = 1; i < lotBlocks.length; i++) {
      const block = lotBlocks[i];

      // --- Extract lot identifier ---
      // Everything before "Lot Name" is the lot ID (may span multiple lines)
      const lotNameIdx = block.search(/Lot Name\s*-/i);
      let lotId: string;
      if (lotNameIdx > 0) {
        lotId = block
          .slice(0, lotNameIdx)
          .replace(/\r?\n/g, "")
          .trim();
      } else {
        // Fallback: take the first non-empty line
        const firstLines = block.split("\n").map((l) => l.trim());
        lotId = firstLines.find((l) => l.length > 0) || "";
      }

      // Skip blocks that look like boilerplate (e.g. terms & conditions)
      if (!lotId || lotId.length > 80) continue;

      // Convert to numeric sr if possible, otherwise keep as string
      const numericLot = parseInt(lotId, 10);
      const sr: number | string =
        !isNaN(numericLot) && String(numericLot) === lotId
          ? numericLot
          : lotId;

      // --- Extract lot name ---
      let lotName = "";
      const nameMatch = block.match(
        /Lot Name\s*-\s*([\s\S]*?)(?=Product Type|Lot Location|State|Lot State|GST|TCS|Bid Valid|$)/i,
      );
      if (nameMatch) {
        lotName = nameMatch[1].replace(/\r?\n/g, " ").trim();
      }

      // --- Extract quantity & unit ---
      let qty = "1";
      let unit = "Lot";

      const qtyRegex = /QTY\s*[:.-]?\s*(?:\r?\n)?\s*([\d\.,]+)\s*([A-Za-z]+)?/gi;
      const matches = Array.from(block.matchAll(qtyRegex));

      if (matches.length > 0) {
        const groups: { [unit: string]: number } = {};
        for (const match of matches) {
          const valStr = match[1].replace(/,/g, "").trim();
          const val = parseFloat(valStr);
          if (!isNaN(val)) {
            const u = (match[2] || "Unit").toUpperCase().trim();
            groups[u] = (groups[u] || 0) + val;
          }
        }

        const groupEntries = Object.entries(groups);
        if (groupEntries.length === 1) {
          const [u, totalVal] = groupEntries[0];
          qty = Number.isInteger(totalVal)
            ? totalVal.toLocaleString("en-IN")
            : totalVal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
          unit = u === "UNIT" ? "Lot" : u;
        } else if (groupEntries.length > 1) {
          qty = groupEntries
            .map(([u, totalVal]) => {
              const formattedVal = Number.isInteger(totalVal)
                ? totalVal.toLocaleString("en-IN")
                : totalVal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
              return `${formattedVal} ${u}`;
            })
            .join(" + ");
          unit = "";
        }
      } else {
        const qtyMatch = block.match(/Quantity\s*-\s*([\d\.,]+)\s*([A-Za-z]+)?/i);
        if (qtyMatch) {
          qty = qtyMatch[1].trim();
          unit = (qtyMatch[2] || "Lot").trim();
        }
      }

      // --- Extract GST ---
      let gst = "As Applicable";
      const gstMatch = block.match(
        /GST\s*(?:\(%\))?\s*-\s*([\s\S]*?)(?=Lot Location|State|Lot State|TCS|Bid Valid|$)/i,
      );
      if (gstMatch) {
        gst = gstMatch[1].replace(/\r?\n/g, " ").trim();
      }

      // --- Extract TCS ---
      let tcs = "0.0";
      const tcsMatch = block.match(
        /TCS\s*(?:\(%\))?\s*-\s*([\s\S]*?)(?=GST|Lot Location|State|Lot State|Bid Valid|$)/i,
      );
      if (tcsMatch) {
        tcs = tcsMatch[1].replace(/\r?\n/g, " ").trim();
      }

      // --- Extract block attachments ---
      const cleanedBlockText = block
        .replace(/\r?\n/g, " ")
        .replace(
          /(Annex_|Photo_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi,
          (_match, p1, p2, p3, p4) => {
            return `${p1}${p2}${p3 || ""}${p4}`;
          },
        );

      const blockMatches = cleanedBlockText.match(/([a-zA-Z0-9_]+\.pdf)/g) || [];
      const attachments = Array.from(new Set(blockMatches)).filter((name) => {
        const n = name.toLowerCase();
        return n.startsWith("photo_") || n.startsWith("annex_");
      });

      items.push({
        sr,
        description: lotName || categoryName || "Auction Lot Items",
        qty,
        unit,
        taxRate: `${gst} GST${tcs && tcs !== "0.0" && tcs !== "0" ? " + " + tcs + "% TCS" : ""}`,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    }
  }

  // Fallback if no lots parsed
  if (items.length === 0) {
    items.push({
      sr: 1,
      description: categoryName || "Auction Lot Items",
      qty: "1",
      unit: "Lot",
      taxRate: "18% GST",
    });
  }

  // 5. Build Overview & Scope
  const uniqueItemNames = Array.from(new Set(
    items.map((it) => it.description.trim())
  )).filter(Boolean);
  
  let itemNamesSummary = "";
  if (uniqueItemNames.length === 0) {
    itemNamesSummary = "designated materials";
  } else if (uniqueItemNames.length <= 3) {
    itemNamesSummary = uniqueItemNames.join(", ").toLowerCase();
  } else {
    itemNamesSummary = `${uniqueItemNames.slice(0, 3).join(", ").toLowerCase()} and other materials`;
  }

  const overview = `This auction is conducted by MSTC on behalf of ${sellerName} for the disposal of ${itemNamesSummary} located at ${location || "designated site areas"}.`;
  const scopeOfWork = `Lifting, clearing, and disposal of designated lots of ${itemNamesSummary} in accordance with MSTC Special Terms & Conditions (STC). All items are sold on an "As-Is-Where-Is" basis.`;

  // 6. Eligibility
  const eligibility: string[] = [
    "Valid MSTC Buyer Registration in active status.",
    "GSTIN Registration Certificate matching the buyer profile.",
  ];

  const textLower = text.toLowerCase();
  if (
    textLower.includes("hazardous") ||
    textLower.includes("waste") ||
    textLower.includes("battery") ||
    textLower.includes("oil")
  ) {
    eligibility.push(
      "Hazardous waste/smelter authorization from State Pollution Control Board (SPCB) is mandatory.",
    );
  }
  if (
    textLower.includes("telecom") ||
    textLower.includes("cable") ||
    textLower.includes("e-waste")
  ) {
    eligibility.push(
      "CPCB/SPCB E-Waste recycler registration required for e-waste lots.",
    );
  }

  return {
    overview,
    scopeOfWork,
    items,
    eligibility,
    depositDetails: {
      emd: emdValue,
      preBidDdg,
      adminCharges: ADMIN_CHARGES,
    },
    keyContacts,
  };
}
