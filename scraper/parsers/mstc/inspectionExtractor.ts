/**
 * Inspection details extractor for MSTC catalog PDFs.
 */
import type { KeyContact, InspectionDetails } from "../types.js";

export function extractInspectionDetails(
  text: string,
  contacts: KeyContact[],
): InspectionDetails {
  let inspectionTime = "Unknown";

  const timeMatch = text.match(
    /(?:Inspection\s*Time|Timing|Hours?)\s*[:\-–]?\s*([^\n]+)/i
  );
  if (timeMatch) {
    inspectionTime = timeMatch[1].trim();
  } else if (/working\s*days/i.test(text)) {
    inspectionTime = "On all working days during working hours";
  }

  const primaryContact = contacts[0];
  const contactName = primaryContact ? primaryContact.name : "Site Contact Officer";
  const contactPhone = primaryContact?.phone || "See Catalog Details";

  return {
    time: inspectionTime,
    contact: `${contactName} (${contactPhone})`,
    inspectionTime,
    contactPerson: contactName,
    contactPhone,
  };
}
