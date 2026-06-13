import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testRender() {
  // Query database for a completed auction PDF
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path')
    .eq('asset_status', 'completed')
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('Failed to get completed auction PDF:', error?.message);
    return;
  }

  const record = data[0];
  const pdfUrl = record.sanitized_document_path;
  console.log(`Rendering PDF from URL: ${pdfUrl}`);

  // Fetch the PDF binary data
  const res = await fetch(pdfUrl!);
  const pdfBuffer = await res.buffer();
  const pdfBase64 = pdfBuffer.toString('base64');
  console.log(`Fetched PDF: ${pdfBuffer.length} bytes`);

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set a viewport large enough for the rendered canvas
    await page.setViewport({ width: 1200, height: 1600 });

    // Load PDF.js inside a simple HTML page
    console.log('Loading PDF.js in page...');
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

    // Render the PDF page to a canvas and return the JPEG data URL
    console.log('Rendering first page to Canvas...');
    const dataUrl = await page.evaluate(async (base64Data) => {
      // Decode base64 to binary array
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Load PDF document using PDF.js
      const loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes });
      const pdfDoc = await loadingTask.promise;
      
      // Get page 1
      const pdfPage = await pdfDoc.getPage(1);
      
      // Render page to canvas
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const canvasContext = canvas.getContext('2d');
      if (!canvasContext) throw new Error('Failed to get 2d context');

      await pdfPage.render({
        canvasContext,
        viewport
      }).promise;

      return canvas.toDataURL('image/jpeg', 0.85);
    }, pdfBase64);

    // Save image locally to scratch directory
    const base64Image = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    const imgBuffer = Buffer.from(base64Image, 'base64');
    const filename = 'scratch/pdf_page_preview.jpg';
    fs.writeFileSync(filename, imgBuffer);
    console.log(`Preview image successfully saved to ${filename} (${imgBuffer.length} bytes)!`);

  } catch (err: any) {
    console.error('Error during rendering:', err);
  } finally {
    await browser.close();
  }
}

testRender();
