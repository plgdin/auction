/**
 * Key contact extractor for MSTC catalog PDFs.
 *
 * Extracts site contacts ("Contact Person") and MSTC officers
 * ("Officer OneName", "Officer TwoName") from catalog text.
 *
 * Fixes applied:
 * - Department names / designations no longer parsed as people.
 * - Improved boundary keyword filtering to prevent bleed from adjacent fields.
 * - Handles multiple contacts listed in the same section.
 */
import {
  DEFAULT_MSTC_OFFICER,
  DEFAULT_CONTACT_EMAIL,
} from "../config.js";
import type { KeyContact } from "./types.js";

// ─── Internal Helpers ────────────────────────────────────────────────────────

const BOUNDARY_KEYWORDS = [
  "telephone", "mobile", "email", "phone", "tele", "fax",
  "address", "designation", ":", "-", ",",
  "department", "division", "section", "branch", "directorate",
  "superintendent", "assistant", "deputy", "junior", "senior",
  "regional", "zonal", "central", "chief", "head",
  "limited", "corporation", "authority", "board", "committee",
  "government", "ministry", "engineer", "manager", "officer",
];

/**
 * Clean a raw name string by removing OCR noise, brackets, symbols.
 */
function cleanName(name: string): string {
  if (!name) return "";
  let cleaned = name
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^\)]*\)/g, "")
    .replace(/[\{\}]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/[#*@~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Strip trailing special/non-word characters
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s.]+$/, "").trim();
  // Remove any leftover brackets
  cleaned = cleaned.replace(/[\[\]\(\)\{\}]/g, "").trim();
  return cleaned;
}

/**
 * Validate that a string looks like a real person's name and not
 * a department label, designation, or boilerplate text.
 */
function isValidContactName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 60) return false;
  const lower = name.toLowerCase();

  const invalidKeywords = [
    "specified", "location", "prior", "permission", "escort", "bidding",
    "day", "working", "date", "time", "mstc", "tender", "bidder",
    "download", "catalog", "available", "office", "details", "helpdesk",
    "click", "here", "refer", "annexure", "lot", "description", "parameters",
    "annex", "photograph", "photo", "attached", "email", "phone", "contact",
    // Additional department/designation filters:
    "department", "division", "section", "branch", "directorate",
    "superintendent", "assistant", "deputy", "junior", "senior",
    "regional", "zonal", "central", "chief", "head",
    "limited", "corporation", "authority", "board", "committee",
    "government", "ministry",
  ];

  for (const kw of invalidKeywords) {
    const rx = new RegExp(`\\b${kw}\\b`, "i");
    if (rx.test(lower)) return false;
  }

  // Must contain at least one word with 2+ alphabetic chars (filters out "A B" or numeric)
  const words = name.split(/\s+/).filter((w) => /^[a-zA-Z]{2,}/.test(w));
  if (words.length < 1) return false;

  return true;
}

/**
 * Extract a phone number from a line of text, avoiding false positives
 * from dates, document IDs, and download references.
 */
