import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET = "auction_documents";
const PUBLIC_PREFIX = `${supabaseUrl}/storage/v1/object/public/${BUCKET}`;

async function processBatch(records: any[]): Promise<number> {
  const concurrencyLimit = 30;
  let updatedCount = 0;

  for (let i = 0; i < records.length; i += concurrencyLimit) {
    const chunk = records.slice(i, i + concurrencyLimit);
    console.log(`  Processing batch records ${i} to ${Math.min(i + concurrencyLimit, records.length)}...`);

    const promises = chunk.map(async (record) => {
      try {
        let summary: any = {};
        try {
          summary = JSON.parse(record.raw_materials_text || "{}");
        } catch (e) {
          // If not valid JSON, initialize as empty
        }

        const recordId = record.id;

        // 1. Check if preview exists
        const { data: previews, error: previewErr } = await supabase.storage
          .from(BUCKET)
          .list("mstc-previews", { search: recordId });

        if (previewErr) {
          console.warn(`Error listing previews for ${record.mstc_auction_number}:`, previewErr.message);
        }

        let previewImageUrl: string | null = null;
        if (previews && previews.length > 0) {
          // Check if exact match is present in previews
          const exactPreview = previews.find(f => f.name === `${recordId}.jpg` || f.name.startsWith(recordId));
          if (exactPreview) {
            previewImageUrl = `${PUBLIC_PREFIX}/mstc-previews/${exactPreview.name}`;
          }
        }

        // 2. Check if extracted images exist
        const { data: extracted, error: extErr } = await supabase.storage
          .from(BUCKET)
          .list("mstc-extracted-images", { search: recordId });

        if (extErr) {
          console.warn(`Error listing extracted for ${record.mstc_auction_number}:`, extErr.message);
        }

        const extractedImageUrls: string[] = [];
        if (extracted && extracted.length > 0) {
          // Filter files belonging to this recordId
          const matchedFiles = extracted.filter(f => f.name.startsWith(recordId));
          for (const file of matchedFiles) {
            extractedImageUrls.push(`${PUBLIC_PREFIX}/mstc-extracted-images/${file.name}`);
          }
        }

        // Only update if we found anything to restore
        if (previewImageUrl || extractedImageUrls.length > 0) {
          summary.preview_image_url = previewImageUrl || summary.preview_image_url || null;
          summary.extracted_images = extractedImageUrls.length > 0 
            ? extractedImageUrls 
            : (summary.extracted_images || []);

          const { error: updateError } = await supabase
            .from("mstc_auctions")
            .update({
              raw_materials_text: JSON.stringify(summary),
              updated_at: new Date().toISOString()
            })
            .eq("id", recordId);

          if (updateError) {
            console.error(`Failed to update ${record.mstc_auction_number}:`, updateError.message);
            return false;
          } else {
            console.log(`[RESTORED IMAGES] ${record.mstc_auction_number} -> Preview: ${!!previewImageUrl}, Extracted count: ${extractedImageUrls.length}`);
            return true;
          }
        }
        return false;
      } catch (err: any) {
        console.error(`Error processing ${record.mstc_auction_number}:`, err.message);
        return false;
      }
    });

    const results = await Promise.all(promises);
    updatedCount += results.filter(Boolean).length;
  }

  return updatedCount;
}

async function run() {
  console.log("Starting image URL restoration script...");

  let totalProcessed = 0;
  let totalRestored = 0;
  let hasMore = true;
  let page = 0;
  const pageSize = 100;

  while (hasMore) {
    console.log(`Fetching page ${page} (offset: ${page * pageSize})...`);

    const { data: records, error } = await supabase
      .from("mstc_auctions")
      .select("id, mstc_auction_number, raw_materials_text")
      .eq("asset_status", "completed")
      .order("scraped_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error fetching records from DB:", error);
      break;
    }

    if (!records || records.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Fetched batch of ${records.length} records. Processing...`);
    const restoredInBatch = await processBatch(records);
    totalProcessed += records.length;
    totalRestored += restoredInBatch;

    console.log(`Batch finished. Restored in batch: ${restoredInBatch}. Total processed: ${totalProcessed}. Total restored: ${totalRestored}`);

    if (records.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`Finished restoration script. Total processed: ${totalProcessed}, Total restored: ${totalRestored}`);
}

run();
