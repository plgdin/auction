import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";
import fetch from "node-fetch";
import { renderAndExtractPdfPages } from "../scraper/utils/pdfUtils.js";
import { performOcr } from "../scraper/utils/ocrUtils.js";
import { parseSubItemsFromText } from "../scraper/parsers/mstcParser.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const fileUrl = "https://www.mstcecommerce.com/auctionhome/mstc/admin/upload/downAttachedFiles.jsp?FILE_ID=Photo_7_15065_8337959.pdf&doc_type=attached_photo";

async function main() {
  console.log("Downloading attachment...");
  const response = await fetch(fileUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }
  });

  if (!response.ok) {
    console.error("Download failed:", response.status);
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  console.log("PDF size:", buffer.length);

  const pages = await renderAndExtractPdfPages(buffer, 20);
  console.log("Rendered pages:", pages.length);

  for (const page of pages) {
    console.log(`\n--- Page ${page.pageNumber} Selectable Text ---`);
    console.log(page.text);

    console.log(`\n--- Page ${page.pageNumber} OCR Text ---`);
    const ocrText = await performOcr(page.imageBuffer);
    console.log(ocrText);

    const combined = `${page.text || ""}\n${ocrText}`;
    const parsed = parseSubItemsFromText(combined);
    console.log(`\n--- Page ${page.pageNumber} Parsed Sub-items ---`);
    console.log(JSON.stringify(parsed, null, 2));
  }
}

main();
