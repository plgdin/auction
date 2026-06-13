import fetch from 'node-fetch';
import * as fs from 'fs';

function extractEmbeddedJpegs(pdfBuffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = [];
  let pos = 0;
  const maxImages = 15;

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

async function inspectPdf() {
  const url = 'https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/mstc-catalogs/MSTC_HYD_Energy%20Efficiency%20Services%20Limited%20_7_Vijayawada_26-27_13309.pdf';
  console.log(`Downloading PDF from: ${url}`);
  const res = await fetch(url);
  const pdfBuffer = await res.buffer();
  console.log(`Downloaded ${pdfBuffer.length} bytes.`);

  const jpegs = extractEmbeddedJpegs(pdfBuffer);
  console.log(`Found ${jpegs.length} embedded JPEGs directly in the PDF.`);
  
  for (let i = 0; i < jpegs.length; i++) {
    const filename = `scratch/extracted_13309_img_${i}.jpg`;
    fs.writeFileSync(filename, jpegs[i]);
    console.log(`Saved embedded image to ${filename} (${jpegs[i].length} bytes).`);
  }
}

inspectPdf().catch(console.error);
