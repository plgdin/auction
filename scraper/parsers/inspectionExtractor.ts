/**
 * Inspection details extractor for MSTC catalog PDFs.
 *
 * Extracts inspection schedule windows and contact references.
 */
import type { KeyContact, InspectionDetails } from "./types.js";

/**
 * Extract inspection schedule and contact details from catalog text.
 *
 * @param text     - The full raw catalog text.
 * @param contacts - The already-extracted key contacts (for fallback contact info).
 * @returns Structured inspection details.
 */
export function extractInspectionDetails(
  text: string,
  contacts: KeyContact[],
): InspectionDetails {
  let inspectionTime = "Unknown";

  // ── 1. Try unified structured/inline pattern matchers ─────────────────────
  const scheduleMatch =
    text.match(/Inspection\s+(?:window|schedule|date|dates|time|period|duration|allowed)\s*[:.-]\s*([^\n\r]+)/i) ||
    text.match(/Inspection\s*:\s*([^\n\r]+)/i) ||
    text.match(/Material\s+(?:can\s+be\s+inspected|inspection)\s+([^\n\r.]+)/i) ||
    text.match(/Inspection\s+from\s*([^\n\r.]+)/i);

  if (scheduleMatch) {
    let matchedTime = scheduleMatch[1].trim();

    // Clean trailing "date/time of download" text
    const downloadIdx = matchedTime
      .toLowerCase()
      .indexOf("date/time of download");
    if (downloadIdx !== -1) {
      matchedTime = matchedTime.substring(0, downloadIdx).trim();
    }

    // Truncate at known boundary keywords
    const boundaryKeywords = [
      "Scheduled",
      "Auction",
      "MSTC",
      "Lot Details",
      "Lot No",
    ];
    for (const kw of boundaryKeywords) {
      const kwIdx = matchedTime.indexOf(kw);
      if (kwIdx !== -1) {
        matchedTime = matchedTime.substring(0, kwIdx).trim();
      }
    }

    if (matchedTime && matchedTime.length > 5 && matchedTime.length < 150) {
      inspectionTime = matchedTime;
    }
  }

  // ── 3. Build contact reference ────────────────────────────────────────────
  const mainContact =
    contacts.find(
      (c) =>
        c.role.toLowerCase().includes("site") ||
        c.role.toLowerCase().includes("engineer"),
    ) || contacts[0];

  const inspectionContact = mainContact
    ? `${mainContact.name} (${mainContact.phone || "phone listed in catalog"})`
    : "Site In-Charge";

  return {
    time: inspectionTime,
    contact: inspectionContact,
  };
}
