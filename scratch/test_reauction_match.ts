import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runTest() {
  const parentNumber = "MSTC/TEST/PARENT/2026";
  const childNumber = "MSTC/TEST/CHILD/2026";

  console.log("1. Cleaning up any legacy test data...");
  await supabase.from("mstc_auctions").delete().eq("mstc_auction_number", parentNumber);
  await supabase.from("mstc_auctions").delete().eq("mstc_auction_number", childNumber);

  console.log("2. Inserting mock parent (original) auction...");
  const parentOpening = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
  const parentClosing = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: parentInsert, error: parentError } = await supabase
    .from("mstc_auctions")
    .insert([
      {
        mstc_auction_number: parentNumber,
        seller_name: "Test Reauction Seller Ltd",
        category_name: "Metal | Iron and steel",
        location: "Kerala",
        opening_date: parentOpening,
        closing_date: parentClosing,
        source_pdf_url: "https://example.com/parent.pdf",
        raw_materials_text: "Mock parent auction details for test",
        asset_status: "pending",
        retry_count: 0
      }
    ])
    .select("id, mstc_auction_number")
    .single();

  if (parentError) {
    console.error("Failed to insert mock parent auction. Check if migration 00008 was run. Error:", parentError.message);
    process.exit(1);
  }

  console.log(`Parent auction inserted with ID: ${parentInsert.id}`);

  console.log("3. Creating mock child (re-auction) auction...");
  const childOpening = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // in 12 hours
  const childClosing = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();

  const childRow = {
    mstc_auction_number: childNumber,
    seller_name: "Test Reauction Seller Ltd",
    category_name: "Metal | Iron and steel",
    location: "Kerala",
    opening_date: childOpening,
    closing_date: childClosing,
    source_pdf_url: "https://example.com/child.pdf",
    raw_materials_text: "Mock child re-auction details for test",
    asset_status: "pending",
    retry_count: 0,
    is_reauction: false,
    original_auction_number: null as string | null,
    parent_auction_id: null as string | null
  };

  console.log("4. Running re-auction detection query (simulating scraper logic)...");
  const { data: dbMatches, error: dbError } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, opening_date")
    .eq("seller_name", childRow.seller_name)
    .eq("location", childRow.location)
    .eq("category_name", childRow.category_name)
    .neq("mstc_auction_number", childRow.mstc_auction_number)
    .lt("opening_date", childRow.opening_date)
    .order("opening_date", { ascending: false });

  if (dbError) {
    console.error("Error executing detection query:", dbError.message);
    await cleanup(parentInsert.id, null);
    process.exit(1);
  }

  console.log(`Detection query found ${dbMatches?.length || 0} older matches.`);
  const parentMatch = dbMatches && dbMatches.length > 0 ? dbMatches[0] : null;

  if (parentMatch) {
    childRow.is_reauction = true;
    childRow.original_auction_number = parentMatch.mstc_auction_number;
    childRow.parent_auction_id = parentMatch.id;
  }

  console.log("5. Upserting child auction to database...");
  const { data: childInsert, error: childError } = await supabase
    .from("mstc_auctions")
    .upsert([childRow], { onConflict: "mstc_auction_number" })
    .select("id, is_reauction, original_auction_number, parent_auction_id")
    .single();

  if (childError) {
    console.error("Failed to upsert child auction:", childError.message);
    await cleanup(parentInsert.id, null);
    process.exit(1);
  }

  console.log("Child auction upserted. Results:");
  console.log(` - is_reauction: ${childInsert.is_reauction}`);
  console.log(` - original_auction_number: ${childInsert.original_auction_number}`);
  console.log(` - parent_auction_id: ${childInsert.parent_auction_id}`);

  // Assertions
  if (
    childInsert.is_reauction === true &&
    childInsert.original_auction_number === parentNumber &&
    childInsert.parent_auction_id === parentInsert.id
  ) {
    console.log("\n✅ SUCCESS: Re-auction detection logic works perfectly and matching records are linked!");
  } else {
    console.error("\n❌ FAILURE: Mapped results do not match expected parent auction links.");
  }

  await cleanup(parentInsert.id, childInsert.id);
}

async function cleanup(parentId: string, childId: string | null) {
  console.log("\n6. Cleaning up mock test records from database...");
  if (parentId) {
    await supabase.from("mstc_auctions").delete().eq("id", parentId);
  }
  if (childId) {
    await supabase.from("mstc_auctions").delete().eq("id", childId);
  }
  console.log("Cleanup completed successfully.");
}

runTest();
