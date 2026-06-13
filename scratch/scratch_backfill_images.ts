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

// Helper functions copied from worker for self-containment
function extractEmbeddedJpegs(pdfBuffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = [];
  let pos = 0;
  const maxImages = 8;

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
    console.error('[PDF Preview Render Error]', err.message);
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
    return [];
  }

  console.log(`Reconstructed attachments found: ${uniqueAttachments.join(', ')}`);
  const imageUrls: string[] = [];

  for (let i = 0; i < uniqueAttachments.length; i++) {
    const fileName = uniqueAttachments[i];
    const primaryType = fileName.toLowerCase().startsWith('photo_') ? 'attached_photo' : 'attached_annex';
    const fallbackType = primaryType === 'attached_photo' ? 'attached_annex' : 'attached_photo';
    
    let docBuffer = await downloadAttachment(fileName, primaryType, headers);
    if (!docBuffer) {
      docBuffer = await downloadAttachment(fileName, fallbackType, headers);
    }

    if (!docBuffer) continue;

    const embeddedJpegs = extractEmbeddedJpegs(docBuffer);
    if (embeddedJpegs.length > 0) {
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
          const { data: publicMeta } = supabase.storage.from('auction_documents').getPublicUrl(imgPath);
          imageUrls.push(publicMeta.publicUrl);
        }
      }
    } else {
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
          const { data: publicMeta } = supabase.storage.from('auction_documents').getPublicUrl(imgPath);
          imageUrls.push(publicMeta.publicUrl);
        }
      }
    }
  }

  return imageUrls;
}

// Logic to parse catalog details block
function parseMstcCatalogText(text: string, category: string, seller: string, location: string): any {
  // Simple extraction of sections
  const items: any[] = [];
  const itemRegex = /(\d+)\s+([\s\S]+?)\s+(\d+(?:\.\d+)?)\s+(\S+)\s+([\d\.\s%]+(?:GST|TCS|As Applicable)[\s\S]*?)(?=\n\d+\s+|\n\s*SCHEDULE|\n\s*Special Terms|$)/g;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    items.push({
      sr: parseInt(match[1], 10),
      description: match[2].trim().replace(/\r?\n/g, ' '),
      qty: match[3].trim(),
      unit: match[4].trim(),
      taxRate: match[5].trim().replace(/\r?\n/g, ' ')
    });
  }

  if (items.length === 0) {
    items.push({
      sr: 1,
      description: category.split(' | ')[1] || category || 'Surplus Scrap Materials',
      qty: '1.0',
      unit: 'LOT',
      taxRate: 'As Applicable GST'
    });
  }

  const emdMatch = text.match(/(?:Pre-Bid\s+EMD|EMD|Earnest\s+Money\s+Deposit)[\s\S]*?(?:Rs\.|₹)?\s*([\d,]+)/i);
  const emdVal = emdMatch ? `₹${emdMatch[1]}` : '25.0% of total bid value (Post-Bid EMD)';

  const contactList: any[] = [];
  const contactMatches = text.matchAll(/([a-zA-Z\s]+)\s+([\w\.-]+@[\w\.-]+\.\w+)\s+(\d{10})/g);
  for (const m of contactMatches) {
    contactList.push({
      role: 'Officer / Liaison',
      name: m[1].trim(),
      email: m[2].trim(),
      phone: m[3].trim()
    });
  }

  if (contactList.length === 0) {
    contactList.push({
      role: 'Auction Officer One (MSTC)',
      name: 'MSTC Helpdesk',
      email: 'helpdesk@mstcindia.co.in',
      phone: '03322901004'
    });
  }

  return {
    overview: `Disposal of materials from ${seller} located at ${location}.`,
    scopeOfWork: `Lifting, clearing, and disposal of scrap items on "As-Is-Where-Is" basis.`,
    items,
    eligibility: [
      "Valid MSTC Buyer Registration in active status.",
      "GSTIN Registration Certificate matching the buyer profile.",
      "Pollution Control Board authorizations where applicable."
    ],
    depositDetails: {
      emd: emdVal,
      preBidDdg: "Not required for registered MSME bidders",
      adminCharges: "₹11,800 (incl. GST) non-refundable service provider fees"
    },
    keyContacts: contactList
  };
}

