/**
 * Key contact extractor for MSTC catalog PDFs.
 *
 * Extracts site contacts ("Contact Person") and MSTC officers
 * ("Officer OneName", "Officer TwoName") from catalog text.
 */
import {
  DEFAULT_MSTC_OFFICER,
  DEFAULT_CONTACT_EMAIL,
} from "../../config.js";
import type { KeyContact } from "../types.js";

// ─── Internal Helpers ────────────────────────────────────────────────────────

const BOUNDARY_KEYWORDS = [
  "Inspection", "EMD", "Payment", "Special", "General",
  "Lot", "Item", "Description", "Location", "Quantity",
];

function sanitizeContactName(raw: string): string {
  let cleaned = raw
    .replace(/^[:\-–\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const kw of BOUNDARY_KEYWORDS) {
    const idx = cleaned.search(new RegExp(`\\b${kw}\\b`, "i"));
    if (idx > 0) {
      cleaned = cleaned.slice(0, idx).trim();
    }
  }
  return cleaned;
}

// ─── Extractor Implementation ────────────────────────────────────────────────

export function extractKeyContacts(cleanText: string): KeyContact[] {
  const contacts: KeyContact[] = [];
  const lines = cleanText.split("\n").map((l) => l.trim());

  // Pattern A: "Contact Person : Mr. John Doe / 9876543210"
  const contactPersonRe =
    /(?:Contact\s*Person|Site\s*Contact|Contact\s*Details?)\s*[:\-–]?\s*([^\n]+)/gi;

  let match: RegExpExecArray | null;
  while ((match = contactPersonRe.exec(cleanText)) !== null) {
    const rawVal = match[1].trim();
    const phoneMatch = rawVal.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
    const emailMatch = rawVal.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

    const namePart = rawVal
      .replace(/(\+?91[\s-]?)?[6-9]\d{9}/, "")
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, "")
      .replace(/[\/\,\-–]+/g, " ")
      .trim();

    const name = sanitizeContactName(namePart) || "Site Contact";
    const phone = phoneMatch ? phoneMatch[0] : undefined;
    const email = emailMatch ? emailMatch[0] : undefined;

    if (name.length > 2 && !contacts.some((c) => c.name === name)) {
      contacts.push({ name, role: "Site Contact", phone, email });
    }
  }

  // Pattern B: MSTC Officer One & Two
  const officerOneMatch = cleanText.match(/Officer\s*OneName\s*[:\-–]?\s*([^\n]+)/i);
  const officerTwoMatch = cleanText.match(/Officer\s*TwoName\s*[:\-–]?\s*([^\n]+)/i);

  if (officerOneMatch) {
    const rawVal = officerOneMatch[1].trim();
    const phoneMatch = rawVal.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
    const emailMatch = rawVal.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const namePart = rawVal.replace(/(\+?91[\s-]?)?[6-9]\d{9}/, "").trim();
    const name = sanitizeContactName(namePart) || "MSTC Officer";

    if (!contacts.some((c) => c.name === name)) {
      contacts.push({
        name,
        role: "MSTC Officer",
        phone: phoneMatch ? phoneMatch[0] : undefined,
        email: emailMatch ? emailMatch[0] : DEFAULT_CONTACT_EMAIL,
      });
    }
  }

  if (officerTwoMatch) {
    const rawVal = officerTwoMatch[1].trim();
    const phoneMatch = rawVal.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
    const namePart = rawVal.replace(/(\+?91[\s-]?)?[6-9]\d{9}/, "").trim();
    const name = sanitizeContactName(namePart) || "MSTC Co-Officer";

    if (!contacts.some((c) => c.name === name)) {
      contacts.push({
        name,
        role: "MSTC Officer",
        phone: phoneMatch ? phoneMatch[0] : undefined,
        email: DEFAULT_CONTACT_EMAIL,
      });
    }
  }

  // Fallback: line-by-line regex if no structured contacts found
  if (contacts.length === 0) {
    for (const line of lines) {
      if (/\b(?:Phone|Mobile|Tel|Call)\b/i.test(line)) {
        const phoneMatch = line.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
        if (phoneMatch) {
          contacts.push({
            name: DEFAULT_MSTC_OFFICER,
            role: "Helpdesk Contact",
            phone: phoneMatch[0],
            email: DEFAULT_CONTACT_EMAIL,
          });
          break;
        }
      }
    }
  }

  // Guaranteed fallback
  if (contacts.length === 0) {
    contacts.push({
      name: DEFAULT_MSTC_OFFICER,
      role: "MSTC Officer",
      email: DEFAULT_CONTACT_EMAIL,
    });
  }

  return contacts;
}
