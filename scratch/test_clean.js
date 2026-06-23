function cleanMaterialDescription(desc) {
  if (!desc) return '';
  let cleaned = desc;

  // 1. Remove "Note: ..." / "Note- ..." and everything after it
  cleaned = cleaned.replace(/\bNote\s*[:.-].*$/gi, '');

  // 2. Remove "Location: ..." and everything after it
  cleaned = cleaned.replace(/\bLocation\s*[:.-].*$/gi, '');
  cleaned = cleaned.replace(/\bLot Location\s*[:.-].*$/gi, '');

  // 3. Remove "Total Qty: ... No" / "Qty- 250 Nos" / "Quantity ..."
  cleaned = cleaned.replace(/\b(?:Approx\s*)?(?:Qty|Quantity|QTY|Total\s*Qty)\s*[:.-]?\s*\d+[\d,.]*\s*(?:Nos?|No|Items?|Lots?|Units?|Kgs?|MT|Tons?|Pcs?|[a-zA-Z]+)?/gi, '');

  // 4. Remove "Cond: ..." or "Condition: ..."
  cleaned = cleaned.replace(/\bCond(?:ition)?\s*[:.-]?\s*[a-zA-Z0-9-+/]+/gi, '');

  // 5. Remove "As per Lot Annexure" or "As per Annexure" or "As per ... Annexure"
  cleaned = cleaned.replace(/As per\s+(?:Lot\s+)?Annexure(?:\s+\S+)?/gi, '');

  // 6. Remove "CLICK HERE FOR ITEMS PHOTOGRAPH" / "CLICK HERE FOR ITEMS PHOTOGRAP H" / "CLICK HERE"
  cleaned = cleaned.replace(/\bCLICK\s*HERE\s*(?:FOR\s+[A-Za-z0-9\s-]{1,30})?/gi, '');

  // 7. Strip known metadata prefixes/fields and their values (strict word-count limits or specific matches)
  cleaned = cleaned.replace(/PCB Group\s*[:.-]\s*[A-Za-z0-9&/–—-]+/gi, '');
  cleaned = cleaned.replace(/Product Type\s*[:.-]\s*(?:[A-Za-z0-9&/–—-]+\s*){1,2}/gi, '');
  cleaned = cleaned.replace(/Category\s*[:.-]\s*(?:End of life vehicles|Ferro-Alloys\s*&\s*Metal Scrap|Batteries\s*&\s*Electrical Scrap|[A-Za-z0-9&/–—-]+\s*){1,4}/gi, '');
  cleaned = cleaned.replace(/Lot State\s*[:.-]\s*(?:[A-Za-z0-9&/–—-]+\s*){1,2}/gi, '');
  cleaned = cleaned.replace(/State\s*[:.-]\s*(?:[A-Za-z0-9&/–—-]+\s*){1,2}/gi, '');

  // Clean up punctuation, spaces, etc.
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*[,:-]\s*/, '')
    .replace(/\s*[,:-]\s*$/, '')
    .trim();

  // 8. Strip stray words at the start
  cleaned = cleaned.replace(/^vehicles\b/gi, '');

  // Clean again after stripping leading word
  cleaned = cleaned
    .replace(/^\s*[,:-]\s*/, '')
    .trim();

  return cleaned;
}

const tests = [
  "vehicles PCB Group - RVSF Tata Sumo Amb Total Qty:15 No Cond: CL-V As per Lot Annexure",
  "vehicles PCB Group - RVSF Omni Van Total Qty:2 No Cond: CL-V As per Lot Annexure",
  "vehicles Product Type - Transport Vehicles Bus TATA Long Chasis",
  "vehicles Category - End of life vehicles TATA 10 TON",
  "vehicles PCB Group - RVSF TLR 1 TON 2 WHLD WTR 1000 LTR Total Qty: 25 No Cond: CL-V As per Lot Annexure"
];

for (const t of tests) {
  console.log(`Input:  "${t}"`);
  console.log(`Output: "${cleanMaterialDescription(t)}"`);
  console.log('--------------------------------------------------');
}
