/**
 * Test script for quantity extraction, table parsing, and aggregation logic.
 * Run with: npx tsx scratch/test_table_ocr.ts
 */
import {
  parseTableRowsForSubItems,
  extractRawMatches,
  type SubItem
} from '../scraper/assetWorker.js';

const testTexts = [
  "1. | Computer Chair | 01 | Nos | 18%\n2. | Computer Table | 02 | Nos | 18%",
  "1. / Computer Chair / 05 / Nos / 18%",
  "Computer Chair     12  Nos",
  "Copper Scrap | 150 | Kg | 18% GST",
  "We have received 12 Nos of computer chairs."
];

console.log("=================================");
console.log("Running Table Row Parsing Tests...");
console.log("=================================");

testTexts.forEach((text, i) => {
  console.log(`\nTest ${i + 1}:`);
  console.log(parseTableRowsForSubItems(text));
});

console.log("\n=================================");
console.log("Running Quantity Aggregation Tests...");
console.log("=================================");

// Simulate a multi-page PDF processing with aggregation
const mockLots = [
  { sr: 1, description: "Office Furniture", qty: "1", unit: "Lot" },
  { sr: 2, description: "Copper Cables", qty: "1", unit: "Lot" }
];

// Map containing page-by-page extracted data
const lotMatchesMap: Record<string, { value: number; unit: string; index: number }[]> = {};
const lotSubItemsMap: Record<string, SubItem[]> = {};

// Mock processing Page 1 of Lot 1
const page1Text = "Lot 1 Annexure Page 1:\n1. | Executive Chairs | 15 | Nos | 18%\n2. | Computer Desks | 10 | Nos | 18%";
const page1Matches = extractRawMatches(page1Text);
const page1SubItems = parseTableRowsForSubItems(page1Text);

// Mock processing Page 2 of Lot 1
const page2Text = "Lot 1 Annexure Page 2:\n3. | Conference Table | 2 | Nos | 18%\n4. | Visitor Chairs | 10 | Nos | 18%";
const page2Matches = extractRawMatches(page2Text);
const page2SubItems = parseTableRowsForSubItems(page2Text);

// Mock processing Page 3 of Lot 2
const page3Text = "Lot 2 Annexure Page 1:\n1. | Heavy Copper Wires | 150 | Kgs | 18%\n2. | Thin Copper Wires | 50.5 | Kgs | 18%";
const page3Matches = extractRawMatches(page3Text);
const page3SubItems = parseTableRowsForSubItems(page3Text);

// Associate Page 1 with Lot 1
const sr1 = "1";
if (!lotMatchesMap[sr1]) lotMatchesMap[sr1] = [];
lotMatchesMap[sr1].push(...page1Matches);
if (!lotSubItemsMap[sr1]) lotSubItemsMap[sr1] = [];
lotSubItemsMap[sr1].push(...page1SubItems);

// Associate Page 2 with Lot 1
lotMatchesMap[sr1].push(...page2Matches);
lotSubItemsMap[sr1].push(...page2SubItems);

// Associate Page 3 with Lot 2
const sr2 = "2";
if (!lotMatchesMap[sr2]) lotMatchesMap[sr2] = [];
lotMatchesMap[sr2].push(...page3Matches);
if (!lotSubItemsMap[sr2]) lotSubItemsMap[sr2] = [];
lotSubItemsMap[sr2].push(...page3SubItems);

// Inject mock images for testing
const mockImgUrl1 = "https://supabase.co/storage/v1/object/public/documents/page1.jpg";
const mockImgUrl2 = "https://supabase.co/storage/v1/object/public/documents/page2.jpg";
page1SubItems.forEach(item => item.images = [mockImgUrl1]);
page2SubItems.forEach(item => item.images = [mockImgUrl1]);
page3SubItems.forEach(item => item.images = [mockImgUrl2]);

// Perform the exact final aggregation logic as implemented in assetWorker.ts
import { formatGroupEntries } from '../scraper/utils/quantityUtils.js';

for (const lot of mockLots) {
  const srStr = String(lot.sr);
  
  // Aggregate quantities
  const matches = lotMatchesMap[srStr] || [];
  if (matches.length > 0) {
    const groups: { [unit: string]: number } = {};
    for (const m of matches) {
      groups[m.unit] = (groups[m.unit] || 0) + m.value;
    }
    
    const formatted = formatGroupEntries(groups);
    if (formatted && formatted.qty && formatted.qty !== "1" && formatted.qty !== "1.0") {
      lot.qty = formatted.qty;
      lot.unit = formatted.unit;
    }
  }

  // Aggregate sub-items
  const subItems = lotSubItemsMap[srStr] || [];
  if (subItems.length > 0) {
    const groupedSubItems: Record<string, { qty: number; unit: string; description: string; images: string[] }> = {};
    for (const item of subItems) {
      const key = `${item.description.toLowerCase()}||${item.unit.toLowerCase()}`;
      if (!groupedSubItems[key]) {
        groupedSubItems[key] = {
          qty: 0,
          unit: item.unit,
          description: item.description,
          images: []
        };
      }
      groupedSubItems[key].qty += item.qty;
      if (item.images) {
        for (const img of item.images) {
          if (!groupedSubItems[key].images.includes(img)) {
            groupedSubItems[key].images.push(img);
          }
        }
      }
    }

    const subItemsList = Object.values(groupedSubItems);
    if (subItemsList.length > 0) {
      const listLines = subItemsList.map(item => `  - ${item.description}: ${item.qty} ${item.unit}`);
      const detailsText = `\n\nDetailed Items from Attachments:\n${listLines.join('\n')}`;
      const cleanBaseDesc = lot.description.split(/\r?\n\r?\nDetailed Items/)[0];
      lot.description = cleanBaseDesc + detailsText;

      (lot as any).subItems = subItemsList.map(s => ({
        description: s.description,
        qty: String(s.qty),
        unit: s.unit,
        images: s.images
      }));
    }
  }
}

console.log("\nLot 1 Aggregated Result:");
console.log(JSON.stringify(mockLots[0], null, 2));

console.log("\nLot 2 Aggregated Result:");
console.log(JSON.stringify(mockLots[1], null, 2));
