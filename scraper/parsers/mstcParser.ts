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

export interface SubItem {
  sr: number | string;
  description: string;
  qty: string;
  unit: string;
}

export interface CatalogItem {
  sr: number | string;
  description: string;
  qty: string;
  unit: string;
  taxRate: string;
  attachments?: string[];
  images?: string[];
  marketPrice?: string;
  subItems?: SubItem[];
}

export interface KeyContact {
  role: string;
  name: string;
  email: string;
  phone?: string;
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
  totalMarketValue?: number;
  inspectionDetails?: {
    time: string;
    contact: string;
  };
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

  // 1. Extract Site Contacts and Officers
  const cleanName = (name: string): string => {
    if (!name) return "";
    let cleaned = name
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\([^\)]*\)/g, "")
      .replace(/[\{\}]/g, "")
      .replace(/[-_]+/g, " ")
      .replace(/[#*@~]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Strip trailing special/non-word characters (like - or + or other symbols)
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s.]+$/, "").trim();
    // Remove any leftover brackets completely
    cleaned = cleaned.replace(/[\[\]\(\)\{\}]/g, "").trim();
    return cleaned;
  };

  const isValidContactName = (name: string): boolean => {
    if (!name || name.length < 3 || name.length > 40) return false;
    const lower = name.toLowerCase();
    const invalidKeywords = [
      'specified', 'location', 'prior', 'permission', 'escort', 'bidding', 
      'day', 'working', 'date', 'time', 'mstc', 'tender', 'bidder', 
      'download', 'catalog', 'available', 'office', 'details', 'helpdesk',
      'click', 'here', 'refer', 'annexure', 'lot', 'description', 'parameters',
      'annex', 'photograph', 'photo', 'attached', 'email', 'phone', 'contact'
    ];
    for (const kw of invalidKeywords) {
      if (lower.includes(kw)) return false;
    }
    return true;
  };

  const extractPhoneNumber = (line: string): string | null => {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes("download") || lowerLine.includes("date") || lowerLine.includes("valid till")) {
      return null;
    }
    
    // Clean up dates from the line to prevent matching date digits
    let cleanedLine = line;
    const datePattern = /\d{2,4}[-/.]\d{2}[-/.]\d{2,4}/g;
    cleanedLine = cleanedLine.replace(datePattern, "");

    // Try pattern with prefix
    const prefixMatch = cleanedLine.match(/(?:mobile|phone|telephone|tele|no|num|contact)[\s:.-]*([+0-9\s.,/-]{8,40})/i);
    if (prefixMatch) {
      const cleaned = prefixMatch[1].replace(/[^\d]/g, "");
      if (cleaned.length >= 8 && cleaned.length <= 25) {
        return prefixMatch[1].trim();
      }
    }

    // Try matching any sequence of digits, spaces, dashes, commas, slashes that has at least 8 digits
    const generalMatch = cleanedLine.match(/(?:^|[^0-9])([+0-9\s.,/-]{8,40})(?:$|[^0-9])/);
    if (generalMatch) {
      const cleaned = generalMatch[1].replace(/[^\d]/g, "");
      if (cleaned.length >= 8 && cleaned.length <= 25) {
        return generalMatch[1].trim();
      }
    }

    return null;
  };

  const keyContacts: KeyContact[] = [];
  const processedNames = new Set<string>();

  // 1. Extract Site Contacts (Contact Person)
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.toLowerCase().includes('contact person')) {
      let namePart = line.replace(/Contact Person\s*:?\s*/i, '').trim();
      let nameLineIdx = idx;
      
      if (!namePart) {
        if (idx + 1 < lines.length) {
          namePart = lines[idx + 1];
          nameLineIdx = idx + 1;
        }
      }
      
      const boundaryKeywords = [
        'telephone', 'mobile', 'email', 'phone', 'tele', 'fax', 
        'address', 'manager', 'officer', 'designation', ':', '-'
      ];
      let truncateIdx = namePart.length;
      const lowerNamePart = namePart.toLowerCase();
      for (const kw of boundaryKeywords) {
        const kwIdx = lowerNamePart.indexOf(kw);
        if (kwIdx !== -1 && kwIdx < truncateIdx) {
          truncateIdx = kwIdx;
        }
      }
      
      const digitMatch = namePart.match(/\d/);
      if (digitMatch && digitMatch.index !== undefined && digitMatch.index < truncateIdx) {
        truncateIdx = digitMatch.index;
      }
      
      const cleanedName = cleanName(namePart.substring(0, truncateIdx));
      if (isValidContactName(cleanedName) && !processedNames.has(cleanedName.toLowerCase())) {
        processedNames.add(cleanedName.toLowerCase());

        let phone = "";
        let email = "";
        for (let offset = -2; offset <= 4; offset++) {
          const targetIdx = nameLineIdx + offset;
          if (targetIdx < 0 || targetIdx >= lines.length) continue;
          const targetLine = lines[targetIdx];
          
          if (!phone) {
            const extractedPhone = extractPhoneNumber(targetLine);
            if (extractedPhone) {
              phone = extractedPhone;
            }
          }
          if (!email) {
            const m2 = targetLine.match(/([a-zA-Z0-9\._-]+@[a-zA-Z0-9\._-]+)/);
            if (m2) {
              email = m2[1].replace(/^(?:email|address|seller|officer|contact|person|details)+/i, "");
            }
          }
        }

        keyContacts.push({
          role: "Site Contact / Engineer",
          name: cleanedName,
          email: email || DEFAULT_CONTACT_EMAIL,
          phone: phone || "no contact info available"
        });
      }
    }
  }

  // 2. Extract MSTC Officers
  const officerOneMatch = text.match(/Officer OneName:[ \t]*([^\n\r]+)/i) || text.match(/Officer OneName[ \t]+([^\n\r]+)/i);
  if (officerOneMatch) {
    let offName = cleanName(officerOneMatch[1]);
    let offEmail = "";
    let offPhone = "";
    
    const idx = lines.findIndex(l => l.includes("Officer OneName"));
    if (idx !== -1) {
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const line = lines[i];
        if (line.includes("Officer TwoName")) break;
        const emailM = line.match(/Email\s*:?\s*([^\s\n]+)/i);
        if (emailM) offEmail = emailM[1].trim();
        const extractedPhone = extractPhoneNumber(line);
        if (extractedPhone && !offPhone) offPhone = extractedPhone;
      }
    }
    
    if (offName && isValidContactName(offName) && !processedNames.has(offName.toLowerCase())) {
      processedNames.add(offName.toLowerCase());
      keyContacts.unshift({
        role: "Auction Officer (MSTC)",
        name: offName,
        email: offEmail || DEFAULT_MSTC_OFFICER.email,
        phone: offPhone || "no contact info available"
      });
    }
  }

  const officerTwoMatch = text.match(/Officer TwoName:[ \t]*([^\n\r]+)/i) || text.match(/Officer TwoName[ \t]+([^\n\r]+)/i);
  if (officerTwoMatch) {
    let offName = cleanName(officerTwoMatch[1]);
    let offEmail = "";
    let offPhone = "";
    
    const idx = lines.findIndex(l => l.includes("Officer TwoName"));
    if (idx !== -1) {
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const line = lines[i];
        const emailM = line.match(/Email\s*:?\s*([^\s\n]+)/i);
        if (emailM) offEmail = emailM[1].trim();
        const extractedPhone = extractPhoneNumber(line);
        if (extractedPhone && !offPhone) offPhone = extractedPhone;
      }
    }
    
    if (offName && isValidContactName(offName) && !processedNames.has(offName.toLowerCase())) {
      processedNames.add(offName.toLowerCase());
      const insertIdx = keyContacts.findIndex(c => c.role.includes("Site Contact"));
      if (insertIdx !== -1) {
        keyContacts.splice(insertIdx, 0, {
          role: "Auction Officer (MSTC)",
          name: offName,
          email: offEmail || DEFAULT_MSTC_OFFICER.email,
          phone: offPhone || "no contact info available"
        });
      } else {
        keyContacts.push({
          role: "Auction Officer (MSTC)",
          name: offName,
          email: offEmail || DEFAULT_MSTC_OFFICER.email,
          phone: offPhone || "no contact info available"
        });
      }
    }
  }

  // Fallback if no contacts found
  if (keyContacts.length === 0) {
    keyContacts.push({
      role: "Auction Officer (MSTC)",
      name: DEFAULT_MSTC_OFFICER.name,
      email: DEFAULT_MSTC_OFFICER.email,
      phone: "no contact info available"
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
      const rawBlock = lotBlocks[i];

      // Truncate lot block at boilerplate/terms & conditions sections (usually appended to the last block)
      const boilerplatePattern = /(?:seller\s+specific\s+terms|special\s+terms\s+and\s+conditions|special\s+terms\s+&\s+conditions|general\s+terms\s+and\s+conditions|terms\s+&\s+conditions|terms\s+and\s+conditions|instructions\s+to\s+bidders|instructions\s+to\s+the\s+bidder|payment\s+procedure|e-payment|pre-bid\s+emd|important\s+instructions)/i;
      const boilerplateIdx = rawBlock.search(boilerplatePattern);
      const block = boilerplateIdx !== -1 ? rawBlock.substring(0, boilerplateIdx) : rawBlock;

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

      // --- Extract lot description ---
      // The full description usually appears after "Category -" and before the lot parameters
      let lotDescription = "";
      const descTextMatch = block.match(
        /Category\s*-[^\n]*\n([\s\S]*?)(?=Quantity\s*-|Start\s*Price|Post\s*Bid|Bid\s*Increment|TCS|GST|Lot Location|State)/i,
      );
      if (descTextMatch) {
        lotDescription = descTextMatch[1].replace(/\r?\n/g, " ").trim();
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

      // --- Fallback: Extract quantities from the lot description text ---
      // Many catalogs (especially forest/timber) embed quantities inline in the
      // description column rather than the Quantity parameter field:
      //   "Wood 2.0046 cum"  /  "Fire wood 2.136 cum"
      if ((qty === "1" || qty === "1.0") && unit.toLowerCase() === "lot") {
        const descQty = extractQuantitiesFromDescriptionBlock(block);
        if (descQty) {
          qty = descQty.qty;
          unit = descQty.unit;
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

      // --- Extract Start Price / Market Price ---
      let lotMarketPrice: string | undefined = undefined;

      const startPriceInrMatch = block.match(/Start\s*Price\s*in\s*INR\s*-\s*([\d\.]+)/i);
      const startPriceCrMatch = block.match(/Start\s*Price\s*\(in\s*INR\s*Cr\.\)\s*:\s*([\d\.]+)/i);
      const generalStartPriceMatch = block.match(/Start\s*Price\s*(?:in\s*INR|in\s*Cr\.?)?[\s\(\)]*[:.-]?\s*([\d,]+)/i);

      let parsedStartPriceNum: number | null = null;
      if (startPriceInrMatch) {
        parsedStartPriceNum = parseFloat(startPriceInrMatch[1]);
      } else if (startPriceCrMatch) {
        parsedStartPriceNum = parseFloat(startPriceCrMatch[1]) * 10000000;
      } else if (generalStartPriceMatch) {
        const cleanVal = generalStartPriceMatch[1].replace(/,/g, '');
        const parsedVal = parseFloat(cleanVal);
        if (!isNaN(parsedVal)) {
          if (block.toLowerCase().includes('cr.') && parsedVal < 10000) {
            parsedStartPriceNum = parsedVal * 10000000;
          } else {
            parsedStartPriceNum = parsedVal;
          }
        }
      }

      if (parsedStartPriceNum !== null && !isNaN(parsedStartPriceNum) && parsedStartPriceNum > 0) {
        const formattedPrice = parsedStartPriceNum.toLocaleString('en-IN');
        const priceUnit = (unit || 'Lot');
        lotMarketPrice = `₹${formattedPrice} / ${priceUnit}`;
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

      // --- Extract block sub-items ---
      const subItems = parseSubItemsFromText(block);

      let finalQty = qty;
      let finalUnit = unit;
      if (subItems && subItems.length > 0) {
        const currentQtyLower = (qty || "").toLowerCase().trim();
        const currentUnitLower = (unit || "").toLowerCase().trim();
        const isGenericOrGarbage =
          currentQtyLower === "1" ||
          currentQtyLower === "1.0" ||
          currentUnitLower === "lot" ||
          currentUnitLower === "lots" ||
          currentQtyLower.includes("+");

        if (isGenericOrGarbage) {
          finalQty = String(subItems.length);
          finalUnit = "Items";
        }
      }

      let finalDescription = lotDescription;
      if (!finalDescription) {
        finalDescription = lotName || categoryName || "Auction Lot Items";
      } else if (lotName && !finalDescription.toLowerCase().includes(lotName.toLowerCase())) {
        finalDescription = `${lotName} - ${finalDescription}`;
      }

      items.push({
        sr,
        description: finalDescription,
        qty: finalQty,
        unit: finalUnit,
        taxRate: `${gst} GST${tcs && tcs !== "0.0" && tcs !== "0" ? " + " + tcs + "% TCS" : ""}`,
        attachments: attachments.length > 0 ? attachments : undefined,
        marketPrice: lotMarketPrice,
        subItems: subItems.length > 0 ? subItems : undefined,
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

  // 7. Extract Inspection Details
  let inspectionTime = "From publication date to 1 day prior to bidding (10:00 AM - 4:00 PM on working days)";
  
  // Try pattern: "Inspection Schedule:09-06-26 to 16-06-26" or similar
  const scheduleMatch = text.match(/Inspection Schedule\s*:\s*([^\n\r]+)/i) || 
                        text.match(/Inspection window\s*:\s*([^\n\r]+)/i);
  
  if (scheduleMatch) {
    let matchedTime = scheduleMatch[1].trim();
    // Clean trailing characters or download info
    const downloadIdx = matchedTime.toLowerCase().indexOf("date/time of download");
    if (downloadIdx !== -1) {
      matchedTime = matchedTime.substring(0, downloadIdx).trim();
    }
    const boundaryKeywords = ["Scheduled", "Auction", "MSTC", "Lot Details", "Lot No"];
    for (const kw of boundaryKeywords) {
      const kwIdx = matchedTime.indexOf(kw);
      if (kwIdx !== -1) {
        matchedTime = matchedTime.substring(0, kwIdx).trim();
      }
    }
    if (matchedTime && matchedTime.length > 5 && matchedTime.length < 150) {
      inspectionTime = matchedTime;
    }
  } else {
    // Try matching proposed schedule, e.g. "Inspection window: 09.06.2026 to 16.06.2026 (except Saturday and Sunday)"
    const inlineMatch = text.match(/Inspection window\s*[:.-]\s*([^\n\r.]+)/i) || 
                        text.match(/Inspection Schedule\s*[:.-]\s*([^\n\r.]+)/i);
    if (inlineMatch) {
      let matchedTime = inlineMatch[1].trim();
      if (matchedTime && matchedTime.length > 5 && matchedTime.length < 150) {
        inspectionTime = matchedTime;
      }
    }
  }

  const mainContact = keyContacts.find(c => c.role.toLowerCase().includes('site') || c.role.toLowerCase().includes('engineer')) || keyContacts[0];
  const inspectionContact = mainContact ? `${mainContact.name} (${mainContact.phone || 'phone listed in catalog'})` : 'Site In-Charge';

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
    inspectionDetails: {
      time: inspectionTime,
      contact: inspectionContact
    }
  };
}

// ─── Description Block Quantity Extraction ──────────────────────────────────

/**
 * Units commonly found inline in lot description text (volume, weight, count, length).
 */
const DESC_UNITS =
  "cum|cft|cbm|" +
  "kg|kgs|gms|gm|mt|mts|ton|tons|" +
  "nos|no|pcs|pc|sets|set|items|item|units|unit|" +
  "mtr|mtrs|rm|rft|" +
  "ltrs|ltr|bags|bag";

/**
 * Extract quantities embedded in a lot description text block.
 *
 * The lot block from `pdf-parse` contains a description column between
 * the lot header (Lot Name / Category) and the structured parameters
 * (Quantity / Start Price). This description column may contain
 * material-specific quantities like:
 *   "Wood 2.0046 cum"
 *   "Fire wood 2.136 cum"
 *
 * This function extracts the description portion and scans it for
 * `<number> <unit>` patterns, grouping and summing by unit.
 */
function extractQuantitiesFromDescriptionBlock(
  block: string,
): { qty: string; unit: string } | null {
  // Extract the description text: content after "Category -" line and before
  // "Quantity -" or other parameter markers.
  // The description column in MSTC PDFs appears between the category and the parameters.
  const descMatch = block.match(
    /Category\s*-[^\n]*\n([\s\S]*?)(?=Quantity\s*-|Start\s*Price|Post\s*Bid|Bid\s*Increment|TCS\s*\()/i,
  );

  if (!descMatch) return null;

  const descText = descMatch[1];
  const descUnitRegex = new RegExp(
    `\\b(\\d+[\\d,.]*)\\s+(${DESC_UNITS})\\b`,
    "gi",
  );

  const groups: { [unit: string]: number } = {};
  let match;
  while ((match = descUnitRegex.exec(descText)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) {
      const u = match[2].toUpperCase().trim();
      groups[u] = (groups[u] || 0) + val;
    }
  }

  const entries = Object.entries(groups);
  if (entries.length === 0) return null;

  if (entries.length === 1) {
    const [u, totalVal] = entries[0];
    const qty = Number.isInteger(totalVal)
      ? totalVal.toLocaleString("en-IN")
      : totalVal.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        });
    return { qty, unit: u };
  }

  // Multiple units: combine them
  const qty = entries
    .map(([u, totalVal]) => {
      const formatted = Number.isInteger(totalVal)
        ? totalVal.toLocaleString("en-IN")
        : totalVal.toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
          });
      return `${formatted} ${u}`;
    })
    .join(" + ");
  return { qty, unit: "" };
}

/**
 * Parse sub-items from a block of text (selectable or OCR).
 *
 * Handles three common formats from OCR-processed PDF tables:
 *   1. "<sr>. DESCRIPTION <unit> <qty>"   e.g., "1 PLASTIC CHAIR Nos 5"
 *   2. "<sr>. DESCRIPTION <qty> <unit>"   e.g., "1 PLASTIC CHAIR 5 Nos"
 *   3. "<sr>. DESCRIPTION <qty>"          e.g., "1 PLASTIC CHAIR 5" (defaults unit to Nos)
 *
 * Also pre-splits concatenated rows where OCR joins multiple table rows into one line.
 */
export function parseSubItemsFromText(text: string): SubItem[] {
  if (!text) return [];
  const subItems: SubItem[] = [];
  const seenKeys = new Set<string>();

  // Comprehensive unit keywords for Indian government surplus auctions
  const UNITS =
    "nos|no|sets|set|kgs|kg|gms|gm|mts|mt|mtr|mtrs|ltrs|ltr|pcs|pc|" +
    "items|item|units|unit|bags|bag|box|boxes|bdl|bdls|coil|coils|" +
    "roll|rolls|ac|pair|pairs|drums|drum|sheets|sheet|ton|tons|" +
    "gross|dozen|doz|bottles|bottle|bunches|bunch|reams|ream|each|" +
    "bundle|bundles|set\\/nos|nos\\/set|" +
    "cum|cft|cbm|rm|rft";

  const unitsRegex = new RegExp(`^(?:${UNITS})\\b`, "i");

  // Step 1: Normalize text — clean OCR artifacts, compress whitespace per line
  let normalized = text.replace(/\|/g, " ").replace(/\t/g, " ");

  // Step 2: Pre-split concatenated items.
  // When OCR joins multiple table rows into a single line, split them apart.
  // Pattern 1: after "<unit_keyword> <qty_number>", before "<new_item_sr> <UPPERCASE_WORD>"
  // e.g., "CHAIR Nos 5 2 PLASTIC TABLE Nos 3" → "CHAIR Nos 5\n2 PLASTIC TABLE Nos 3"
  const splitOnUnitQty = new RegExp(
    `(\\b(?:${UNITS})\\.?\\s+\\d+[\\d,.]*)\\s+(\\d{1,3})\\.?\\s+([A-Z])`,
    "gi",
  );
  let prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(splitOnUnitQty, "$1\n$2 $3");
  }

  // Pattern 2: after "<qty_number> <unit_keyword>", before "<new_item_sr> <UPPERCASE_WORD>"
  // e.g., "01 NO 02 Tarpaulin" → "01 NO\n02 Tarpaulin"
  const splitOnQtyUnitNewSerial = new RegExp(
    `(\\b\\d+[\\d,.]*\\s+(?:${UNITS})\\b\\.?)\\s+(\\d{1,3})\\s+([A-Z])`,
    "gi"
  );
  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(splitOnQtyUnitNewSerial, "$1\n$2 $3");
  }

  // Fallback split: bare quantity followed by new item number + uppercase word (3+ chars)
  // e.g., "28 20 BADMINTON POST" → "28\n20 BADMINTON POST"
  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(
      /(\d+[\d,.]*)\s+(\d{1,3})\s+([A-Z][A-Z][A-Z])/g,
      "$1\n$2 $3",
    );
  }

  // Pre-split on hyphenated serials as well, e.g. "32.150 Kgs 2-Plastic" -> "32.150 Kgs\n2-Plastic"
  const splitOnQtyUnitNewSerialHyphen = new RegExp(
    `(\\b(?:${UNITS})\\b\\.?\\s*\\d+[\\d,.]*|\\b\\d+[\\d,.]*\\s*(?:${UNITS})\\b\\.?)\\s+(\\d{1,3})\\-([A-Z])`,
    "gi"
  );
  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(splitOnQtyUnitNewSerialHyphen, "$1\n$2-$3");
  }

  // Split the very first item from the header row if run together
  const splitFirstItem = new RegExp(
    `\\b(?:photograph|photo|uom|unit|qty|quantity|description|location|state|gst|tcs)\\s+(\\d{1,2})\\s+([A-Z])`,
    "i"
  );
  normalized = normalized.replace(splitFirstItem, "\n$1 $2");

  // Fallback split with intermediate non-numeric text (e.g. locations/boilerplates) between quantity and next serial
  const splitOnIntermediateText = /([a-zA-Z]+)\s+(\d+[\d,.]*)\s+([^0-9\n]{2,100}?)\s+(\d{1,3})\s+([A-Z][A-Z][A-Z])/g;
  let prevVal = "";
  while (prevVal !== normalized) {
    prevVal = normalized;
    normalized = normalized.replace(splitOnIntermediateText, "$1 $2 $3\n$4 $5");
  }

  // Step 3: Line-merging pre-pass to handle wrapped OCR lines
  const rawLines = normalized.split(/\r?\n/).map((l) => l.trim());
  const mergedLines: string[] = [];
  let currentLine = "";

  function startsWithSerial(line: string): boolean {
    if (/^\d+\.\d+/.test(line)) {
      return false; // Starts with a decimal (e.g. "32.150 Kgs"), not a serial number
    }
    const match = line.match(/^(\d+)([\s.-]+)?(.*)$/);
    if (!match) return false;
    const num = parseInt(match[1], 10);
    if (num > 150) return false; // Reasonable upper bound for sub-item serial numbers
    const rest = match[3].trim();
    if (unitsRegex.test(rest)) return false; // Starts with a unit keyword, so it is likely a quantity/capacity, not serial
    return true;
  }

  for (const line of rawLines) {
    if (!line) continue;
    if (startsWithSerial(line)) {
      if (currentLine) {
        mergedLines.push(currentLine);
      }
      currentLine = line;
    } else {
      if (currentLine) {
        currentLine += " " + line;
      } else {
        mergedLines.push(line);
      }
    }
  }
  if (currentLine) {
    mergedLines.push(currentLine);
  }

  // Step 4: Process line by line
  for (const line of mergedLines) {
    const lower = line.toLowerCase();

    let cleanedLine = line
      .replace(/\b\d+\.?\d*\s*%/g, "")                     // strip percentage columns (18%, 5.00%, 2.50%)
      .replace(/Mob\.?\s*No\.?\s*[\d\s-]+/gi, "")           // strip "Mob No. 9497612987"
      .replace(/Contact\s*(?:Number|No\.?)\s*:?\s*[\d\s-]+/gi, "")  // strip contact numbers
      .replace(/\s+/g, " ")
      .trim();

    // Truncate after the last <number> <unit> match to discard trailing
    // location/column text from merged OCR table rows.
    const lastUnitMatch = new RegExp(
      `(\\d+[\\d,.]*)\\s+(${UNITS})\\b\\.?`,
      "gi",
    );
    let lastMatchEnd = -1;
    let um;
    while ((um = lastUnitMatch.exec(cleanedLine)) !== null) {
      lastMatchEnd = um.index + um[0].length;
    }
    if (lastMatchEnd > 0 && lastMatchEnd < cleanedLine.length) {
      cleanedLine = cleanedLine.substring(0, lastMatchEnd).trim();
    }

    // Skip header rows, page markers, and irrelevant labels
    if (
      /^sl[\s.]?no/i.test(line) ||
      /^serial\s*no/i.test(line) ||
      lower.includes("nomenclature") ||
      lower.includes("appendix") ||
      lower.includes("annexure") ||
      /\blot\s*no\b/i.test(line) ||
      lower.includes("lot parameters") ||
      lower.includes("lot name") ||
      (lower.includes("description") &&
        (lower.includes("qty") ||
          lower.includes("quantity") ||
          lower.includes("a/u"))) ||
      (lower.includes("quantity") &&
        (lower.includes("sl") ||
          lower.includes("unit") ||
          lower.includes("a/u"))) ||
      lower.includes("u.o.m") ||
      lower.includes("gst%") ||
      /\bpage\s+\d/i.test(line) ||
      /^total\b/i.test(line) ||
      /^grand\s*total/i.test(line) ||
      /^sub\s*total/i.test(line)
    ) {
      continue;
    }
    const matchLine = cleanedLine || line;

    // Check if it starts with a serial number that is actually followed by a unit keyword
    // to prevent malformed text lines from being matched.
    const isUnitAfterSr = new RegExp(`^\\d+\\s*\\b(${UNITS})\\b`, "i").test(matchLine);
    if (isUnitAfterSr) {
      continue;
    }

    // Match 1: "<sr>. DESCRIPTION <unit> <qty>" (most common format)
    const m1 = matchLine.match(
      new RegExp(
        `^(\\d{1,3})[\\s.-]+(.+?)\\s+\\b(${UNITS})\\b\\.?\\s+(\\d+[\\d,.]*)\\s*$`,
        "i",
      ),
    );
    if (m1) {
      addItem(m1[1], m1[2], m1[3], m1[4]);
      continue;
    }

    // Match 2: "<sr>. DESCRIPTION <qty> <unit>"
    const m2 = matchLine.match(
      new RegExp(
        `^(\\d{1,3})[\\s.-]+(.+?)\\s+(\\d+[\\d,.]*)\\s+\\b(${UNITS})\\b\\.?\\s*$`,
        "i",
      ),
    );
    if (m2) {
      addItem(m2[1], m2[2], m2[4], m2[3]);
      continue;
    }

    // Match 3: "<sr>. DESCRIPTION <qty>" (no explicit unit, default to Nos, supports optional trailing location/non-digit text)
    const m3 = matchLine.match(/^(\d{1,3})[\s.-]+(.+?)\s+(\d+[\d,.]*)(?:\s+[^0-9]+.*)?$/);
    if (m3) {
      addItem(m3[1], m3[2], "Nos", m3[3]);
    }
  }

  function addItem(srStr: string, rawDesc: string, unit: string, qty: string) {
    // Clean trailing junk from description, e.g. ", Qty :", "Qty :", etc.
    let desc = rawDesc.trim();
    desc = desc.replace(/,?\s*Qty\s*:\s*$/i, "");
    desc = desc.replace(/,?\s*Quantity\s*:\s*$/i, "");
    desc = desc.replace(/,?\s*Qty\s*-\s*$/i, "");
    desc = desc.trim();

    if (desc.length < 2 || desc.length > 160 || !/[a-zA-Z]{2,}/.test(desc)) return;

    // Filter out boilerplate instructions/legal/contact clauses
    const instructionKeywords = /\b(?:payment|e-payment|bidder|bidders|bid\s+value|bid\s+price|reserve\s+price|earnest\s+money|security\s+deposit|emd|levies|duties|statutory|authorities|click\s+here|download|website|portal|annexure|appendix|refund|forfeit|forfeiture|successful\s+bidder|shall\s+be|will\s+be|should\s+be|available\s+at|mobile|phone|email|manager|officer|telephone|contact\s+person)\b/i;
    if (instructionKeywords.test(desc)) return;

    // Filter out huge quantities like phone numbers / pin codes / serial numbers
    const cleanQtyStr = qty.replace(/[^0-9.]/g, '');
    const numQty = parseFloat(cleanQtyStr);
    if (!isNaN(numQty) && numQty > 5000000) return;

    const sr = parseInt(srStr, 10);
    // Dedup using sr + normalized prefix of description (handles OCR variations)
    const key = `${sr}_${desc.toLowerCase().substring(0, 30)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    subItems.push({
      sr,
      description: desc,
      unit: unit.trim(),
      qty: qty.trim(),
    });
  }

  return subItems;
}