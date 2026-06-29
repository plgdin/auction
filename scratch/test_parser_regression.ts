import { parseMstcCatalogText } from '../scraper/parsers/mstcParser.js';

interface TestCase {
  name: string;
  category: string;
  seller: string;
  location: string;
  rawText: string;
  expectedItems: {
    sr: string;
    qty: string;
    unit: string;
    descriptionContains: string;
  }[];
}

const testCases: TestCase[] = [
  {
    name: "Auction 16677 - Wrapped Zeros & Plot No address split",
    category: "Miscellaneous | Plastic",
    seller: "Bharti Airtel Ltd.",
    location: "Delhi & NCR",
    rawText: `
Lot Details: Lot DetailsLot DescriptionLot ParametersOther DetailsLot Documents
Lot No - 1.0
Lot Name - MP_TNL-
FF_Cables_Fiber
Cable_11.226_26086
0
Product Type -
Miscellaneous
Category - Plastic
PCB Group - PRE-
BID EMD for Plastic
Scrap for Airtel
Fiber Cable

Location : Bharti
Airtel Ltd C/o
NWCC Plot
No.113/114/115,
JRG Logistics
Park AB Road,
Vill. Dakachya,
Tehsil Sanwer Pin
453771 Indore
Madhya Pradesh

Contact Person :
Sourabh Awasthi -
8827316837

Note : Collection
of GST & TCS is
the
responsibility of
the seller.GST &
TCS as
applicable at the
time of delivery.
Quantity - 1010.0 KG
Start Price in INR - 1
Bid Increment in INR -
1.0
Post Bid EMD % -
120.36
TCS (%) - 2.0
GST (%) - 18.0%
Lot Location - As Per
Lot Description State
:Madhya Pradesh
Lot State - Madhya
Pradesh
Bid Valid Till - 30-07-
2026
    `,
    expectedItems: [
      {
        sr: "1.0",
        qty: "1,010",
        unit: "KG",
        descriptionContains: "Cables_Fiber"
      }
    ]
  },
  {
    name: "Auction 16846 - Structured Lot parameters vs unit-first description metrics",
    category: "Miscellaneous | Textile",
    seller: "HQ 21 SUB AREA",
    location: "Himachal Pradesh",
    rawText: `
Lot Details:
Lot No - 9FOD/01/26
Lot Name - Canvas
Old
Product Type -
Miscellaneous
Category - Textile
Canvas Old,
Approx Wt in
KGS: 4000,
Remarks: To be
lifted in Kgs
Quantity - 1.0 LOT
Start Price in INR - 1
Bid Increment in INR -
1.0
Post Bid EMD % -
25.0
TCS (%) - 0.0
GST (%) - As
Applicable
Lot Location - SDP
Kandrori (9FOD)
    `,
    expectedItems: [
      {
        sr: "9FOD/01/26",
        qty: "4,000",
        unit: "KGS",
        descriptionContains: "Canvas Old"
      }
    ]
  },
  {
    name: "Structured Quantity parameter with colon separator",
    category: "Scrap | Metal",
    seller: "Indian Railways",
    location: "Mumbai",
    rawText: `
Lot No - 1.0
Lot Name - Rail Scrap
Product Type - Scrap
Category - Steel
Iron scrap lying at yard
Quantity : 55.5 MT
Start Price in INR - 1000
    `,
    expectedItems: [
      {
        sr: "1.0",
        qty: "55.5",
        unit: "MT",
        descriptionContains: "Iron scrap"
      }
    ]
  }
];

function runTests() {
  console.log("Running Parser Regression Test Suite...\n");
  let failed = false;

  for (const tc of testCases) {
    console.log(`[TEST] Running: ${tc.name}`);
    const result = parseMstcCatalogText(tc.rawText, tc.category, tc.seller, tc.location);
    
    // Check if item count matches
    if (result.items.length !== tc.expectedItems.length) {
      console.error(`  [FAIL] Expected ${tc.expectedItems.length} items, but parsed ${result.items.length}.`);
      console.error("  Parsed Items:", JSON.stringify(result.items, null, 2));
      failed = true;
      continue;
    }
    
    // Assert item details
    for (let i = 0; i < tc.expectedItems.length; i++) {
      const parsed = result.items[i];
      const expected = tc.expectedItems[i];
      
      const srMatch = String(parsed.sr) === expected.sr;
      const qtyMatch = parsed.qty === expected.qty;
      const unitMatch = parsed.unit.toUpperCase() === expected.unit.toUpperCase();
      const descMatch = parsed.description.includes(expected.descriptionContains);
      
      if (!srMatch || !qtyMatch || !unitMatch || !descMatch) {
        console.error(`  [FAIL] Item ${i + 1} did not match expectations.`);
        if (!srMatch) console.error(`    Expected Serial '${expected.sr}', got '${parsed.sr}'`);
        if (!qtyMatch) console.error(`    Expected Qty '${expected.qty}', got '${parsed.qty}'`);
        if (!unitMatch) console.error(`    Expected Unit '${expected.unit}', got '${parsed.unit}'`);
        if (!descMatch) console.error(`    Expected Description containing '${expected.descriptionContains}', got '${parsed.description}'`);
        failed = true;
      }
    }
    
    if (!failed) {
      console.log("  [PASS] All assertions succeeded.");
    }
  }

  if (failed) {
    console.error("\nSome test cases FAILED. Please review the output above.");
    process.exit(1);
  } else {
    console.log("\nALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

runTests();
