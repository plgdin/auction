import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const AUCTION_ID = "70e18e34-ccc2-497f-af2b-645e53091afa";

async function main() {
  const { data, error } = await supabase.storage
    .from("auction_documents")
    .download(`mstc-catalogs/${AUCTION_ID}.pdf`);

  if (error || !data) {
    console.error("Download failed:", error);
    return;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const parsed = await pdf(buffer);
  
  const lines = parsed.text.split("\n").map(l => l.trim());
  
  // Find lines containing sub-items
  console.log("Searching for items...");
  lines.forEach((line, index) => {
    if (line.includes("Iron") || line.includes("Plastic") || line.includes("Stainless Steel") || line.includes("Deep Freezer") || line.includes("Rubber")) {
      console.log(`[Line ${index}] ${line}`);
      // Print 2 lines before and after
      for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 2); i++) {
        console.log(`  ${i}: ${lines[i]}`);
      }
      console.log("-------------------");
    }
  });
}

main();
