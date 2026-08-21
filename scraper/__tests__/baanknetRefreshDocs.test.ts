import { describe, it, expect } from "vitest";
import { computeDocumentDiff } from "../baanknetScraper.js";

describe("BaankNet Document Refresh & Audit Pipeline (baanknetScraper.ts)", () => {
  describe("computeDocumentDiff", () => {
    it("reports hasChanged: false when stored and extracted URLs match exactly", () => {
      const stored = [
        "https://baanknet.com/uploads/notices/notice_1.pdf",
        "https://baanknet.com/uploads/notices/terms_2.pdf",
      ];
      const extracted = [
        "https://baanknet.com/uploads/notices/notice_1.pdf",
        "https://baanknet.com/uploads/notices/terms_2.pdf",
      ];

      const diff = computeDocumentDiff(stored, extracted);

      expect(diff.hasChanged).toBe(false);
      expect(diff.newlyDiscoveredUrls).toEqual([]);
      expect(diff.disappearedUrls).toEqual([]);
      expect(diff.unchangedUrls).toHaveLength(2);
    });

    it("detects newly discovered documents that were missed in previous partial scrapes", () => {
      const stored = ["https://baanknet.com/uploads/notices/notice_1.pdf"];
      const extracted = [
        "https://baanknet.com/uploads/notices/notice_1.pdf",
        "https://baanknet.com/uploads/notices/annexure_2.pdf",
        "https://baanknet.com/uploads/notices/tender_form_3.pdf",
      ];

      const diff = computeDocumentDiff(stored, extracted);

      expect(diff.hasChanged).toBe(true);
      expect(diff.newlyDiscoveredUrls).toEqual([
        "https://baanknet.com/uploads/notices/annexure_2.pdf",
        "https://baanknet.com/uploads/notices/tender_form_3.pdf",
      ]);
      expect(diff.disappearedUrls).toEqual([]);
      expect(diff.unchangedUrls).toEqual(["https://baanknet.com/uploads/notices/notice_1.pdf"]);
    });

    it("detects and flags documents that have disappeared from source page for auditing", () => {
      const stored = [
        "https://baanknet.com/uploads/notices/notice_1.pdf",
        "https://baanknet.com/uploads/notices/deleted_memo.pdf",
      ];
      const extracted = ["https://baanknet.com/uploads/notices/notice_1.pdf"];

      const diff = computeDocumentDiff(stored, extracted);

      expect(diff.hasChanged).toBe(true);
      expect(diff.newlyDiscoveredUrls).toEqual([]);
      expect(diff.disappearedUrls).toEqual(["https://baanknet.com/uploads/notices/deleted_memo.pdf"]);
      expect(diff.unchangedUrls).toEqual(["https://baanknet.com/uploads/notices/notice_1.pdf"]);
    });

    it("accurately handles both additions and removals simultaneously", () => {
      const stored = [
        "https://baanknet.com/doc_old.pdf",
        "https://baanknet.com/doc_shared.pdf",
      ];
      const extracted = [
        "https://baanknet.com/doc_shared.pdf",
        "https://baanknet.com/doc_new.pdf",
      ];

      const diff = computeDocumentDiff(stored, extracted);

      expect(diff.hasChanged).toBe(true);
      expect(diff.newlyDiscoveredUrls).toEqual(["https://baanknet.com/doc_new.pdf"]);
      expect(diff.disappearedUrls).toEqual(["https://baanknet.com/doc_old.pdf"]);
      expect(diff.unchangedUrls).toEqual(["https://baanknet.com/doc_shared.pdf"]);
    });

    it("handles null, undefined, empty and duplicate entries gracefully", () => {
      const diff1 = computeDocumentDiff([], []);
      expect(diff1.hasChanged).toBe(false);
      expect(diff1.newlyDiscoveredUrls).toEqual([]);
      expect(diff1.disappearedUrls).toEqual([]);

      const diff2 = computeDocumentDiff(
        ["https://baanknet.com/doc.pdf", "https://baanknet.com/doc.pdf", ""],
        ["https://baanknet.com/doc.pdf"]
      );
      expect(diff2.hasChanged).toBe(false);
    });
  });
});
