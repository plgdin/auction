import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { performOcr } from "../scraper/utils/ocrUtils.js";
import fetch from "node-fetch";
import Tesseract from "tesseract.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function run() {
  const url = "https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/mstc-extracted-images/c29388a5-1ff2-42f0-b22e-1e7a8f265042_lot_doc_0_page_1.jpg";
  console.log("Fetching image:", url);
  const res = await fetch(url);
  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  
  console.log("Running Tesseract OCR...");
  // @ts-ignore
  const worker = await Tesseract.createWorker("eng");
  const { data: { text } } = await worker.recognize(buffer);
  await worker.terminate();

  console.log("=== TESSERACT RAW TEXT ===");
  console.log(text);
  console.log("==========================");

  // Run the Gibberish logic explicitly to see scores
  let gibberishWords = 0;
  const words = text.split(/\s+/).filter((w: string) => w.length > 2);
  for (const word of words) {
    if (!/[aeiouyAEIOUY]/.test(word) || /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(word)) {
      gibberishWords++;
    }
  }

  const weirdChars = text.match(/[~`|^@#{}()[\]\\\/\>\<]/g);
  const nonLatinChars = text.match(/[^\x00-\x7F]/g);

  console.log("=== SCORES ===");
  console.log("Total length:", text.length);
  console.log("Weird chars:", weirdChars?.length || 0, " (Threshold:", text.length * 0.15, ")");
  console.log("Non-Latin chars:", nonLatinChars?.length || 0, " (Threshold:", text.length * 0.1, ")");
  console.log("Total words > 2 chars:", words.length);
  console.log("Gibberish words:", gibberishWords, " (Ratio:", (words.length > 0 ? gibberishWords / words.length : 0).toFixed(2), " Threshold: 0.4)");
}

run();
