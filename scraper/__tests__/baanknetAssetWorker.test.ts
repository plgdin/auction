import { describe, it, expect } from "vitest";
import {
  buildBaanknetHeaders,
  isValidPdfBuffer,
  getBaanknetStoragePath,
  extractUniqueDocUrls,
} from "../baanknetAssetWorker.js";

describe("BaankNet Document Asset Worker (baanknetAssetWorker.ts)", () => {
  describe("buildBaanknetHeaders", () => {
    it("constructs compliant headers with proper User-Agent and Referer", () => {
      const headers = buildBaanknetHeaders("https://cdn.baanknet.com/notices/doc_123.pdf");
      expect(headers["User-Agent"]).toBeDefined();
      expect(headers["Accept"]).toContain("application/pdf");
      expect(headers["Referer"]).toBe("https://cdn.baanknet.com/");
    });

    it("falls back gracefully when target URL is invalid", () => {
      const headers = buildBaanknetHeaders("invalid-url");
      expect(headers["User-Agent"]).toBeDefined();
      expect(headers["Referer"]).toBe("https://baanknet.com/");
    });
  });

  describe("isValidPdfBuffer", () => {
    it("returns true for valid PDF buffers starting with %PDF", () => {
      const validBuffer = Buffer.from("%PDF-1.7\nSample PDF payload content");
      expect(isValidPdfBuffer(validBuffer)).toBe(true);
    });

    it("returns false for HTML error responses", () => {
      const htmlBuffer = Buffer.from("<!DOCTYPE html><html><body>404 Not Found</body></html>");
      expect(isValidPdfBuffer(htmlBuffer)).toBe(false);
    });

    it("returns false for empty or undersized buffers", () => {
      expect(isValidPdfBuffer(Buffer.from(""))).toBe(false);
      expect(isValidPdfBuffer(Buffer.from("%PD"))).toBe(false);
      expect(isValidPdfBuffer(null as any)).toBe(false);
    });
  });

  describe("getBaanknetStoragePath", () => {
    it("generates structured and sanitized storage paths", () => {
      const storagePath = getBaanknetStoragePath(
        "BK-2026/08/99",
        "https://baanknet.com/uploads/notices/Property_Sale_Notice.pdf",
        0
      );
      expect(storagePath).toBe("baanknet-documents/BK-2026_08_99/Property_Sale_Notice.pdf");
    });

    it("ensures .pdf extension is added when missing", () => {
      const storagePath = getBaanknetStoragePath(
        "BK-100",
        "https://baanknet.com/view-document?id=456",
        0
      );
      expect(storagePath).toBe("baanknet-documents/BK-100/view-document.pdf");
    });

    it("falls back to indexed filename when URL has no pathname", () => {
      const storagePath = getBaanknetStoragePath(
        "BK-200",
        "https://baanknet.com/?doc=123",
        1
      );
      expect(storagePath).toBe("baanknet-documents/BK-200/document_2.pdf");
    });
  });

  describe("extractUniqueDocUrls", () => {
    it("combines and deduplicates document_url and document_urls", () => {
      const record = {
        id: "uuid-1",
        baanknet_auction_id: "BK-1",
        document_url: "https://baanknet.com/doc1.pdf",
        document_urls: [
          "https://baanknet.com/doc1.pdf",
          "https://baanknet.com/doc2.pdf",
          "javascript:void(0)",
          "",
        ],
      };

      const urls = extractUniqueDocUrls(record);
      expect(urls).toEqual([
        "https://baanknet.com/doc1.pdf",
        "https://baanknet.com/doc2.pdf",
      ]);
    });

    it("normalizes protocol-relative and domain-relative URLs", () => {
      const record = {
        id: "uuid-2",
        baanknet_auction_id: "BK-2",
        document_urls: [
          "//cdn.baanknet.com/doc3.pdf",
          "/uploads/notices/doc4.pdf",
        ],
      };

      const urls = extractUniqueDocUrls(record);
      expect(urls).toEqual([
        "https://cdn.baanknet.com/doc3.pdf",
        "https://baanknet.com/uploads/notices/doc4.pdf",
      ]);
    });

    it("returns empty array when record has no document links", () => {
      const record = {
        id: "uuid-3",
        baanknet_auction_id: "BK-3",
        document_url: null,
        document_urls: [],
      };

      const urls = extractUniqueDocUrls(record);
      expect(urls).toEqual([]);
    });
  });
});
