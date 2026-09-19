/**
 * GeM Batch Document Archiver & Database Synchronizer
 *
 * Downloads official government PDF documents for GeM Bids and Forward Auctions
 * directly from portal endpoints using IPv4 connections, uploads them to
 * Supabase Storage, and updates database records with permanent CDN URLs.
 *
 * Usage:
 *   npx tsx scripts/syncGemDocuments.ts [--limit=25] [--type=all|bids|auctions]
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import https from "https";
import { URL } from "url";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "auction_documents";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 25;
  let type = "all";
  for (const a of args) {
    if (a.startsWith("--limit=")) limit = parseInt(a.replace("--limit=", ""), 10) || 25;
    if (a.startsWith("--type=")) type = a.replace("--type=", "");
  }
  return { limit, type };
}

function fetchPdfDirectHttp(targetUrl: string, referer: string, timeoutMs = 15000): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl);
      const isGem = parsed.hostname.includes("gem.gov.in");

      const req = https.get(
        parsed.toString(),
        {
          ...(isGem ? { family: 4 } : {}),
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
            Accept: "application/pdf,application/octet-stream,*/*",
            Referer: referer,
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirect = new URL(res.headers.location, parsed.toString()).toString();
            fetchPdfDirectHttp(redirect, referer, timeoutMs).then(resolve);
            return;
          }

          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const buffer = Buffer.concat(chunks);
            if (buffer.length > 500 && buffer.subarray(0, 4).toString("utf-8") === "%PDF") {
              resolve(buffer);
            } else {
              resolve(null);
            }
          });
        }
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve(null);
      });

      req.on("error", () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

async function uploadToStorage(storagePath: string, buffer: Buffer): Promise<string | null> {
  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) {
      console.warn(`Storage upload error for ${storagePath}:`, error.message);
      return null;
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err: any) {
    console.warn(`Storage upload exception:`, err?.message);
    return null;
  }
}

async function syncGemBids(limit: number) {
  console.log(`\n=== Archiving GeM Bids Documents (Target: ${limit}) ===`);
  const { data: bids, error } = await supabase
    .from("gem_bids")
    .select("id, bid_number, items, document_url, processing_status")
    .not("document_url", "ilike", "%supabase.co%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !bids || bids.length === 0) {
    console.log("No pending GeM bids requiring document upload.");
    return;
  }

  console.log(`Found ${bids.length} bids to archive.`);
  let success = 0;
  let failed = 0;

  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i];
    const bidNo = bid.bid_number;
    const sanitizedBidNo = bidNo.replace(/[^a-zA-Z0-9_-]/g, "_");
    const rawUrl = bid.document_url || `https://bidplus.gem.gov.in/showbidDocument/${encodeURIComponent(bidNo)}`;

    process.stdout.write(`[${i + 1}/${bids.length}] ${bidNo}... `);

    const pdfBuffer = await fetchPdfDirectHttp(rawUrl, "https://bidplus.gem.gov.in/all-bids");
    if (!pdfBuffer) {
      console.log("FAILED (download failed or not PDF)");
      failed++;
      continue;
    }

    const storagePath = `gem-bids/${sanitizedBidNo}/official_bid_document.pdf`;
    const cdnUrl = await uploadToStorage(storagePath, pdfBuffer);

    if (cdnUrl) {
      await supabase
        .from("gem_bids")
        .update({
          document_url: cdnUrl,
          document_urls: [cdnUrl],
          processing_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bid.id);

      console.log(`SUCCESS! (${(pdfBuffer.length / 1024).toFixed(1)} KB -> CDN)`);
      success++;
    } else {
      console.log("FAILED (storage upload failed)");
      failed++;
    }
  }

  console.log(`Bids finished: ${success} archived, ${failed} failed.`);
}

async function run() {
  const { limit, type } = parseArgs();
  console.log(`Starting GeM Document Synchronization (Limit: ${limit}, Type: ${type})...`);

  if (type === "all" || type === "bids") {
    await syncGemBids(limit);
  }

  console.log("\nDocument synchronization complete.");
}

run().catch(console.error);
