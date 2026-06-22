import { matchPageToLots, processPageForLotEnrichment } from "../scraper/assetWorker.js";
import { parseSubItemsFromText } from "../scraper/parsers/mstcParser.js";
import { pipeline } from "@xenova/transformers";

async function runTests() {
  console.log("==================================================");
  console.log("      RUNNING SCENARIO VERIFICATION TESTS         ");
  console.log("==================================================");

  // Initialize pipeline
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  const items = [
    { sr: 1, description: "Heavy Steel Scrap Rail pieces", subItems: [], qty: "", unit: "" },
    { sr: 2, description: "MS plate", subItems: [], qty: "", unit: "" },
    { sr: 3, description: "GI pipes", subItems: [], qty: "", unit: "" }
  ];

  // Precompute embeddings in batch
  console.log("\n1. [BATCH EMBEDDING PRECOMPUTATION TEST]");
  const uniqueLotDescriptions = items.map(it => it.description);
  const output = await extractor(uniqueLotDescriptions, { pooling: "mean", normalize: true });
  const batchSize = uniqueLotDescriptions.length;
  const dim = output.dims ? output.dims[1] : (output.data.length / batchSize);
  const data = output.data as any;

  const lotEmbeddings = new Map<string, number[]>();
  for (let idx = 0; idx < batchSize; idx++) {
    const desc = uniqueLotDescriptions[idx];
    const vector = Array.from(data.subarray(idx * dim, (idx + 1) * dim)) as number[];
    lotEmbeddings.set(desc, vector);
  }
  console.log(`- Precomputed ${lotEmbeddings.size} lot embeddings in a single batched call.`);

  // Test Whitelist short terms
  console.log("\n2. [SHORT SCRAP TERM WHITELISTING TEST]");
  const testText1 = "We have old MS plates stored in Rajahmundry depot.";
  const matched1 = await matchPageToLots(testText1, items, "annex_details.pdf", lotEmbeddings);
  console.log(`- Text: "${testText1}"`);
  console.log(`- Matched Lots: ${JSON.stringify(matched1.map(m => m.sr))} (Expected: [2] because 'MS' and 'plates' match 'MS plate')`);

  const testTextGI = "Stock of GI pipes structures and tubes.";
  const matchedGI = await matchPageToLots(testTextGI, items, "annex_details.pdf", lotEmbeddings);
  console.log(`- Text: "${testTextGI}"`);
  console.log(`- Matched Lots: ${JSON.stringify(matchedGI.map(m => m.sr))} (Expected: [3] because 'GI' and 'pipes' match 'GI pipes')`);

  // Test OCR-Noise and prefix/leading-zero matching
  console.log("\n2b. [OCR TYPO & LEADING-ZERO / PREFIX MATCHING TEST]");
  const ocrNoiseText = "We found some heavy steol rails in the back.";
  const matchedOcr = await matchPageToLots(ocrNoiseText, items, "annex_details.pdf", lotEmbeddings);
  console.log(`- Text: "${ocrNoiseText}"`);
  console.log(`- Matched Lots: ${JSON.stringify(matchedOcr.map(m => m.sr))} (Expected: [1] because 'steol' fuzzy matches 'steel' and 'heavy'/'rails' match)`);

  const leadingZeroText = "Check inventory for Lot 02 structures.";
  const matchedZero = await matchPageToLots(leadingZeroText, items, "annex_details.pdf", lotEmbeddings);
  console.log(`- Text: "${leadingZeroText}"`);
  console.log(`- Matched Lots: ${JSON.stringify(matchedZero.map(m => m.sr))} (Expected: [2] because 'Lot 02' matches lot sr 2)`);

  const prefixText = "Details are listed under S.No. 03 of the sheet.";
  const matchedPrefix = await matchPageToLots(prefixText, items, "annex_details.pdf", lotEmbeddings);
  console.log(`- Text: "${prefixText}"`);
  console.log(`- Matched Lots: ${JSON.stringify(matchedPrefix.map(m => m.sr))} (Expected: [3] because 'S.No. 03' matches lot sr 3)`);

  // Test Keyword Disambiguation
  console.log("\n3. [KEYWORD DISAMBIGUATION TEST]");
  const items3 = [
    { sr: 1, description: "Steel Scrap", subItems: [], qty: "", unit: "" },
    { sr: 2, description: "Steel Plate", subItems: [], qty: "", unit: "" }
  ];

  const uniqueLotDescriptions3 = items3.map(it => it.description);
  const output3 = await extractor(uniqueLotDescriptions3, { pooling: "mean", normalize: true });
  const data3 = output3.data as any;
  const dim3 = output3.dims ? output3.dims[1] : (data3.length / uniqueLotDescriptions3.length);
  const lotEmbeddings3 = new Map<string, number[]>();
  for (let idx = 0; idx < uniqueLotDescriptions3.length; idx++) {
    const desc = uniqueLotDescriptions3[idx];
    const vector = Array.from(data3.subarray(idx * dim3, (idx + 1) * dim3)) as number[];
    lotEmbeddings3.set(desc, vector);
  }

  const testText2 = "We found steel plates of various thicknesses in the yard.";
  const matched2 = await matchPageToLots(testText2, items3, "annex_details.pdf", lotEmbeddings3);
  console.log(`- Text: "${testText2}"`);
  console.log(`- Matched Lots (disambiguated): ${JSON.stringify(matched2.map(m => m.sr))} (Expected: [2] - Steel Scrap filtered out)`);

  // Test Continuation Fallback
  console.log("\n4. [CONTINUATION FALLBACK TEST]");
  const continuationText = "Some list of continuation items: \n1. Plates Grade A Nos 40\n2. Scrap cut pieces Nos 20";
  // When no matches occur explicitly or via keywords, but lastMatched was Lot 1:
  const matchedCont = await matchPageToLots(continuationText, items, "annex_details.pdf", lotEmbeddings, [items[0]]);
  console.log(`- Text: "${continuationText}"`);
  console.log(`- Continuation match: ${JSON.stringify(matchedCont.map(m => m.sr))} (Expected: [1])`);

  // Test Multi-Lot Page Segmentation
  console.log("\n5. [MULTI-LOT PAGE SEGMENTATION TEST]");
  const multiLotText = `
    Lot No - 1
    This section contains Rails.
    1. Rails Cut Pieces MT 12
    
    Lot No - 2
    This section contains MS Plates.
    1. MS Plates Grade B Nos 30
  `;

  // Mock arguments for processPageForLotEnrichment
  const mockLotSpecificImagesMap: Record<string, string[]> = {};
  const mockAttachmentToLots = new Map<string, any[]>();
  const dummyBuffer = Buffer.from("");

  const itemsMock = [
    { sr: 1, description: "Heavy Steel Scrap Rail pieces", subItems: [], qty: "", unit: "" },
    { sr: 2, description: "Mild Steel MS plate structures", subItems: [], qty: "", unit: "" }
  ];

  await processPageForLotEnrichment(
    dummyBuffer,
    multiLotText,
    itemsMock,
    mockAttachmentToLots,
    "annex_multi.pdf",
    "http://mockurl/img.jpg",
    mockLotSpecificImagesMap,
    console,
    lotEmbeddings
  );

  console.log("- Segmented Lot 1 subItems:", JSON.stringify(itemsMock[0].subItems));
  console.log("- Segmented Lot 2 subItems:", JSON.stringify(itemsMock[1].subItems));
  console.log(`- Lot 1 Qty updated: ${itemsMock[0].qty} ${itemsMock[0].unit}`);
  console.log(`- Lot 2 Qty updated: ${itemsMock[1].qty} ${itemsMock[1].unit}`);

  console.log("\n==================================================");
  console.log("              ALL TESTS COMPLETED                 ");
  console.log("==================================================");
}

runTests().catch(console.error);