async function runBackfill() {
  console.log('Querying all MSTC auctions for backfilling in batches...');
  const records: any[] = [];
  let from = 0;
  let to = 999;
  while (true) {
    console.log(`Fetching records from range ${from} to ${to}...`);
    const { data, error } = await supabase
      .from('mstc_auctions')
      .select('*')
      .range(from, to);

    if (error) {
      console.error('Error fetching records:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    records.push(...data);
    if (data.length < 1000) break;
    from += 1000;
    to += 1000;
  }

  // Prioritize specific IDs (like 58132, 10465, 13309) by putting them first
  if (records && records.length > 0) {
    records.sort((a, b) => {
      const priorityIds = ['58132', '10465', '13309'];
      const aPriority = priorityIds.some(id => a.mstc_auction_number.includes(id));
      const bPriority = priorityIds.some(id => b.mstc_auction_number.includes(id));
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return 0;
    });
  }

  console.log(`Found ${records?.length || 0} total records in database.`);
  
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

  const CONCURRENCY_LIMIT = 5;
  const list = records || [];
  let index = 0;

  async function processRecord(record: any) {
    let parsedText: any = {};
    try {
      parsedText = JSON.parse(record.raw_materials_text || '{}');
    } catch (e) {}

    // Check if we need to process this record (if preview or extracted images are missing)
    const needsProcessing = !parsedText.preview_image_url || record.asset_status === 'pending';

    if (!needsProcessing) {
      console.log(`Skipping already processed auction: ${record.mstc_auction_number}`);
      return;
    }

    console.log(`Processing: ${record.mstc_auction_number}`);
    try {
      let fileBuffer: Buffer | null = null;
      
      // If we already have the sanitized_document_path, we can just download it from there!
      if (record.sanitized_document_path) {
        console.log(`Downloading existing PDF from storage: ${record.sanitized_document_path}`);
        const res = await fetch(record.sanitized_document_path);
        fileBuffer = await res.buffer();
      } else {
        // Otherwise download from MSTC
        console.log(`Downloading PDF from MSTC: ${record.source_pdf_url}`);
        const url = new URL(record.source_pdf_url);
        const aucId = url.searchParams.get('auc') || '';
        const formData = new URLSearchParams();
        formData.append('auc', aucId);
        formData.append('cat', '0');
        formData.append('sell', '0');
        
        const response = await fetch('https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report_pdf.jsp', {
          method: 'POST',
          body: formData,
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        if (response.ok) {
          const buf = await response.buffer();
          if (buf.toString('utf-8', 0, 4) === '%PDF') {
            fileBuffer = buf;
            // Also upload it to storage
            const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
            const cloudStorageLocation = `mstc-catalogs/${sanitizedAuctionNum}.pdf`;
            await supabase.storage.from('auction_documents').upload(cloudStorageLocation, buf, {
              contentType: 'application/pdf',
              upsert: true
            });
            const { data } = supabase.storage.from('auction_documents').getPublicUrl(cloudStorageLocation);
            record.sanitized_document_path = data.publicUrl;
          }
        }
      }

      if (!fileBuffer) {
        console.warn(`Could not get valid PDF buffer for ${record.mstc_auction_number}`);
        return;
      }

      const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');

      // 1. Render First Page Preview
      console.log(`Rendering PDF page for ${record.mstc_auction_number}...`);
      let previewImageUrl: string | null = null;
      const previewBuffer = await renderPdfFirstPage(fileBuffer);
      if (previewBuffer) {
        const previewStoragePath = `mstc-previews/${sanitizedAuctionNum}.jpg`;
        const { error: previewUploadError } = await supabase.storage
          .from('auction_documents')
          .upload(previewStoragePath, previewBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (!previewUploadError) {
          const { data: previewPublicMeta } = supabase.storage
            .from('auction_documents')
            .getPublicUrl(previewStoragePath);
          previewImageUrl = previewPublicMeta.publicUrl;
          console.log(`Generated preview: ${previewImageUrl}`);
        }
      }

      // 2. Extract Embedded JPEGs from Catalog PDF itself
      const embeddedImages = extractEmbeddedJpegs(fileBuffer);
      const extractedImageUrls: string[] = [];
      if (embeddedImages.length > 0) {
        console.log(`Found ${embeddedImages.length} embedded images inside the catalog itself.`);
        for (let i = 0; i < embeddedImages.length; i++) {
          const imgBuffer = embeddedImages[i];
          const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_img_${i}.jpg`;
          const { error: imgUploadError } = await supabase.storage
            .from('auction_documents')
            .upload(imgPath, imgBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });
          
          if (!imgUploadError) {
            const { data: imgPublicMeta } = supabase.storage.from('auction_documents').getPublicUrl(imgPath);
            extractedImageUrls.push(imgPublicMeta.publicUrl);
          }
        }
      }

      // 3. Parse PDF text for lot attachments
      const parsedPdf = await pdf(fileBuffer);
      if (parsedPdf && parsedPdf.text) {
        const attachmentImageUrls = await extractAndProcessLotDocuments(parsedPdf.text, sanitizedAuctionNum, headers);
        if (attachmentImageUrls.length > 0) {
          extractedImageUrls.push(...attachmentImageUrls);
        }

        const summaryObj = parseMstcCatalogText(parsedPdf.text, record.category_name, record.seller_name, record.location);
        summaryObj.preview_image_url = previewImageUrl;
        summaryObj.extracted_images = extractedImageUrls;

        const { error: updateError } = await supabase
          .from('mstc_auctions')
          .update({
            raw_materials_text: JSON.stringify(summaryObj),
            sanitized_document_path: record.sanitized_document_path,
            asset_status: 'completed'
          })
          .eq('id', record.id);

        if (updateError) {
          console.error(`Failed to update DB for ${record.mstc_auction_number}:`, updateError.message);
        } else {
          console.log(`Successfully updated database for ${record.mstc_auction_number}`);
        }
      }

    } catch (e: any) {
      console.error(`Error processing record ${record.mstc_auction_number}:`, e.message);
    }
  }

  async function worker() {
    while (index < list.length) {
      const currentIndex = index++;
      const record = list[currentIndex];
      if (!record) break;
      await processRecord(record);
    }
  }

  const workers = Array.from({ length: CONCURRENCY_LIMIT }, () => worker());
  await Promise.all(workers);
  console.log('--- Backfill Completed ---');
}

runBackfill().catch(console.error);
