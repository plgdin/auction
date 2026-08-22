import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BaankNetListing } from "../parsers/baanknet/baanknetParser.js";

// Mock Supabase client
const mockDb = {
  auctions: new Map<string, any>(),
  photos: new Map<string, any[]>(),
};

const createChainableQuery = () => {
  const chain: any = {
    in: (col: string, ids: string[]) => {
      const results = ids
        .filter((id) => mockDb.auctions.has(id))
        .map((id) => ({ baanknet_auction_id: id }));
      return Promise.resolve({ data: results, error: null });
    },
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
  };
  return chain;
};

const mockSupabase = {
  from: (table: string) => {
    if (table === "baanknet_auctions") {
      return {
        select: () => createChainableQuery(),
        insert: (records: any[]) => {
          for (const r of records) {
            mockDb.auctions.set(r.baanknet_auction_id, { ...r });
          }
          return Promise.resolve({ data: records, error: null });
        },
        update: (fields: any) => ({
          eq: (col: string, val: string) => {
            if (col === "baanknet_auction_id" && mockDb.auctions.has(val)) {
              const existing = mockDb.auctions.get(val);
              mockDb.auctions.set(val, { ...existing, ...fields });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    }

    if (table === "baanknet_auction_photos") {
      return {
        insert: (records: any[]) => {
          for (const r of records) {
            const list = mockDb.photos.get(r.baanknet_auction_id) || [];
            list.push(r);
            mockDb.photos.set(r.baanknet_auction_id, list);
          }
          return Promise.resolve({ data: records, error: null });
        },
        delete: () => ({
          eq: (col: string, val: string) => {
            if (col === "baanknet_auction_id") {
              mockDb.photos.delete(val);
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    }

    return {
      select: () => createChainableQuery(),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    };
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mockSupabase,
}));

// Import upsertListings after mocking supabase
const { upsertListings } = await import("../baanknetScraper.js");

function createSampleListing(overrides: Partial<BaankNetListing> = {}): BaankNetListing {
  return {
    baanknet_auction_id: "TEST-1001",
    bank_property_id: "PROP-1001",
    title: "Initial Residential Flat in Mumbai",
    property_type: "Residential Flat",
    reserve_price_text: "₹ 50,00,000",
    reserve_price_value: 5000000,
    bank_name: "State Bank of India",
    state: "Maharashtra",
    city: "Mumbai",
    pincode: "400001",
    full_address: "Flat 101, Marine Drive, Mumbai",
    location: "Maharashtra",
    auction_start_date: "2026-09-01T10:00:00+05:30",
    auction_end_date: "2026-09-01T16:00:00+05:30",
    auction_status: "upcoming",
    source_url: "https://baanknet.com/auction-detail/TEST-1001",
    category_name: "Real Estate | Residential",
    raw_description: "Initial description",
    auction_module: "eauction_psb",
    dedup_fingerprint: "fingerprint-1001",
    ...overrides,
  };
}

describe("BaankNet Symmetric Database Upsert (upsertListings)", () => {
  beforeEach(() => {
    mockDb.auctions.clear();
    mockDb.photos.clear();
  });

  describe("Insert Branch", () => {
    it("inserts a brand new listing with all core and enriched fields", async () => {
      const listing = createSampleListing({
        baanknet_auction_id: "NEW-001",
        title: "2 BHK Apartment in Bengaluru",
        reserve_price_value: 7500000,
        city: "Bengaluru",
        state: "Karnataka",
        carpet_area: "1200 sq.ft.",
        photo_urls: ["https://cdn.example.com/img1.jpg", "https://cdn.example.com/img2.jpg"],
      });

      await upsertListings([listing]);

      const stored = mockDb.auctions.get("NEW-001");
      expect(stored).toBeDefined();
      expect(stored.title).toBe("2 BHK Apartment in Bengaluru");
      expect(stored.reserve_price_value).toBe(7500000);
      expect(stored.city).toBe("Bengaluru");
      expect(stored.carpet_area).toBe("1200 sq.ft.");

      // Check photos
      const photos = mockDb.photos.get("NEW-001");
      expect(photos).toBeDefined();
      expect(photos?.length).toBe(2);
      expect(photos?.[0].photo_url).toBe("https://cdn.example.com/img1.jpg");
    });
  });

  describe("Update Branch (Symmetric Field Coverage)", () => {
    it("updates existing record with changed title, address, bank name, category, and reserve price", async () => {
      // 1. First insert initial listing
      const initial = createSampleListing({
        baanknet_auction_id: "UPDATE-001",
        title: "Showing 10000+ Results Found (Old Garbage Title)",
        category_name: "Unknown | Default",
        full_address: "Old Incomplete Address",
        bank_name: "Old Bank",
        reserve_price_value: 3000000,
        city: "Pune",
        state: "Maharashtra",
      });

      await upsertListings([initial]);
      expect(mockDb.auctions.get("UPDATE-001")?.title).toBe("Showing 10000+ Results Found (Old Garbage Title)");

      // 2. Call upsertListings with cleaned/updated data
      const cleaned = createSampleListing({
        baanknet_auction_id: "UPDATE-001",
        title: "3 BHK Luxury Villa in Pune, Maharashtra",
        category_name: "Real Estate | Residential Villa",
        full_address: "Plot 42, Koregaon Park, Pune - 411001",
        bank_name: "Bank of Baroda",
        reserve_price_value: 3500000,
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        carpet_area: "2400 sq.ft.",
        possession_status: "Physical Possession",
        dedup_fingerprint: "new-clean-fingerprint",
      });

      await upsertListings([cleaned]);

      // 3. Verify ALL previously insert-only fields were actually overwritten in DB
      const updated = mockDb.auctions.get("UPDATE-001");
      expect(updated).toBeDefined();
      expect(updated.title).toBe("3 BHK Luxury Villa in Pune, Maharashtra");
      expect(updated.category_name).toBe("Real Estate | Residential Villa");
      expect(updated.full_address).toBe("Plot 42, Koregaon Park, Pune - 411001");
      expect(updated.bank_name).toBe("Bank of Baroda");
      expect(updated.reserve_price_value).toBe(3500000);
      expect(updated.pincode).toBe("411001");
      expect(updated.carpet_area).toBe("2400 sq.ft.");
      expect(updated.possession_status).toBe("Physical Possession");
      expect(updated.dedup_fingerprint).toBe("new-clean-fingerprint");
    });

    it("syncs updated photos when an existing record is re-scraped", async () => {
      const initial = createSampleListing({
        baanknet_auction_id: "PHOTO-001",
        photo_urls: ["https://cdn.example.com/old1.jpg"],
      });
      await upsertListings([initial]);
      expect(mockDb.photos.get("PHOTO-001")?.length).toBe(1);

      const updated = createSampleListing({
        baanknet_auction_id: "PHOTO-001",
        photo_urls: ["https://cdn.example.com/new1.jpg", "https://cdn.example.com/new2.jpg", "https://cdn.example.com/new3.jpg"],
      });
      await upsertListings([updated]);

      const photos = mockDb.photos.get("PHOTO-001");
      expect(photos?.length).toBe(3);
      expect(photos?.[0].photo_url).toBe("https://cdn.example.com/new1.jpg");
      expect(photos?.[2].photo_url).toBe("https://cdn.example.com/new3.jpg");
    });
  });

  describe("Zod Validation & Rejection Path", () => {
    it("rejects invalid records, skips them, and processes valid records in the same batch", async () => {
      const validItem = createSampleListing({
        baanknet_auction_id: "VALID-001",
        title: "Valid Auction Asset",
      });

      const invalidItem = {
        baanknet_auction_id: "", // Missing required ID -> should fail Zod validation
        title: "Invalid Listing with Missing ID",
        auction_status: "INVALID_STATUS",
      } as any;

      await upsertListings([validItem, invalidItem]);

      // Valid item must be in DB
      expect(mockDb.auctions.get("VALID-001")).toBeDefined();
      // Invalid item must not be inserted
      expect(mockDb.auctions.has("")).toBe(false);
      expect(mockDb.auctions.size).toBe(1);
    });

    it("handles empty arrays gracefully without DB calls", async () => {
      await upsertListings([]);
      expect(mockDb.auctions.size).toBe(0);
    });
  });
});
