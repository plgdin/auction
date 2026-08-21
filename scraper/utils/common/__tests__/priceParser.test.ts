import { describe, it, expect } from "vitest";
import {
  parseIndianPrice,
  parseIndianPriceRange,
  parseReservePrice,
} from "../priceParser.js";
import {
  parseGeMLocation,
  parseGeMDate,
  normalizeGeMAuctionStatus,
} from "../../../parsers/gem/gemParser.js";

describe("Indian Price Parser & Range Parser (priceParser.ts)", () => {
  describe("Plain Rupees with commas & currency symbols", () => {
    it("parses plain amount with rupee symbol and Indian commas", () => {
      expect(parseIndianPrice("₹ 45,00,000")).toBe(4500000);
      expect(parseIndianPrice("₹45,00,000")).toBe(4500000);
      expect(parseIndianPrice("Rs. 45,00,000")).toBe(4500000);
      expect(parseIndianPrice("Rs 50,000")).toBe(50000);
      expect(parseIndianPrice("INR 1,50,000")).toBe(150000);
    });

    it("parses plain integer and float amounts without commas", () => {
      expect(parseIndianPrice("50000")).toBe(50000);
      expect(parseIndianPrice("1250000")).toBe(1250000);
      expect(parseIndianPrice("₹ 999.50")).toBe(1000);
    });
  });

  describe("Lakh / Lac variations", () => {
    it("parses Lakh amounts with decimals and integers", () => {
      expect(parseIndianPrice("20.3 Lakh")).toBe(2030000);
      expect(parseIndianPrice("₹ 20.3 Lakhs")).toBe(2030000);
      expect(parseIndianPrice("5 Lakh")).toBe(500000);
      expect(parseIndianPrice("1.5 Lakhs")).toBe(150000);
    });

    it("parses Lac / Lacs spelling variations", () => {
      expect(parseIndianPrice("₹ 20.3 Lac")).toBe(2030000);
      expect(parseIndianPrice("20.3 Lacs")).toBe(2030000);
      expect(parseIndianPrice("Rs. 10 Lac")).toBe(1000000);
      expect(parseIndianPrice("0.5 Lacs")).toBe(50000);
    });
  });

  describe("Crore / Cr variations", () => {
    it("parses Crore amounts with decimals and integers", () => {
      expect(parseIndianPrice("₹1.25 Crore")).toBe(12500000);
      expect(parseIndianPrice("1.25 Crores")).toBe(12500000);
      expect(parseIndianPrice("2 Crore")).toBe(20000000);
      expect(parseIndianPrice("0.75 Crore")).toBe(7500000);
    });

    it("parses Cr abbreviation variations", () => {
      expect(parseIndianPrice("₹ 1.25 Cr")).toBe(12500000);
      expect(parseIndianPrice("1.25Cr")).toBe(12500000);
      expect(parseIndianPrice("Rs. 5 Cr")).toBe(50000000);
    });
  });

  describe("Price Ranges (parseIndianPriceRange)", () => {
    it("parses range with full rupee comma-separated amounts", () => {
      const result = parseIndianPriceRange("₹10,00,000 - ₹15,00,000");
      expect(result).toEqual({
        min: 1000000,
        max: 1500000,
        value: 1000000,
      });
      // parseIndianPrice returns the min value for a range
      expect(parseIndianPrice("₹10,00,000 - ₹15,00,000")).toBe(1000000);
    });

    it("parses range with shared unit (e.g. 10 - 15 Lakh)", () => {
      const result = parseIndianPriceRange("10 - 15 Lakh");
      expect(result).toEqual({
        min: 1000000,
        max: 1500000,
        value: 1000000,
      });
    });

    it("parses range with 'to' delimiter and Crore units", () => {
      const result = parseIndianPriceRange("₹ 1.2 Crore to ₹ 1.5 Crore");
      expect(result).toEqual({
        min: 12000000,
        max: 15000000,
        value: 12000000,
      });
    });

    it("parses range with en-dash and em-dash", () => {
      const enDash = parseIndianPriceRange("5 Lakh – 10 Lakh");
      expect(enDash).toEqual({
        min: 500000,
        max: 1000000,
        value: 500000,
      });

      const emDash = parseIndianPriceRange("₹ 50,000 — ₹ 1,00,000");
      expect(emDash).toEqual({
        min: 50000,
        max: 100000,
        value: 50000,
      });
    });

    it("handles inverted range bounds by placing the smaller number as min", () => {
      const inverted = parseIndianPriceRange("₹ 20 Lakh - ₹ 10 Lakh");
      expect(inverted).toEqual({
        min: 1000000,
        max: 2000000,
        value: 1000000,
      });
    });
  });

  describe("Empty strings and unparseable input handling", () => {
    it("returns null for empty strings or whitespace (not 0, not NaN)", () => {
      expect(parseIndianPrice("")).toBeNull();
      expect(parseIndianPrice("   ")).toBeNull();
      expect(parseIndianPrice(null as any)).toBeNull();
      expect(parseIndianPrice(undefined as any)).toBeNull();

      expect(parseIndianPriceRange("")).toEqual({ min: null, max: null, value: null });
      expect(parseIndianPriceRange("   ")).toEqual({ min: null, max: null, value: null });
      expect(parseIndianPriceRange(null as any)).toEqual({ min: null, max: null, value: null });
      expect(parseIndianPriceRange(undefined as any)).toEqual({ min: null, max: null, value: null });
    });

    it("returns null for non-numeric garbage text (not 0, not NaN)", () => {
      expect(parseIndianPrice("Price on Request")).toBeNull();
      expect(parseIndianPrice("N/A")).toBeNull();
      expect(parseIndianPrice("Refer Tender Document")).toBeNull();
      expect(parseIndianPrice("Not Applicable")).toBeNull();
      expect(parseIndianPrice("TBD")).toBeNull();
      expect(parseIndianPrice("abcxyz")).toBeNull();

      expect(parseIndianPriceRange("Price on Request")).toEqual({ min: null, max: null, value: null });
      expect(parseIndianPriceRange("N/A - N/A")).toEqual({ min: null, max: null, value: null });
    });

    it("preserves parseReservePrice backward compatibility alias", () => {
      expect(parseReservePrice("₹ 25.5 Lakh")).toBe(2550000);
      expect(parseReservePrice("invalid")).toBeNull();
    });
  });
});

