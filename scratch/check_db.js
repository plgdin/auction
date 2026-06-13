import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

async function run() {
  const url = "https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/mstc-catalogs/MSTC_LKO_Uttar%20Pradesh_Chandauli_32_26-27_13920.pdf";
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to download PDF:", res.status);
    return;
  }
  const fileBuffer = Buffer.from(await res.arrayBuffer());
  const parsedPdf = await pdf(fileBuffer);
  console.log("PDF TEXT:\n", parsedPdf.text);
}
run();
