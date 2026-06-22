import { parseMstcCatalogText } from "../scraper/parsers/mstcParser.js";
import { mapCategory } from "../scraper/utils/categoryMapper.js";

const sampleCatalogText = `
MSTC Auction Catalog No. MSTC/VZG/1234
Seller: Southern Railways, Division Office, Vijayawada
Location: Vijayawada Goods Shed
Date: 2026-06-22

Key Contacts:
For Inspection and details:
Contact Person: Mr. K. Ramakrishna, Sr. Section Engineer (P-Way), Mobile: 9497612987, Email: ssewayvzg@rail.gov.in
MSTC Officer: Mrs. S. Lakshmi, Deputy Manager, Phone: 0891-2701043

Deposit / EMD Details:
Pre-Bid EMD: 10% of start price or 200,000 INR
Admin Charges: Rs. 11,800/- inclusive of GST

Inspection Schedule:
Inspection of materials can be done between 2026-06-15 and 2026-06-21 during working hours (10:00 AM to 4:00 PM).

Lot No - 1
Lot Name - Scrap Rail and Sleepers
Category - Ferro-Alloys & Metal Scrap
Lot Location - Vijayawada SSE Depot
State - Andhra Pradesh
GST - 18%
TCS - 1.0%
Start Price in INR - 500000
QTY - 120.5 MT
Annex_lot1_photos.pdf
photo_layout_v1.pdf
Lot Description: Scrap Rails 52 kg / 60 kg of various lengths and broken steel sleepers.
1. Steel Sleepers Grade A Nos 45
2. Rails Cut Pieces MT 12
3. Garbage Line Item With Noise

Lot No - 2
Lot Name - Unserviceable Lead Acid Batteries
Category - Batteries & Electrical Scrap
Lot Location - Rajahmundry Depot
State - Andhra Pradesh
GST - 18%
TCS - 1.0%
Start Price in INR - 150000
QTY - 80 Nos
img_batteries_spec.pdf
Lot Description: Discarded lead acid batteries 12V 120AH.
1. Battery Cells lead acid Nos 80

Special Terms and Conditions (STC):
1. Materials will be sold on "As-Is-Where-Is" basis.
2. EMD must be submitted online.
3. Lifting time is 30 days from release order.
4. If "Lot No - 3" is mentioned in instructions, it should not create a phantom lot.
`;

console.log("=== Testing Category Mapper ===");
console.log("Mapping 'Ferro-Alloys & Metal Scrap':", mapCategory("Ferro-Alloys & Metal Scrap"));
console.log("Mapping 'Batteries & Electrical Scrap':", mapCategory("Batteries & Electrical Scrap"));
console.log("Fuzzy Mapping 'compters & printers':", mapCategory("compters & printers"));

console.log("\n=== Testing Parser Orchestration ===");
const result = parseMstcCatalogText(
  sampleCatalogText,
  "Metal Scrap",
  "Southern Railways",
  "Vijayawada"
);

console.log("Parser Output Summary:");
console.log(JSON.stringify(result, null, 2));
