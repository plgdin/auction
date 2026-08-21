import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import {
  extractEAuctionDetail,
  normalizeDocumentUrl,
  mergeDetailData,
} from "../baanknetDetailParser.js";

const FIXTURES_DIR = path.resolve(__dirname, "./fixtures");

function readFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf-8");
}

describe("BaankNet Detail Page Parser (baanknetDetailParser.ts)", () => {
  let dom: JSDOM | null = null;

  afterEach(() => {
    // Restore global DOM bindings
    delete (global as any).window;
    delete (global as any).document;
    dom = null;
  });

  describe("normalizeDocumentUrl", () => {
    it("canonicalizes query parameters in deterministic alphabetical order", () => {
      const urlA = "https://baanknet.com/download.php?id=123&doc=notice&type=pdf";
      const urlB = "https://baanknet.com/download.php?type=pdf&doc=notice&id=123";
      expect(normalizeDocumentUrl(urlA)).toBe(normalizeDocumentUrl(urlB));
      expect(normalizeDocumentUrl(urlA)).toBe("https://baanknet.com/download.php?doc=notice&id=123&type=pdf");
    });

    it("strips trailing slash on pathname and removes tracking parameters", () => {
      const dirtyUrl = "https://baanknet.com/files/notice_500.pdf/?timestamp=123456&nocache=true";
      const cleanUrl = normalizeDocumentUrl(dirtyUrl);
      expect(cleanUrl).toBe("https://baanknet.com/files/notice_500.pdf");
    });

    it("resolves relative and protocol-relative paths to absolute HTTPS URLs", () => {
      expect(normalizeDocumentUrl("/uploads/notice.pdf")).toBe("https://baanknet.com/uploads/notice.pdf");
      expect(normalizeDocumentUrl("//cdn.baanknet.com/doc.pdf")).toBe("https://cdn.baanknet.com/doc.pdf");
    });

    it("rejects non-document asset links and javascript handlers", () => {
      expect(normalizeDocumentUrl("javascript:void(0)")).toBeNull();
      expect(normalizeDocumentUrl("#")).toBeNull();
      expect(normalizeDocumentUrl("https://baanknet.com/banner.png")).toBeNull();
      expect(normalizeDocumentUrl("https://baanknet.com/styles.css")).toBeNull();
    });
  });

  describe("HTML Fixture 1: Tabbed Navigation & Standard Documents", () => {
    beforeEach(() => {
      const html = readFixture("detail_tabbed_documents.html");
      dom = new JSDOM(html, { url: "https://baanknet.com/eauction-psb/property-detail/98402" });
      (global as any).window = dom.window;
      (global as any).document = dom.window.document;
    });

    it("extracts all tabbed document attachments, photos, and rich metadata", () => {
      const detail = extractEAuctionDetail(["State Bank of India"]);

      // 1. Documents extraction
      expect(detail.documentUrls).toHaveLength(3);
      expect(detail.documentUrls).toEqual([
        "https://baanknet.com/uploads/notices/SBI_Sale_Notice_98402.pdf",
        "https://cdn.baanknet.com/notices/Tender_Terms_SBI_98402.pdf",
        "https://baanknet.com/uploads/annexures/Annexure_II_III_98402.pdf",
      ]);
      expect(detail.documentUrl).toBe("https://baanknet.com/uploads/notices/SBI_Sale_Notice_98402.pdf");

      // 2. Photos extraction
      expect(detail.photoUrls).toHaveLength(2);
      expect(detail.photoUrls[0]).toBe("https://baanknet.com/property/images/prop_98402_main.jpg");

      // 3. Metadata fields
      expect(detail.borrowerName).toBe("M/s Apex Infra Developers Pvt Ltd");
      expect(detail.carpetArea).toBe("1,450 sq ft");
      expect(detail.furnishing).toBe("Semi-Furnished");
      expect(detail.possessionStatus).toBe("Physical");
      expect(detail.actionType).toBe("SARFAESI");
      expect(detail.district).toBe("Mumbai City");
      expect(detail.inspectionStartDate).toBe("2026-09-01 10:00");
      expect(detail.inspectionEndDate).toBe("2026-09-02 16:00");
      expect(detail.emdEndDate).toBe("2026-09-10 17:00");
      expect(detail.emdAmountText).toBe("₹ 25,00,000");
      expect(detail.lenderName).toBe("State Bank of India");
    });
  });

  describe("HTML Fixture 2: Accordion Containers & Generic Numeric URLs", () => {
    beforeEach(() => {
      const html = readFixture("detail_accordion_numeric_urls.html");
      dom = new JSDOM(html, { url: "https://ibbi.baanknet.com/view-auction/4410" });
      (global as any).window = dom.window;
      (global as any).document = dom.window.document;
    });

    it("extracts document links from accordion sections with numeric URLs and data-url buttons", () => {
      const detail = extractEAuctionDetail(["Bank of Baroda"]);

      expect(detail.documentUrls).toHaveLength(3);
      expect(detail.documentUrls).toEqual([
        "https://ibbi.baanknet.com/getfile?id=8821&type=pdf",
        "https://ibbi.baanknet.com/download-attachment?doc_id=9920",
        "https://ibbi.baanknet.com/api/files/stream?asset_id=4410&format=pdf",
      ]);

      expect(detail.lenderName).toBe("Bank of Baroda");
      expect(detail.actionType).toBe("IBC");
      expect(detail.carpetArea).toBe("45,000 sq ft");
    });
  });

  describe("HTML Fixture 3: Query Parameter Deduplication & Event Handlers", () => {
    beforeEach(() => {
      const html = readFixture("detail_multidoc_dedup.html");
      dom = new JSDOM(html, { url: "https://baanknet.com/property-listing/detail" });
      (global as any).window = dom.window;
      (global as any).document = dom.window.document;
    });

    it("correctly deduplicates reordered queries and extracts onclick documents", () => {
      const detail = extractEAuctionDetail();

      // Should deduplicate link A/B into 1, relative vs full notice into 1, plus onclick tender terms = 3 unique docs
      expect(detail.documentUrls).toHaveLength(3);
      expect(detail.documentUrls).toEqual([
        "https://baanknet.com/download.php?doc=sale_notice&id=5001",
        "https://baanknet.com/uploads/notices/possession_notice.pdf",
        "https://baanknet.com/files/tender_terms.pdf",
      ]);

      expect(detail.borrowerName).toBe("Ramesh Kumar Sharma");
      expect(detail.carpetArea).toBe("3,200 sq ft");
      expect(detail.possessionStatus).toBe("Symbolic");
    });
  });

  describe("mergeDetailData helper", () => {
    it("merges scraped detail data into the listing item without overwriting existing non-empty values", () => {
      const rawItem: any = {
        auctionId: "BK-1",
        title: "Test Property",
        bankName: "Known Bank",
      };

      const detailData = {
        photoUrls: ["https://baanknet.com/photo1.jpg"],
        thumbnailUrl: "https://baanknet.com/photo1.jpg",
        borrowerName: "John Doe",
        borrowerNames: ["John Doe", "Jane Doe"],
        description: "Great residential flat",
        documentUrl: "https://baanknet.com/notice.pdf",
        documentUrls: ["https://baanknet.com/notice.pdf"],
        carpetArea: "1000 sqft",
        furnishing: "Furnished",
        possessionStatus: "Physical",
        actionType: "SARFAESI",
        district: "Pune",
        inspectionStartDate: "2026-08-25 10:00",
        inspectionEndDate: "2026-08-26 16:00",
        emdEndDate: "2026-08-30 17:00",
        emdAmountText: "₹ 5,00,000",
        contactPerson: "Branch Manager",
        contactPhone: "9876543210",
        lenderName: "State Bank of India",
      };

      mergeDetailData(rawItem, detailData);

      expect(rawItem.borrowerName).toBe("John Doe");
      expect(rawItem.borrowerNames).toEqual(["John Doe", "Jane Doe"]);
      expect(rawItem.documentUrl).toBe("https://baanknet.com/notice.pdf");
      expect(rawItem.documentUrls).toEqual(["https://baanknet.com/notice.pdf"]);
      expect(rawItem.carpetArea).toBe("1000 sqft");
      expect(rawItem.photoUrls).toEqual(["https://baanknet.com/photo1.jpg"]);
      expect(rawItem.bankName).toBe("Known Bank"); // Kept original
    });
  });
});
