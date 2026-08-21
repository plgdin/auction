import { describe, it, expect, vi } from "vitest";
import { gemListingSchema } from "../gemListingSchema.js";
import { baanknetListingSchema } from "../baanknetListingSchema.js";

describe("Listing Schemas Validation (gemListingSchema & baanknetListingSchema)", () => {
  describe("GeM Listing Schema (gemListingSchema)", () => {
    const validGeMRecord = {
      gem_auction_id: "GEM-100234",
      title: "Scrap Iron and Steel Materials",
      source_url: "https://forwardauction.gem.gov.in/eprocure/view-auction-notice/100234",
      reserve_price_value: 500000,
      reserve_price_value_min: 500000,
      reserve_price_value_max: 750000,
      reserve_price_text: "₹ 5 Lakh - ₹ 7.5 Lakh",
      auction_start_date: "2026-08-25T10:00:00+05:30",
      auction_end_date: "2026-08-30T17:00:00+05:30",
      auction_status: "live" as const,
      location: "Maharashtra",
      category_name: "Metals | Ferrous",
    };

    it("accepts valid GeM listing record", () => {
      const result = gemListingSchema.safeParse(validGeMRecord);
      expect(result.success).toBe(true);
    });

    it("accepts null/undefined optional prices and dates", () => {
      const result = gemListingSchema.safeParse({
        gem_auction_id: "GEM-100235",
        title: "Office Furniture",
        source_url: "https://forwardauction.gem.gov.in/eprocure/view-auction-notice/100235",
        reserve_price_value: null,
        auction_start_date: null,
        auction_end_date: null,
        auction_status: null,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero or negative reserve_price_value", () => {
      const zeroPrice = gemListingSchema.safeParse({
        ...validGeMRecord,
        reserve_price_value: 0,
      });
      expect(zeroPrice.success).toBe(false);

      const negativePrice = gemListingSchema.safeParse({
        ...validGeMRecord,
        reserve_price_value: -15000,
      });
      expect(negativePrice.success).toBe(false);
    });

    it("rejects negative min/max price values or invalid price range ordering", () => {
      const negativeMin = gemListingSchema.safeParse({
        ...validGeMRecord,
        reserve_price_value_min: -500,
      });
      expect(negativeMin.success).toBe(false);

      const invertedRange = gemListingSchema.safeParse({
        ...validGeMRecord,
        reserve_price_value_min: 1000000,
        reserve_price_value_max: 500000,
      });
      expect(invertedRange.success).toBe(false);
      if (!invertedRange.success) {
        expect(invertedRange.error.issues[0].message).toContain(
          "reserve_price_value_max cannot be less than reserve_price_value_min"
        );
      }
    });

    it("rejects when auction_end_date is before auction_start_date", () => {
      const invalidDates = gemListingSchema.safeParse({
        ...validGeMRecord,
        auction_start_date: "2026-08-30T10:00:00+05:30",
        auction_end_date: "2026-08-20T10:00:00+05:30",
      });
      expect(invalidDates.success).toBe(false);
      if (!invalidDates.success) {
        expect(invalidDates.error.issues[0].message).toContain(
          "auction_end_date cannot be before auction_start_date"
        );
      }
    });

    it("rejects empty or whitespace-only identifier fields", () => {
      const emptyId = gemListingSchema.safeParse({
        ...validGeMRecord,
        gem_auction_id: "   ",
      });
      expect(emptyId.success).toBe(false);

      const emptyTitle = gemListingSchema.safeParse({
        ...validGeMRecord,
        title: "",
      });
      expect(emptyTitle.success).toBe(false);

      const emptyUrl = gemListingSchema.safeParse({
        ...validGeMRecord,
        source_url: "",
      });
      expect(emptyUrl.success).toBe(false);
    });

    it("rejects invalid status enum values", () => {
      const invalidStatus = gemListingSchema.safeParse({
        ...validGeMRecord,
        auction_status: "invalid_status" as any,
      });
      expect(invalidStatus.success).toBe(false);
    });
  });

  describe("BaankNet Listing Schema (baanknetListingSchema)", () => {
    const validBaanknetRecord = {
      baanknet_auction_id: "BN-44892",
      title: "Commercial Property at Andheri East",
      source_url: "https://baanknet.com/property/44892",
      reserve_price_value: 25000000,
      reserve_price_text: "₹ 2.5 Crore",
      bank_name: "State Bank of India",
      auction_start_date: "2026-09-01T11:00:00+05:30",
      auction_end_date: "2026-09-01T15:00:00+05:30",
      auction_status: "upcoming" as const,
      auction_module: "eauction",
    };

    it("accepts valid BaankNet listing record", () => {
      const result = baanknetListingSchema.safeParse(validBaanknetRecord);
      expect(result.success).toBe(true);
    });

    it("rejects zero or negative reserve_price_value", () => {
      const zeroPrice = baanknetListingSchema.safeParse({
        ...validBaanknetRecord,
        reserve_price_value: 0,
      });
      expect(zeroPrice.success).toBe(false);

      const negativePrice = baanknetListingSchema.safeParse({
        ...validBaanknetRecord,
        reserve_price_value: -1000,
      });
      expect(negativePrice.success).toBe(false);
    });

    it("rejects end date before start date", () => {
      const invalidDate = baanknetListingSchema.safeParse({
        ...validBaanknetRecord,
        auction_start_date: "2026-09-05T10:00:00Z",
        auction_end_date: "2026-09-01T10:00:00Z",
      });
      expect(invalidDate.success).toBe(false);
    });

    it("rejects empty baanknet_auction_id or title", () => {
      expect(
        baanknetListingSchema.safeParse({
          ...validBaanknetRecord,
          baanknet_auction_id: "",
        }).success
      ).toBe(false);

      expect(
        baanknetListingSchema.safeParse({
          ...validBaanknetRecord,
          title: "   ",
        }).success
      ).toBe(false);
    });

    it("rejects invalid status", () => {
      expect(
        baanknetListingSchema.safeParse({
          ...validBaanknetRecord,
          auction_status: "unauthorized_status" as any,
        }).success
      ).toBe(false);
    });
  });

  describe("End-to-End Ingestion Pipeline Mock Test", () => {
    it("ensures intentionally malformed records are filtered out and never reach Supabase", async () => {
      const mockSupabaseUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockSupabaseClient = {
        from: vi.fn().mockReturnValue({
          upsert: mockSupabaseUpsert,
        }),
      };

      const rawBatch = [
        // 1. Valid record
        {
          gem_auction_id: "GEM-VALID-1",
          title: "Valid Auction 1",
          source_url: "https://forwardauction.gem.gov.in/eprocure/1",
          reserve_price_value: 100000,
          auction_start_date: "2026-08-20T10:00:00Z",
          auction_end_date: "2026-08-25T10:00:00Z",
          auction_status: "live",
        },
        // 2. Malformed: zero price
        {
          gem_auction_id: "GEM-INVALID-PRICE",
          title: "Invalid Price Auction",
          source_url: "https://forwardauction.gem.gov.in/eprocure/2",
          reserve_price_value: 0,
          auction_start_date: "2026-08-20T10:00:00Z",
          auction_end_date: "2026-08-25T10:00:00Z",
          auction_status: "live",
        },
        // 3. Malformed: end date before start date
        {
          gem_auction_id: "GEM-INVALID-DATES",
          title: "Invalid Dates Auction",
          source_url: "https://forwardauction.gem.gov.in/eprocure/3",
          reserve_price_value: 200000,
          auction_start_date: "2026-08-30T10:00:00Z",
          auction_end_date: "2026-08-10T10:00:00Z",
          auction_status: "live",
        },
        // 4. Malformed: empty ID
        {
          gem_auction_id: "",
          title: "Empty ID Auction",
          source_url: "https://forwardauction.gem.gov.in/eprocure/4",
          reserve_price_value: 300000,
          auction_status: "live",
        },
        // 5. Valid record
        {
          gem_auction_id: "GEM-VALID-2",
          title: "Valid Auction 2",
          source_url: "https://forwardauction.gem.gov.in/eprocure/5",
          reserve_price_value: 450000,
          auction_start_date: "2026-08-21T10:00:00Z",
          auction_end_date: "2026-08-28T10:00:00Z",
          auction_status: "upcoming",
        },
      ];

      // Pipeline execution pattern used in scrapers:
      const validatedListings: any[] = [];
      let skippedCount = 0;

      for (const item of rawBatch) {
        const parseResult = gemListingSchema.safeParse(item);
        if (parseResult.success) {
          validatedListings.push(item);
        } else {
          skippedCount++;
        }
      }

      if (validatedListings.length > 0) {
        await mockSupabaseClient.from("gem_auctions").upsert(validatedListings);
      }

      // Assertions
      expect(skippedCount).toBe(3);
      expect(validatedListings.length).toBe(2);
      expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);

      const passedRecords = mockSupabaseUpsert.mock.calls[0][0];
      expect(passedRecords).toHaveLength(2);
      expect(passedRecords.map((r: any) => r.gem_auction_id)).toEqual([
        "GEM-VALID-1",
        "GEM-VALID-2",
      ]);

      // Assert none of the 3 malformed IDs reached Supabase
      const passedIds = passedRecords.map((r: any) => r.gem_auction_id);
      expect(passedIds).not.toContain("GEM-INVALID-PRICE");
      expect(passedIds).not.toContain("GEM-INVALID-DATES");
      expect(passedIds).not.toContain("");
    });
  });
});
