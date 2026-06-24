import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config({ path: path.resolve(".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function parsePdfDateTimeToISO(dateTimeStr: string | undefined): string | null {
  if (!dateTimeStr) return null;
  const match = dateTimeStr.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) {
      year += 2000;
    }
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`;
  }
  return null;
}

async function run() {
  console.log("Fetching Ref: 58132...");
  const { data: record, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, sanitized_document_path, raw_materials_text")
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

    console.log("Downloading PDF...");
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      console.error("Download error:", downloadError.message);
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const parsedPdf = await pdf(buffer);
    const cleanText = parsedPdf.text.split("\n").map((l: string) => l.trim()).join("\n");

    const startMatch = cleanText.match(/(?:Scheduled\s+Auction\s+Start\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Start\s+Date\s*(?:and|&)\s*Time|Auction\s+Start\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Auction\s+Start\s+Date|Auction\s+Start\s+Date)\s*[:|.-]?\s*(\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)/i);
    const auctionStartTime = startMatch ? startMatch[1].trim() : undefined;

    const closeMatch = cleanText.match(/(?:Scheduled\s+Auction\s+Close\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Close\s+Date\s*(?:and|&)\s*Time|Auction\s+Close\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Auction\s+Close\s+Date|Auction\s+Close\s+Date)\s*[:|.-]?\s*(\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)/i);
    const auctionCloseTime = closeMatch ? closeMatch[1].trim() : undefined;

    console.log(`Extracted times -> Start: ${auctionStartTime}, Close: ${auctionCloseTime}`);

    let parsedSummary: any = {};
    try {
      parsedSummary = JSON.parse(record.raw_materials_text);
    } catch (e) {}

    parsedSummary.auctionStartTime = auctionStartTime || parsedSummary.auctionStartTime;
    parsedSummary.auctionCloseTime = auctionCloseTime || parsedSummary.auctionCloseTime;

    const updatePayload: any = {
      raw_materials_text: JSON.stringify(parsedSummary),
      updated_at: new Date().toISOString(),
    };

    if (auctionStartTime) {
      const isoStart = parsePdfDateTimeToISO(auctionStartTime);
      if (isoStart) {
        updatePayload.opening_date = isoStart;
      }
    }

    if (auctionCloseTime) {
      const isoClose = parsePdfDateTimeToISO(auctionCloseTime);
      if (isoClose) {
        updatePayload.closing_date = isoClose;
      }
    }

    const { error: updateError } = await supabase
      .from("mstc_auctions")
      .update(updatePayload)
      .eq("id", record.id);

    if (updateError) {
      console.error("Failed to update record in DB:", updateError.message);
    } else {
      console.log("Successfully updated record Ref: 58132 in database!");
    }
  } catch (err: any) {
    console.error("Error processing record:", err.message);
  }
}

run();
