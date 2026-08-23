import { z } from "zod";

/**
 * Zod Schema for BaankNet Auction Listings
 *
 * Validates parsed listings prior to Supabase database upsert/insert.
 */
export const baanknetListingSchema = z
  .object({
    baanknet_auction_id: z
      .string()
      .trim()
      .min(1, "baanknet_auction_id must be a non-empty string"),
    title: z.string().trim().min(1, "title must be a non-empty string"),
    source_url: z.string().trim().min(1, "source_url must be a non-empty string"),

    reserve_price_value: z
      .number({ message: "reserve_price_value must be a number" })
      .positive("reserve_price_value must be a positive number")
      .nullable()
      .optional(),
    reserve_price_text: z.string().optional(),

    bank_property_id: z.string().optional(),
    property_type: z.string().optional(),
    bank_name: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
    full_address: z.string().optional(),
    location: z.string().optional(),
    category_name: z.string().optional(),
    raw_description: z.string().optional(),
    document_url: z.string().optional(),

    auction_start_date: z.string().nullable().optional(),
    auction_end_date: z.string().nullable().optional(),

    auction_status: z
      .enum(["live", "upcoming", "closed", "cancelled"], {
        message: "auction_status must be one of 'live', 'upcoming', 'closed', 'cancelled'",
      })
      .nullable()
      .optional(),

    // Multi-module detail fields
    auction_module: z.string().optional(),
    carpet_area: z.string().optional(),
    carpet_area_sqft: z.number().nullable().optional(),
    furnishing: z.string().optional(),
    possession_status: z.string().optional(),
    action_type: z.string().optional(),
    district: z.string().optional(),
    inspection_start_date: z.string().nullable().optional(),
    inspection_end_date: z.string().nullable().optional(),
    emd_end_date: z.string().nullable().optional(),
    borrower_name: z.string().optional(),
    borrower_names: z.array(z.string()).optional(),
    property_description: z.string().optional(),
    photo_count: z.number().optional(),
    thumbnail_url: z.string().optional(),
    photo_urls: z.array(z.string()).optional(),
    document_urls: z.array(z.string()).optional(),
    emd_amount_text: z.string().optional(),
    emd_amount_value: z.number().nullable().optional(),
    bid_increment_text: z.string().optional(),
    bid_increment_amount: z.number().nullable().optional(),
    emd_account_number: z.string().optional(),
    emd_account_ifsc: z.string().optional(),
    emd_bank_name: z.string().optional(),
    outstanding_dues_text: z.string().optional(),
    outstanding_dues_value: z.number().nullable().optional(),
    tender_fee_text: z.string().optional(),
    tender_fee_value: z.number().nullable().optional(),
    cersai_id: z.string().optional(),
    title_type: z.string().optional(),
    encumbrances_text: z.string().optional(),
    branch_name: z.string().optional(),
    officer_designation: z.string().optional(),
    officer_email: z.string().optional(),
    contact_person: z.string().optional(),
    contact_phone: z.string().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    map_url: z.string().optional(),
    boundaries: z
      .object({
        north: z.string().optional(),
        south: z.string().optional(),
        east: z.string().optional(),
        west: z.string().optional(),
      })
      .optional(),
    corporate_debtor_name: z.string().optional(),
    corporate_debtor_cin: z.string().optional(),
    liquidator_reg_no: z.string().optional(),
    liquidator_email: z.string().optional(),
    nclt_bench: z.string().optional(),
    nclt_case_no: z.string().optional(),
    process_memo_url: z.string().optional(),
    extracted_pdf_text: z.string().optional(),
    dedup_fingerprint: z.string().optional(),
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
  );

export type ValidatedBaankNetListing = z.infer<typeof baanknetListingSchema>;
