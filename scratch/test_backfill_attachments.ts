import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as fs from 'fs';
import puppeteer from 'puppeteer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractEmbeddedJpegs(pdfBuffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = [];
  let pos = 0;
  const maxImages = 5;

  while (pos < pdfBuffer.length && jpegs.length < maxImages) {
    const streamIdx = pdfBuffer.indexOf('stream', pos);
    if (streamIdx === -1) break;

    const dictStart = pdfBuffer.lastIndexOf('<<', streamIdx);
    if (dictStart !== -1) {
      const dictBuffer = pdfBuffer.slice(dictStart, streamIdx);
      const dictStr = dictBuffer.toString('ascii');

      if (dictStr.includes('/Subtype /Image') && dictStr.includes('/Filter /DCTDecode')) {
        const endstreamIdx = pdfBuffer.indexOf('endstream', streamIdx);
        if (endstreamIdx !== -1) {
          let start = streamIdx + 6;
          while (start < endstreamIdx && (pdfBuffer[start] === 10 || pdfBuffer[start] === 13)) {
            start++;
          }
          let end = endstreamIdx;
          while (end > start && (pdfBuffer[end - 1] === 10 || pdfBuffer[end - 1] === 13)) {
            end--;
          }

          const streamData = pdfBuffer.slice(start, end);
          if (streamData.length > 5000) {
            jpegs.push(streamData);
          }
        }
      }
    }
    pos = streamIdx + 6;
  }

  return jpegs;
}

