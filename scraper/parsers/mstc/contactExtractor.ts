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
    .replace(/\s*\[\s*-?\s*\]\s*$/, "")
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

function isValidContactName(name: string): boolean {
  if (!name || name.length <= 2) return false;
  if (/^(none|nil|n\/a|-|unknown)$/i.test(name)) return false;
  if (/contact\s*person/i.test(name)) return false;
  if (/^(terms|lot|general|special|details|schedule|stps|ntpc)/i.test(name)) return false;
  if (name.endsWith(':')) return false;
  return true;
}

function cleanPhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d\s,+/-]/g, "").trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 7) {
    return cleaned.replace(/\s+/g, " ").trim();
  }
  return undefined;
}

// ─── Extractor Implementation ────────────────────────────────────────────────

export function extractKeyContacts(cleanText: string): KeyContact[] {
  const contacts: KeyContact[] = [];

  // Pattern A: Seller Details Block (Seller Details: ... Contact Person ... Telephone Number ...)
  const sellerBlockMatch = cleanText.match(
    /Seller\s*Details:?[\s\S]*?(?:Seller\s*Account|MSTC\s*Officer|Total\s*number|Auction\s*Specific)/i
  );
  if (sellerBlockMatch) {
    const sBlock = sellerBlockMatch[0];
    const contactPersonMatch = sBlock.match(/Contact\s*Person[:\-–\s]*([^\n]+)/i);
    const phoneMatch = sBlock.match(/(?:Telephone\s*Number|Phone\s*No|Mobile\s*No|Contact\s*No)[:\-–\s]*([^\n]+)/i);
    const emailMatch = sBlock.match(/(?:Seller\s*Email\s*Address|Email\s*Address|Email)[:\-–\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);

    if (contactPersonMatch) {
      const rawName = contactPersonMatch[1].trim();
      const name = sanitizeContactName(rawName);
      const phone = cleanPhone(phoneMatch ? phoneMatch[1] : undefined);
      const email = emailMatch ? emailMatch[1].trim() : DEFAULT_CONTACT_EMAIL;

      if (isValidContactName(name)) {
        contacts.push({
          name,
          role: "Site Contact",
          phone,
          email: email || DEFAULT_CONTACT_EMAIL,
        });
      }
    }
  }

  // Pattern B: MSTC Officer One & Two (with multi-line Name, Email, and Phone support)
  const officerOneBlock = cleanText.match(
    /(?:Officer\s*OneName|Officer\s*One|Name\s*&\s*Designation\s*of\s*Officer\s*OneName)[:\-–\s]*([^\n]+)(?:[\r\n]+[^\n]*){0,4}/i
  );
  if (officerOneBlock) {
    const block = officerOneBlock[0];
    const lines = block.split("\n").map((l) => l.trim());
    const rawName = lines[0].replace(/.*Officer\s*OneName[:\-–\s]*/i, "").trim();
    const emailMatch = block.match(/Email[:\-–\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const phoneMatch = block.match(/Phone[:\-–\s]*([\d\s,+/-]+)/i);

    const name = sanitizeContactName(rawName);
    if (name.length > 2 && !contacts.some((c) => c.name === name)) {
      contacts.push({
        name,
        role: "MSTC Officer",
        phone: cleanPhone(phoneMatch ? phoneMatch[1] : undefined),
        email: emailMatch ? emailMatch[1].trim() : DEFAULT_CONTACT_EMAIL,
      });
    }
  }

  const officerTwoBlock = cleanText.match(
    /(?:Officer\s*TwoName|Officer\s*Two|Name\s*&\s*Designation\s*of\s*Officer\s*TwoName)[:\-–\s]*([^\n]+)(?:[\r\n]+[^\n]*){0,4}/i
  );
  if (officerTwoBlock) {
    const block = officerTwoBlock[0];
    const lines = block.split("\n").map((l) => l.trim());
    const rawName = lines[0].replace(/.*Officer\s*TwoName[:\-–\s]*/i, "").trim();
    const emailMatch = block.match(/Email[:\-–\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const phoneMatch = block.match(/Phone[:\-–\s]*([\d\s,+/-]+)/i);

    const name = sanitizeContactName(rawName);
    if (name.length > 2 && !contacts.some((c) => c.name === name)) {
      contacts.push({
        name,
        role: "MSTC Officer",
        phone: cleanPhone(phoneMatch ? phoneMatch[1] : undefined),
        email: emailMatch ? emailMatch[1].trim() : DEFAULT_CONTACT_EMAIL,
      });
    }
  }

  // Pattern C: Lot-level Contact Details (e.g. in Lot Description / Parameters)
  const lotContactMatches = cleanText.matchAll(
    /Contact\s*Details\s*[:\-–]?\s*\n?([^\n]+)(?:[\r\n]+[^\n]*){0,8}/gi
  );
  for (const match of lotContactMatches) {
    const block = match[0];
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const name = sanitizeContactName(lines[1].replace(/Contact\s*Details\s*[:\-–]?/i, ""));
      const phoneMatch = block.match(
        /(?:Phone\s*(?:No)?|Mob(?:ile)?(?:\s*No)?|Tel(?:ephone)?(?:\s*No)?|Contact\s*No)[\s\w]*[:\-–]?\s*\n?\s*([\d\s,+/-]+)/i
      );
      const emailMatch = block.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (
        isValidContactName(name) &&
        !contacts.some((c) => c.name.toLowerCase() === name.toLowerCase())
      ) {
        contacts.push({
          name,
          role: "Site Contact",
          phone: cleanPhone(phoneMatch ? phoneMatch[1] : undefined),
          email: emailMatch ? emailMatch[0] : DEFAULT_CONTACT_EMAIL,
        });
      }
    }
  }

  // Pattern D: Legacy inline "Contact Person : Name / Phone" if no site contact extracted yet
  if (!contacts.some((c) => c.role === "Site Contact")) {
    const contactPersonRe =
      /(?:Contact\s*Person|Site\s*Contact)\s*[:\-–]?\s*([^\n]+)/gi;
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
      const email = emailMatch ? emailMatch[0] : DEFAULT_CONTACT_EMAIL;

      if (name.length > 2 && !contacts.some((c) => c.name === name)) {
        contacts.push({ name, role: "Site Contact", phone, email });
      }
    }
  }

  // Fallback: line-by-line regex if no contacts found at all
  if (contacts.length === 0) {
    const lines = cleanText.split("\n").map((l) => l.trim());
    for (const line of lines) {
      if (/\b(?:Phone|Mobile|Tel|Call)\b/i.test(line)) {
        const phoneMatch = line.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
        if (phoneMatch) {
          contacts.push({
            name: DEFAULT_MSTC_OFFICER.name,
            role: "Helpdesk Contact",
            phone: phoneMatch[0],
            email: DEFAULT_MSTC_OFFICER.email || DEFAULT_CONTACT_EMAIL,
          });
          break;
        }
      }
    }
  }

  // Guaranteed fallback
  if (contacts.length === 0) {
    contacts.push({
      name: DEFAULT_MSTC_OFFICER.name,
      role: "MSTC Officer",
      email: DEFAULT_MSTC_OFFICER.email || DEFAULT_CONTACT_EMAIL,
    });
  }

  return contacts;
}
