import { z } from "zod";

/**
 * Zod Schema for GeM Forward Auction Listings
 *
 * Validates parsed listings prior to Supabase database upsert.
 */
export const gemListingSchema = z
  .object({
    gem_auction_id: z
      .string()
      .trim()
      .min(1, "gem_auction_id must be a non-empty string"),
    title: z.string().trim().min(1, "title must be a non-empty string"),
    source_url: z.string().trim().min(1, "source_url must be a non-empty string"),

    reserve_price_value: z
      .number({ message: "reserve_price_value must be a number" })
      .positive("reserve_price_value must be a positive number")
      .nullable()
      .optional(),
    reserve_price_value_min: z
      .number({ message: "reserve_price_value_min must be a number" })
      .positive("reserve_price_value_min must be a positive number")
      .nullable()
      .optional(),
    reserve_price_value_max: z
      .number({ message: "reserve_price_value_max must be a number" })
      .positive("reserve_price_value_max must be a positive number")
      .nullable()
      .optional(),
    reserve_price_text: z.string().optional(),

    ministry: z.string().optional(),
    department: z.string().optional(),
    organisation: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
    full_address: z.string().optional(),
    location: z.string().optional(),
    location_unparsed: z.boolean().optional(),

    auction_start_date: z.string().nullable().optional(),
    auction_end_date: z.string().nullable().optional(),
    start_date_unparsed: z.boolean().optional(),
    end_date_unparsed: z.boolean().optional(),

    auction_status: z
      .enum(["live", "upcoming", "closed", "cancelled"], {
        message: "auction_status must be one of 'live', 'upcoming', 'closed', 'cancelled'",
      })
      .nullable()
      .optional(),

    document_url: z.string().optional(),
    document_urls: z.array(z.string()).optional(),
    category_name: z.string().optional(),
    raw_description: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.auction_start_date && data.auction_end_date) {
        const start = new Date(data.auction_start_date).getTime();
        const end = new Date(data.auction_end_date).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          return end >= start;
        }
      }
      return true;
    },
    {
      message: "auction_end_date cannot be before auction_start_date",
      path: ["auction_end_date"],
    }
  )
  .refine(
    (data) => {
      if (
        data.reserve_price_value_min != null &&
        data.reserve_price_value_max != null
      ) {
        return data.reserve_price_value_max >= data.reserve_price_value_min;
      }
      return true;
    },
    {
      message: "reserve_price_value_max cannot be less than reserve_price_value_min",
      path: ["reserve_price_value_max"],
    }
  );

export type ValidatedGeMListing = z.infer<typeof gemListingSchema>;
