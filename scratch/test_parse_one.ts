import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config({ path: path.resolve(".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: record, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, sanitized_document_path")
    .like("mstc_auction_number", "%58132")
    .single();

  if (error || !record) {
    console.error("Error fetching record:", error);
    return;
  }

  try {
    const url = new URL(record.sanitized_document_path);
    const parts = url.pathname.split("/storage/v1/object/public/");
    const bucketAndPath = parts[1];
    const firstSlash = bucketAndPath.indexOf("/");
    const bucket = bucketAndPath.substring(0, firstSlash);
    const filePath = bucketAndPath.substring(firstSlash + 1);

    console.log(`Downloading PDF from bucket: ${bucket}, path: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      console.error("Download error:", downloadError.message);
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const parsedPdf = await pdf(buffer);
    console.log("PDF parsed successfully. Characters:", parsedPdf.text.length);
    
    const lines = parsedPdf.text.split("\n").map((l: string) => l.trim());
    console.log("--- First 50 lines ---");
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
    
    console.log("--- Checking regex matching ---");
    const cleanText = lines.join("\n");
    
    const startRegex = /(?:Scheduled\s+Auction\s+Start\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Start\s+Date\s*(?:and|&)\s*Time|Auction\s+Start\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Auction\s+Start\s+Date|Auction\s+Start\s+Date)\s*[:|.-]?\s*(\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)/i;
    const startMatch = cleanText.match(startRegex);
    console.log("startMatch:", startMatch ? startMatch[0] : "NULL", "Captured:", startMatch ? startMatch[1] : "NULL");

    const closeRegex = /(?:Scheduled\s+Auction\s+Close\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Close\s+Date\s*(?:and|&)\s*Time|Auction\s+Close\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Auction\s+Close\s+Date|Auction\s+Close\s+Date)\s*[:|.-]?\s*(\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)/i;
    const closeMatch = cleanText.match(closeRegex);
    console.log("closeMatch:", closeMatch ? closeMatch[0] : "NULL", "Captured:", closeMatch ? closeMatch[1] : "NULL");

  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

run();
