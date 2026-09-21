import { describe, it, expect } from "vitest";
import {
  isValidPdfBuffer,
  parseGemBidPdfText,
} from "../utils/gem/gemBidDocumentService.js";

describe("GeM Bid Document Service & Text Parser", () => {
  describe("Binary Buffer Validation", () => {
    it("validates authentic PDF buffer starting with %PDF header", () => {
      const validPdf = Buffer.from(
        "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Bid Notice) >>\nendobj\ntrailer\n%%EOF"
      );
      expect(isValidPdfBuffer(validPdf)).toBe(true);
    });

    it("rejects HTML or session-timeout responses masquerading as PDF", () => {
      const htmlResponse = Buffer.from(
        "<!DOCTYPE html><html><body>Gateway timeout fetching document</body></html>"
      );
      expect(isValidPdfBuffer(htmlResponse)).toBe(false);

      const tinyBuffer = Buffer.from("%PDF");
      expect(isValidPdfBuffer(tinyBuffer)).toBe(false);
    });
  });

  describe("parseGemBidPdfText", () => {
    it("extracts untruncated item category, department, ministry, quantity, and buyer email", () => {
      const samplePdfText = `
Bid Details / बिड विवरण
Bid End Date/Time / बिड बंद होने की तारीख/समय: 09-06-2025 15:00:00
Bid Opening Date/Time / बिड खुलने की तारीख/समय: 09-06-2025 15:30:00
Bid Offer Validity (From End Date): 60 (Days)
Ministry/State Name / मंत्रालय/राज्य का नाम: Ministry Of Railways
Department Name / विभाग का नाम: Indian Railways
Organisation Name / संगठन का नाम: Southern Railway
Office Name / कार्यालय का नाम: Southern Railway Div Office
Total Quantity / कुल मात्रा: 250
Item Category / मद केटेगरी: Repair, Maintenance, and Installation of Solar Power Units (Q3)
Buyer Email: dmm@mdu.railnet.gov.in

Bid Number: GEM/2026/B/7902525
Dated: 30-05-2025
`;

      const metadata = parseGemBidPdfText(samplePdfText);

      expect(metadata.untruncatedItemName).toBe(
        "Repair, Maintenance, and Installation of Solar Power Units"
      );
      expect(metadata.departmentName).toBe("Indian Railways");
      expect(metadata.ministry).toBe("Ministry Of Railways");
      expect(metadata.organisation).toBe("Southern Railway");
      expect(metadata.officeName).toBe("Southern Railway Div Office");
      expect(metadata.quantity).toBe("250");
      expect(metadata.buyerEmail).toBe("dmm@mdu.railnet.gov.in");
      expect(metadata.endDate).toBe("2025-06-09T15:00:00+05:30");
    });

    it("handles fallback email discovery from text body when Buyer Email prefix is absent", () => {
      const samplePdfText = `
Item Category: High Performance Computing Cluster Servers
Department Name: DRDO
Ministry: Ministry of Defence
Contact queries can be forwarded to senior.scientist@drdo.gov.in regarding technical specifications.
`;

      const metadata = parseGemBidPdfText(samplePdfText);

      expect(metadata.untruncatedItemName).toBe(
        "High Performance Computing Cluster Servers"
      );
      expect(metadata.departmentName).toBe("DRDO");
      expect(metadata.buyerEmail).toBe("senior.scientist@drdo.gov.in");
    });
  });
});