async function renderPdfFirstPage(fileBuffer: Buffer): Promise<Buffer | null> {
  let browser = null;
  try {
    const pdfBase64 = fileBuffer.toString('base64');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });
    
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        </script>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
      </body>
      </html>
    `);

    const dataUrl = await page.evaluate(async (base64Data) => {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes });
      const pdfDoc = await loadingTask.promise;
      const pdfPage = await pdfDoc.getPage(1);
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const canvasContext = canvas.getContext('2d');
      if (!canvasContext) throw new Error('Failed to get 2d context');
      await pdfPage.render({ canvasContext, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.85);
    }, pdfBase64);

    const base64Image = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    return Buffer.from(base64Image, 'base64');
  } catch (err: any) {
    console.error('[PDF Preview Render Error] Failed to render PDF page to image:', err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function downloadAttachment(fileName: string, docType: string, headers: Record<string, string>): Promise<Buffer | null> {
  const fileUrl = `https://www.mstcecommerce.com/auctionhome/mstc/admin/upload/downAttachedFiles.jsp?FILE_ID=${fileName}&doc_type=${docType}`;
  console.log(`Downloading attachment ${fileName} (doc_type: ${docType}) from: ${fileUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      console.warn(`Failed to download ${fileName} with type ${docType}: status ${response.status}`);
      return null;
    }

    const docBuffer = await response.buffer();
    if (docBuffer.toString('utf-8', 0, 4) === '%PDF') {
      return docBuffer;
    }
  } catch (e: any) {
    console.warn(`Network error downloading ${fileName} with type ${docType}:`, e.message);
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

async function extractAndProcessLotDocuments(
  catalogText: string, 
  sanitizedAuctionNum: string,
  headers: Record<string, string>
): Promise<string[]> {
  // Reconstruct filename if there are newlines or spaces
  const cleanedText = catalogText
    .replace(/\r?\n/g, ' ')
    .replace(/(Annex_|Photo_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi, (_match, p1, p2, p3, p4) => {
      return `${p1}${p2}${p3 || ''}${p4}`;
    });

  const matches = cleanedText.match(/([a-zA-Z0-9_]+\.pdf)/g) || [];
  const uniqueAttachments = Array.from(new Set(matches)).filter(name => {
    const n = name.toLowerCase();
    return n.startsWith('photo_') || n.startsWith('annex_');
  });

  if (uniqueAttachments.length === 0) {
    console.log('No attachments referenced matching Photo_ or Annex_.');
    return [];
  }

  console.log(`Reconstructed attachments found in text: ${uniqueAttachments.join(', ')}`);
  const imageUrls: string[] = [];

  for (let i = 0; i < uniqueAttachments.length; i++) {
    const fileName = uniqueAttachments[i];
    
    // Determine initial doc_type
    const primaryType = fileName.toLowerCase().startsWith('photo_') ? 'attached_photo' : 'attached_annex';
    const fallbackType = primaryType === 'attached_photo' ? 'attached_annex' : 'attached_photo';
    
    let docBuffer = await downloadAttachment(fileName, primaryType, headers);
    if (!docBuffer) {
      console.log(`Trying fallback doc_type: ${fallbackType}`);
      docBuffer = await downloadAttachment(fileName, fallbackType, headers);
    }

    if (!docBuffer) {
      console.warn(`Could not retrieve valid PDF for attachment ${fileName}`);
      continue;
    }

    console.log(`Successfully retrieved attachment ${fileName} (${docBuffer.length} bytes). Processing...`);

    // 1. Try to extract embedded JPEGs first
    const embeddedJpegs = extractEmbeddedJpegs(docBuffer);
    if (embeddedJpegs.length > 0) {
      console.log(`Extracted ${embeddedJpegs.length} embedded images. Uploading...`);
      for (let j = 0; j < embeddedJpegs.length; j++) {
        const imgBuffer = embeddedJpegs[j];
        const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_img_${j}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('auction_documents')
          .upload(imgPath, imgBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicMeta } = supabase.storage
            .from('auction_documents')
            .getPublicUrl(imgPath);
          imageUrls.push(publicMeta.publicUrl);
          console.log(`Uploaded extracted JPEG: ${publicMeta.publicUrl}`);
        } else {
          console.warn(`Upload error: ${uploadError.message}`);
        }
      }
    } else {
      // 2. Render first page to JPEG
      console.log(`No embedded JPEGs. Rendering PDF page to image...`);
      const renderBuffer = await renderPdfFirstPage(docBuffer);
      if (renderBuffer) {
        const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_page.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('auction_documents')
          .upload(imgPath, renderBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicMeta } = supabase.storage
            .from('auction_documents')
            .getPublicUrl(imgPath);
          imageUrls.push(publicMeta.publicUrl);
          console.log(`Uploaded rendered PDF page: ${publicMeta.publicUrl}`);
        } else {
          console.warn(`Upload error: ${uploadError.message}`);
        }
      }
    }
  }

  return imageUrls;
}

async function testBackfill() {
  console.log('Fetching specific BIHAR MILITARY POLICE (9) auction from database...');
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .ilike('mstc_auction_number', '%BIHAR MILITARY POLICE (9)%')
    .limit(1);

  if (error || !records || records.length === 0) {
    console.error('Target auction not found.', error?.message);
    return;
  }

  const record = records[0];
  console.log(`Found target: ${record.mstc_auction_number}`);

  // Load PDF buffer
  console.log(`Downloading catalog PDF from: ${record.sanitized_document_path}`);
  const res = await fetch(record.sanitized_document_path);
  const fileBuffer = await res.buffer();

  // Parse text
  const parsedPdf = await pdf(fileBuffer);
  const catalogText = parsedPdf.text;

  // Headers (optionally load from cookies.txt if present)
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  };
  try {
    if (fs.existsSync('cookies.txt')) {
      const cookieString = fs.readFileSync('cookies.txt', 'utf-8');
      if (cookieString.trim()) {
        headers['Cookie'] = cookieString.trim();
        console.log('Loaded cookies from cookies.txt');
      }
    }
  } catch (e) {}

  const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
  const imageUrls = await extractAndProcessLotDocuments(catalogText, sanitizedAuctionNum, headers);

  if (imageUrls.length > 0) {
    console.log(`Successfully extracted ${imageUrls.length} image URLs from attachments.`);
    // Update database record
    try {
      const parsedText = JSON.parse(record.raw_materials_text || '{}');
      parsedText.extracted_images = imageUrls;

      const { error: updateError } = await supabase
        .from('mstc_auctions')
        .update({ raw_materials_text: JSON.stringify(parsedText) })
        .eq('id', record.id);

      if (!updateError) {
        console.log('Database updated successfully with extracted images!');
      } else {
        console.error('Database update failed:', updateError.message);
      }
    } catch (dbErr: any) {
      console.error('Database mapping error:', dbErr.message);
    }
  } else {
    console.log('No images could be extracted from attachments.');
  }
}

testBackfill().catch(err => console.error(err));