describe("GeM Parser Location & Date Defaults (gemParser.ts)", () => {
  describe("parseGeMLocation", () => {
    it("parses valid multi-part GeM location strings", () => {
      const result = parseGeMLocation("Kokrajhar - Kokrajhar - ASSAM - 783370");
      expect(result).toEqual({
        city: "Kokrajhar",
        state: "ASSAM",
        pincode: "783370",
        location: "ASSAM",
        location_unparsed: false,
      });
    });

    it("parses 3-part GeM location strings", () => {
      const result = parseGeMLocation("Mumbai - Maharashtra - 400001");
      expect(result).toEqual({
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        location: "Maharashtra",
        location_unparsed: false,
      });
    });

    it("never returns 'India' as a default when unparseable or empty", () => {
      const empty = parseGeMLocation("");
      expect(empty).toEqual({
        city: "",
        state: "",
        pincode: "",
        location: "",
        location_unparsed: true,
      });
      expect(empty.location).not.toBe("India");

      const nullInput = parseGeMLocation(null as any);
      expect(nullInput).toEqual({
        city: "",
        state: "",
        pincode: "",
        location: "",
        location_unparsed: true,
      });

      const whitespace = parseGeMLocation("   -   -   ");
      expect(whitespace).toEqual({
        city: "",
        state: "",
        pincode: "",
        location: "",
        location_unparsed: true,
      });
    });
  });

  describe("parseGeMDate", () => {
    it("parses standard GeM date formats into ISO strings", () => {
      const full = parseGeMDate("25-07-2026 14:30:00");
      expect(full).toBe("2026-07-25T14:30:00+05:30");

      const noSec = parseGeMDate("25/07/2026 14:30");
      expect(noSec).toBe("2026-07-25T14:30:00+05:30");

      const dateOnly = parseGeMDate("25-07-2026");
      expect(dateOnly).toBe("2026-07-25T00:00:00+05:30");
    });

    it("returns null for invalid or empty dates (never fabricates dates)", () => {
      expect(parseGeMDate("")).toBeNull();
      expect(parseGeMDate("   ")).toBeNull();
      expect(parseGeMDate(null as any)).toBeNull();
      expect(parseGeMDate("invalid-date-string")).toBeNull();
    });
  });

  describe("normalizeGeMAuctionStatus", () => {
    it("normalizes live status variations", () => {
      expect(normalizeGeMAuctionStatus("Live")).toBe("live");
      expect(normalizeGeMAuctionStatus("Live Auction")).toBe("live");
      expect(normalizeGeMAuctionStatus("ACTIVE")).toBe("live");
      expect(normalizeGeMAuctionStatus("In Progress")).toBe("live");
    });

    it("normalizes upcoming status variations", () => {
      expect(normalizeGeMAuctionStatus("Upcoming")).toBe("upcoming");
      expect(normalizeGeMAuctionStatus("Upcoming Auction")).toBe("upcoming");
      expect(normalizeGeMAuctionStatus("SCHEDULED")).toBe("upcoming");
      expect(normalizeGeMAuctionStatus("Future")).toBe("upcoming");
    });

    it("normalizes closed and cancelled variations", () => {
      expect(normalizeGeMAuctionStatus("Closed")).toBe("closed");
      expect(normalizeGeMAuctionStatus("Auction Ended")).toBe("closed");
      expect(normalizeGeMAuctionStatus("Completed")).toBe("closed");
      expect(normalizeGeMAuctionStatus("Cancelled")).toBe("cancelled");
      expect(normalizeGeMAuctionStatus("Canceled")).toBe("cancelled");
    });

    it("returns null for empty, unknown, or unparseable status signals (never guesses)", () => {
      expect(normalizeGeMAuctionStatus("")).toBeNull();
      expect(normalizeGeMAuctionStatus("   ")).toBeNull();
      expect(normalizeGeMAuctionStatus(null as any)).toBeNull();
      expect(normalizeGeMAuctionStatus("random text")).toBeNull();
    });
  });
});
