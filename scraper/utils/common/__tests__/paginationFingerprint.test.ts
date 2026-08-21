import { describe, it, expect, vi } from "vitest";
import {
  computeListingsFingerprint,
  isPaginationStalled,
} from "../fingerprint.js";

describe("Pagination Fingerprint & Stall Detection (fingerprint.ts)", () => {
  describe("computeListingsFingerprint", () => {
    it("generates deterministic SHA-256 hash for list of IDs", () => {
      const hash1 = computeListingsFingerprint(["1001", "1002", "1003"]);
      const hash2 = computeListingsFingerprint(["1001", "1002", "1003"]);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces order-independent fingerprint by sorting input IDs", () => {
      const hashA = computeListingsFingerprint(["300", "100", "200"]);
      const hashB = computeListingsFingerprint(["100", "200", "300"]);
      expect(hashA).toBe(hashB);
    });

    it("filters out null, undefined, and empty string elements", () => {
      const clean = computeListingsFingerprint(["100", "200"]);
      const dirty = computeListingsFingerprint(["100", null, "  ", undefined, "200"]);
      expect(dirty).toBe(clean);
    });

    it("returns empty string for empty input arrays", () => {
      expect(computeListingsFingerprint([])).toBe("");
      expect(computeListingsFingerprint([null, undefined] as any)).toBe("");
    });
  });

  describe("isPaginationStalled", () => {
    it("returns true when two non-empty fingerprints match", () => {
      const fp = computeListingsFingerprint(["A1", "A2"]);
      expect(isPaginationStalled(fp, fp)).toBe(true);
    });

    it("returns false when fingerprints differ", () => {
      const fp1 = computeListingsFingerprint(["A1", "A2"]);
      const fp2 = computeListingsFingerprint(["B1", "B2"]);
      expect(isPaginationStalled(fp1, fp2)).toBe(false);
    });

    it("returns false when either fingerprint is empty", () => {
      expect(isPaginationStalled("", "some-hash")).toBe(false);
      expect(isPaginationStalled("some-hash", "")).toBe(false);
      expect(isPaginationStalled("", "")).toBe(false);
    });
  });

  describe("Pagination Loop Simulation", () => {
    it("advances through normal changing pages up to maxPages", async () => {
      const mockPages = [
        ["AUC-1", "AUC-2", "AUC-3"],
        ["AUC-4", "AUC-5", "AUC-6"],
        ["AUC-7", "AUC-8", "AUC-9"],
      ];

      let currentPage = 1;
      const maxPages = 3;
      const scrapedPages: number[] = [];
      let lastPageFingerprint = "";

      while (currentPage <= maxPages) {
        const rawItemIds = mockPages[currentPage - 1];
        const currentFingerprint = computeListingsFingerprint(rawItemIds);

        if (currentPage > 1 && isPaginationStalled(lastPageFingerprint, currentFingerprint)) {
          break;
        }
        lastPageFingerprint = currentFingerprint;
        scrapedPages.push(currentPage);

        currentPage++;
      }

      expect(scrapedPages).toEqual([1, 2, 3]);
      expect(currentPage).toBe(4);
    });

    it("stops pagination immediately on identical consecutive page instead of spinning to maxPages", async () => {
      // Simulate page 1 and page 2 returning identical content (e.g. Next button click didn't change DOM)
      const mockStalledPages = [
        ["STALL-1", "STALL-2"],
        ["STALL-1", "STALL-2"], // Identical content on next page
        ["STALL-1", "STALL-2"],
        ["STALL-1", "STALL-2"],
        ["STALL-1", "STALL-2"],
      ];

      let currentPage = 1;
      const maxPages = 100; // Intentionally high limit to prove it terminates early
      const scrapedPages: number[] = [];
      let lastPageFingerprint = "";
      const warnSpy = vi.fn();

      while (currentPage <= maxPages) {
        const rawItemIds = mockStalledPages[Math.min(currentPage - 1, mockStalledPages.length - 1)];
        const currentFingerprint = computeListingsFingerprint(rawItemIds);

        if (currentPage > 1 && isPaginationStalled(lastPageFingerprint, currentFingerprint)) {
          warnSpy(
            `Detected identical page content on page ${currentPage}. Stopping crawl.`
          );
          break;
        }
        lastPageFingerprint = currentFingerprint;
        scrapedPages.push(currentPage);

        currentPage++;
      }

      // Assert it stopped after page 1 (detected stall on page 2 before processing it)
      expect(scrapedPages).toEqual([1]);
      expect(currentPage).toBe(2);
      expect(warnSpy).toHaveBeenCalledWith(
        "Detected identical page content on page 2. Stopping crawl."
      );
    });
  });
});