function extractPhoneNumber(line: string): string | null {
  const lowerLine = line.toLowerCase();
  if (
    lowerLine.includes("download") ||
    lowerLine.includes("date") ||
    lowerLine.includes("valid till") ||
    lowerLine.includes("account") ||
    lowerLine.includes("reference")
  ) {
    return null;
  }

  // Clean up dates from the line to prevent matching date digits
  let cleanedLine = line;
  const datePattern = /\d{2,4}[-/.]\d{2}[-/.]\d{2,4}/g;
  cleanedLine = cleanedLine.replace(datePattern, "");

  // Try pattern with prefix
  const prefixMatch = cleanedLine.match(
    /(?:mobile|phone|telephone|tele|no|num|contact)[\s:.-]*([+0-9\s.,/-]{8,40})/i,
  );
  if (prefixMatch) {
    const cleaned = prefixMatch[1].replace(/[^\d]/g, "");
    if (cleaned.length >= 8 && cleaned.length <= 25) {
      return prefixMatch[1].trim();
    }
  }

  // Try matching any long digit sequence
  const generalMatch = cleanedLine.match(
    /(?:^|[^0-9])([+0-9\s.,/-]{8,40})(?:$|[^0-9])/,
  );
  if (generalMatch) {
    const cleaned = generalMatch[1].replace(/[^\d]/g, "");
    if (cleaned.length >= 8 && cleaned.length <= 25) {
      return generalMatch[1].trim();
    }
  }

  return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract all key contacts from catalog PDF text.
 *
 * Returns contacts ordered: MSTC Officers first, then Site Contacts.
 * Falls back to default officer details if no contacts are found.
 *
 * @param lines - Array of trimmed text lines from the PDF.
 * @param text  - The full raw text (used for officer name regex matching).
 */
export function extractKeyContacts(lines: string[], text: string): KeyContact[] {
  const keyContacts: KeyContact[] = [];
  const processedNames = new Set<string>();

  // ── 1. Extract Site Contacts ("Contact Person") ───────────────────────────
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line.toLowerCase().includes("contact person")) continue;

    let namePart = line.replace(/Contact Person\s*:?\s*/i, "").trim();
    let nameLineIdx = idx;

    if (!namePart) {
      if (idx + 1 < lines.length) {
        namePart = lines[idx + 1];
        nameLineIdx = idx + 1;
      }
    }

    let truncateIdx = namePart.length;
    const lowerNamePart = namePart.toLowerCase();
    for (const kw of BOUNDARY_KEYWORDS) {
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
          const m2 = targetLine.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/);
          if (m2) {
            email = m2[1].replace(
              /^(?:email|address|seller|officer|contact|person|details)+/i,
              "",
            );
          }
        }
      }

      keyContacts.push({
        role: "Site Contact / Engineer",
        name: cleanedName,
        email: email || DEFAULT_CONTACT_EMAIL,
        phone: phone || "no contact info available",
      });
    }
  }

  // ── 2. Extract MSTC Officers ──────────────────────────────────────────────
  const officerPatterns: Array<{ regex: RegExp[]; role: string; position: "unshift" | "before-site" }> = [
    {
      regex: [
        /Officer OneName:[ \t]*([^\n\r]+)/i,
        /Officer OneName[ \t]+([^\n\r]+)/i,
        /MSTC\s+Officer\s*:\s*([^\n\r]+)/i,
        /MSTC\s+Officer[ \t]+([^\n\r]+)/i,
        /Officer\s*:\s*([^\n\r]+)/i,
      ],
      role: "Auction Officer (MSTC)",
      position: "unshift",
    },
    {
      regex: [
        /Officer TwoName:[ \t]*([^\n\r]+)/i,
        /Officer TwoName[ \t]+([^\n\r]+)/i,
      ],
      role: "Auction Officer (MSTC)",
      position: "before-site",
    },
  ];

  for (const { regex, role, position } of officerPatterns) {
    let officerMatch: RegExpMatchArray | null = null;
    for (const r of regex) {
      officerMatch = text.match(r);
      if (officerMatch) break;
    }
    if (!officerMatch) continue;

    const offNameRaw = officerMatch[1];
    let truncateIdx = offNameRaw.length;
    const lowerOffNameRaw = offNameRaw.toLowerCase();
    for (const kw of BOUNDARY_KEYWORDS) {
      const kwIdx = lowerOffNameRaw.indexOf(kw);
      if (kwIdx !== -1 && kwIdx < truncateIdx) {
        truncateIdx = kwIdx;
      }
    }
    const digitMatch = offNameRaw.match(/\d/);
    if (digitMatch && digitMatch.index !== undefined && digitMatch.index < truncateIdx) {
      truncateIdx = digitMatch.index;
    }
    const offName = cleanName(offNameRaw.substring(0, truncateIdx));
    let offEmail = "";
    let offPhone = "";

    const markerText = position === "unshift" ? "Officer OneName" : "Officer TwoName";
    const idx = lines.findIndex((l) => l.includes(markerText));
    if (idx !== -1) {
      const stopMarker = position === "unshift" ? "Officer TwoName" : null;
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const scanLine = lines[i];
        if (stopMarker && scanLine.includes(stopMarker)) break;
        const emailM = scanLine.match(/Email\s*:?\s*([^\s\n]+)/i);
        if (emailM) offEmail = emailM[1].trim();
        const phone = extractPhoneNumber(scanLine);
        if (phone && !offPhone) offPhone = phone;
      }
    }

    if (offName && isValidContactName(offName) && !processedNames.has(offName.toLowerCase())) {
      processedNames.add(offName.toLowerCase());
      const contact: KeyContact = {
        role,
        name: offName,
        email: offEmail || DEFAULT_MSTC_OFFICER.email,
        phone: offPhone || "no contact info available",
      };

      if (position === "unshift") {
        keyContacts.unshift(contact);
      } else {
        const insertIdx = keyContacts.findIndex((c) =>
          c.role.includes("Site Contact"),
        );
        if (insertIdx !== -1) {
          keyContacts.splice(insertIdx, 0, contact);
        } else {
          keyContacts.push(contact);
        }
      }
    }
  }

  // ── 3. Fallback ───────────────────────────────────────────────────────────
  if (keyContacts.length === 0) {
    keyContacts.push({
      role: "Auction Officer (MSTC)",
      name: DEFAULT_MSTC_OFFICER.name,
      email: DEFAULT_MSTC_OFFICER.email,
      phone: "no contact info available",
    });
  }

  return keyContacts;
}
