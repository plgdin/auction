function extractQuantitiesDetailed(text: string): { qty: string; unit: string } {
  const matches: { value: number; unit: string; index: number }[] = [];
  
  // 1. Match "QTY: 21,172NOS", "QTY: 296.800KGS", "(Qty: 17 nos.)"
  const qtyRegex = /(?:qty|quantity|quantities)\s*[:.-]?\s*([\d\.,]+)\s*([A-Za-z]+)?/gi;
  let match;
  while ((match = qtyRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val)) {
      matches.push({
        value: val,
        // Default to 'NOS' or 'LOT' depending on context if unit is empty
        unit: (match[2] || 'NOS').toUpperCase().trim(),
        index: match.index
      });
    }
  }

  // 2. Match suffix-only units for count types only (e.g. "55 Nos", "10 Pcs")
  // For weight/volume/dimensions (KGS, MTS, TONS, LTRS, KG, MT, LTR), they MUST be preceded by QTY: to be safe.
  const countUnitRegex = /\b([\d\.,]+)\s*(nos|pcs|units|sets|pc|items|item)\b/gi;
  while ((match = countUnitRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val)) {
      matches.push({
        value: val,
        unit: match[2].toUpperCase().trim(),
        index: match.index
      });
    }
  }

  if (matches.length === 0) {
    return { qty: '1', unit: 'Lot' };
  }

  // Deduplicate overlapping matches (e.g. if a string matches both QTY: 17 nos and 17 nos)
  matches.sort((a, b) => a.index - b.index);
  const uniqueMatches: typeof matches = [];
  for (const m of matches) {
    const isOverlapping = uniqueMatches.some(
      (um) => Math.abs(um.index - m.index) < 15 // within 15 chars
    );
    if (!isOverlapping) {
      uniqueMatches.push(m);
    }
  }

  // Group by unit
  const groups: { [unit: string]: number } = {};
  for (const m of uniqueMatches) {
    let u = m.unit;
    if (u === 'KG') u = 'KGS';
    if (u === 'MT') u = 'MTS';
    if (u === 'PC') u = 'PCS';
    if (u === 'LTR') u = 'LTRS';
    if (u === 'TON') u = 'TONS';
    if (u === 'ITEM') u = 'ITEMS';
    
    groups[u] = (groups[u] || 0) + m.value;
  }

  const groupEntries = Object.entries(groups);
  if (groupEntries.length === 0) {
    return { qty: '1', unit: 'Lot' };
  }

  if (groupEntries.length === 1) {
    const [u, totalVal] = groupEntries[0];
    const qty = Number.isInteger(totalVal)
      ? totalVal.toLocaleString('en-IN')
      : totalVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    return { qty, unit: u };
  } else {
    const qty = groupEntries
      .map(([u, totalVal]) => {
        const formattedVal = Number.isInteger(totalVal)
          ? totalVal.toLocaleString('en-IN')
          : totalVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        return `${formattedVal} ${u}`;
      })
      .join(' + ');
    return { qty, unit: '' };
  }
}

// Test with 13932 block text
const text13932 = `
Old and Used Condemned Air conditioner split and window type of various make & model / capacity with / without compresors on as is where is basis.Make of Split ACs: Samsung, LG, Blue Star, Voltas & Forbes (55 Nos)Make of Window ACs: Carrier, Alpine (Qty: 17 nos.)
`;

console.log('Test 13932 output:', extractQuantitiesDetailed(text13932));

// Test with 8714 Lot 2 block text
const text8714_lot2 = `
Rags QTY: 296.800KGS (approx.) Poly Bag 50 Kg SA QTY: 4,643NOS (approx.) Poly Bag 30 Kg SA QTY: 4,458NOS (approx.) CFC SA QTY: 5,572NOS (approx.) CFC US QTY: 4,845NOS (approx.) Iron Scrap QTY: 1582.389KGS (approx.)
`;

console.log('Test 8714 Lot 2 output:', extractQuantitiesDetailed(text8714_lot2));
