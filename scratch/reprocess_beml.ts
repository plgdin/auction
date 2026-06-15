import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

import { parseMstcCatalogText } from '../scraper/parsers/mstcParser.js';
import { renderPdfFirstPage, extractEmbeddedJpegs } from '../scraper/utils/pdfUtils.js';
import { uploadToStorage } from '../scraper/utils/storage.js';
import { logger } from '../scraper/utils/logger.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MSTC_CATALOG_PDF_ENDPOINT = "https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report_pdf.jsp";
const MSTC_ATTACHMENT_ENDPOINT = "https://www.mstcecommerce.com/auctionhome/mstc/download_doc.jsp";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function loadSessionCookies(): string | null {
  try {
    if (fs.existsSync("cookies.txt")) {
      const cookieString = fs.readFileSync("cookies.txt", "utf-8");
      if (cookieString.trim()) {
        return cookieString.trim();
      }
    }
  } catch (cookieErr: any) {
    console.warn("Failed to read cookies.txt:", cookieErr.message);
  }
  return null;
}

function buildMstcHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const cookies = loadSessionCookies();
  if (cookies) {
    headers["Cookie"] = cookies;
  }

  return headers;
}

async function downloadAttachment(
  fileName: string,
  docType: string,
  headers: Record<string, string>,
): Promise<Buffer | null> {
  const fileUrl = `${MSTC_ATTACHMENT_ENDPOINT}?FILE_ID=${fileName}&doc_type=${docType}`;
  console.log(`Downloading attachment ${fileName} (${docType})...`);

  try {
    const response = await fetch(fileUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      console.warn(`Attachment download failed with status ${response.status}`);
      return null;
    }

    const docBuffer = await response.buffer();
    if (docBuffer.toString("utf-8", 0, 4) === "%PDF") {
      return docBuffer;
    }
  } catch (e: any) {
    console.warn("Error downloading attachment:", e.message);
  }
  return null;
}

async function extractAndProcessLotDocuments(
  catalogText: string,
  sanitizedAuctionNum: string,
  headers: Record<string, string>,
): Promise<{ imageUrls: string[]; attachmentMap: Record<string, string[]> }> {
  const cleanedText = catalogText
    .replace(/\r?\n/g, " ")
    .replace(
      /(Annex_|Photo_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi,
      (_match, p1, p2, p3, p4) => {
        return `${p1}${p2}${p3 || ""}${p4}`;
      },
    );

  const matches = cleanedText.match(/([a-zA-Z0-9_]+\.pdf)/g) || [];
  const uniqueAttachments = Array.from(new Set(matches)).filter((name) => {
    const n = name.toLowerCase();
    return n.startsWith("photo_") || n.startsWith("annex_");
  });

  if (uniqueAttachments.length === 0) {
    return { imageUrls: [], attachmentMap: {} };
  }

  console.log(`Found ${uniqueAttachments.length} attachments to process.`);

  const imageUrls: string[] = [];
  const attachmentMap: Record<string, string[]> = {};

  for (let i = 0; i < uniqueAttachments.length; i++) {
    const fileName = uniqueAttachments[i];
    const lotImageUrls: string[] = [];

    const primaryType = fileName.toLowerCase().startsWith("photo_")
      ? "attached_photo"
      : "attached_annex";
    const fallbackType =
      primaryType === "attached_photo" ? "attached_annex" : "attached_photo";

    let docBuffer = await downloadAttachment(fileName, primaryType, headers);
    if (!docBuffer) {
      console.log(`Trying fallback doc_type for ${fileName}`);
      docBuffer = await downloadAttachment(fileName, fallbackType, headers);
    }

    if (!docBuffer) {
      console.warn(`Could not retrieve valid PDF for attachment ${fileName}`);
      continue;
    }

    console.log(`Processing attachment ${fileName} (${docBuffer.length} bytes)...`);

    const embeddedJpegs = extractEmbeddedJpegs(docBuffer);
    if (embeddedJpegs.length > 0) {
      console.log(`Extracted ${embeddedJpegs.length} embedded images from ${fileName}`);
      for (let j = 0; j < embeddedJpegs.length; j++) {
        try {
          const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_img_${j}.jpg`;
          const publicUrl = await uploadToStorage(
            imgPath,
            embeddedJpegs[j],
            "image/jpeg",
          );
          imageUrls.push(publicUrl);
          lotImageUrls.push(publicUrl);
        } catch (uploadErr: any) {
          console.error(`Failed to upload extracted image:`, uploadErr.message);
        }
      }
    } else {
      console.log(`No embedded JPEGs. Rendering page to image...`);
      const renderBuffer = await renderPdfFirstPage(docBuffer);
      if (renderBuffer) {
        try {
          const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_page.jpg`;
          const publicUrl = await uploadToStorage(
            imgPath,
            renderBuffer,
            "image/jpeg",
          );
          imageUrls.push(publicUrl);
          lotImageUrls.push(publicUrl);
        } catch (uploadErr: any) {
          console.error(`Failed to upload rendered image:`, uploadErr.message);
        }
      }
    }

    attachmentMap[fileName] = lotImageUrls;
  }

  return { imageUrls, attachmentMap };
}

async function run() {
  const auctionNum = "MSTC/WRO/BEML LIMITED/1/PUNE/26-27/13045";
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .eq('mstc_auction_number', auctionNum)
    .limit(1);

  if (error || !records || records.length === 0) {
    console.error("Record not found", error);
    return;
  }

  const record = records[0];
  const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, "_");
  const headers = buildMstcHeaders();

  console.log(`Downloading main catalog PDF from ${record.sanitized_document_path || record.source_pdf_url}...`);
  
  // Download catalog PDF
  const res = await fetch(record.sanitized_document_path || record.source_pdf_url);
  const buffer = await res.buffer();
  const parsedPdf = await pdf(buffer);
  const text = parsedPdf.text;

  // Process attachments
  const result = await extractAndProcessLotDocuments(text, sanitizedAuctionNum, headers);

  // Parse catalog
  const summaryObj = parseMstcCatalogText(
    text,
    record.category_name || "",
    record.seller_name || "",
    record.location || "",
  );

  // Map lot-specific images
  if (summaryObj.items && Array.isArray(summaryObj.items)) {
    for (const item of summaryObj.items) {
      if (item.attachments && Array.isArray(item.attachments)) {
        const itemImages: string[] = [];
        for (const attName of item.attachments) {
          const urls = result.attachmentMap[attName];
          if (urls && urls.length > 0) {
            itemImages.push(...urls);
          }
        }
        if (itemImages.length > 0) {
          item.images = itemImages;
        }
      }
    }
  }

  // Set general preview and extracted list
  summaryObj.preview_image_url = record.preview_image_path || null;
  
  // Combine existing extracted images and new ones
  const existingImages = (JSON.parse(record.raw_materials_text || '{}').extracted_images) || [];
  const combinedImages = Array.from(new Set([...existingImages, ...result.imageUrls]));
  summaryObj.extracted_images = combinedImages;

  console.log("Updated Summary Structure:");
  console.log(JSON.stringify(summaryObj, null, 2));

  // Update DB
  console.log("Updating database row...");
  const { error: updateError } = await supabase
    .from('mstc_auctions')
    .update({
      raw_materials_text: JSON.stringify(summaryObj)
    })
    .eq('id', record.id);

  if (updateError) {
    console.error("DB update failed:", updateError.message);
  } else {
    console.log("Record successfully updated!");
  }
}

run().catch(console.error);
