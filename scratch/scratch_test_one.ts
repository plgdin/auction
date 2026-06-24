import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET = "auction_documents";
const PUBLIC_PREFIX = `${supabaseUrl}/storage/v1/object/public/${BUCKET}`;

async function run() {
  const recordId = "4f8a5f1a-f687-49d9-b23f-9b147181f2c0";
  console.log(`Starting test for record ID: ${recordId}...`);

  const { data: record, error: fetchErr } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, raw_materials_text")
    .eq("id", recordId)
    .single();

  if (fetchErr || !record) {
    console.error("Fetch error:", fetchErr);
    return;
  }

  console.log("Fetched record:", record.mstc_auction_number);

  let summary: any = {};
  try {
    summary = JSON.parse(record.raw_materials_text || "{}");
  } catch (e) {
    console.warn("Parse warning:", e);
  }

  console.log("Existing preview_image_url:", summary.preview_image_url);
  console.log("Existing extracted_images:", summary.extracted_images);

  // 1. Check if preview exists
  const { data: previews, error: previewErr } = await supabase.storage
    .from(BUCKET)
    .list("mstc-previews", { search: recordId });

  console.log("Previews list:", previews);

  let previewImageUrl: string | null = null;
  if (previews && previews.length > 0) {
    const exactPreview = previews.find(f => f.name === `${recordId}.jpg` || f.name.startsWith(recordId));
    console.log("Exact preview matched:", exactPreview);
    if (exactPreview) {
      previewImageUrl = `${PUBLIC_PREFIX}/mstc-previews/${exactPreview.name}`;
    }
  }

  // 2. Check if extracted images exist
  const { data: extracted, error: extErr } = await supabase.storage
    .from(BUCKET)
    .list("mstc-extracted-images", { search: recordId });

  console.log("Extracted list:", extracted);

  const extractedImageUrls: string[] = [];
  if (extracted && extracted.length > 0) {
    const matchedFiles = extracted.filter(f => f.name.startsWith(recordId));
    console.log("Extracted matched:", matchedFiles);
    for (const file of matchedFiles) {
      extractedImageUrls.push(`${PUBLIC_PREFIX}/mstc-extracted-images/${file.name}`);
    }
  }

  console.log("Determined previewImageUrl:", previewImageUrl);
  console.log("Determined extractedImageUrls:", extractedImageUrls);

  if (previewImageUrl || extractedImageUrls.length > 0) {
    summary.preview_image_url = previewImageUrl || summary.preview_image_url || null;
    summary.extracted_images = extractedImageUrls.length > 0 
      ? extractedImageUrls 
      : (summary.extracted_images || []);

    const { data: updateData, error: updateError } = await supabase
      .from("mstc_auctions")
      .update({
        raw_materials_text: JSON.stringify(summary),
        updated_at: new Date().toISOString()
      })
      .eq("id", recordId)
      .select();

    if (updateError) {
      console.error("Update error:", updateError);
    } else {
      console.log("Update success! Updated record in DB:", updateData);
    }
  } else {
    console.log("No images found to update.");
  }
}

run();
