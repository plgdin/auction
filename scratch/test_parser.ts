import * as fs from 'fs';

const text = fs.readFileSync('scratch/raw_pdf_text_8714.txt', 'utf-8');
const lotBlocks = text.split(/Lot No\s*-\s*/);

for (let i = 1; i < lotBlocks.length; i++) {
  const block = lotBlocks[i];
  
  // Extract lot ID
  const lotNameIdx = block.search(/Lot Name\s*-/i);
  let lotId = '';
  if (lotNameIdx > 0) {
    lotId = block.slice(0, lotNameIdx).replace(/\r?\n/g, '').trim();
  } else {
    const firstLines = block.split('\n').map((l) => l.trim());
    lotId = firstLines.find((l) => l.length > 0) || '';
  }
  if (!lotId || lotId.length > 80) continue;

  let qty = '1';
  let unit = 'Lot';

  const qtyRegex = /QTY:\s*(?:\r?\n)?\s*([\d\.,]+)\s*([A-Za-z]+)?/gi;
  const matches = Array.from(block.matchAll(qtyRegex));

  if (matches.length > 0) {
    const groups: { [unit: string]: number } = {};
    for (const match of matches) {
      const valStr = match[1].replace(/,/g, '').trim();
      const val = parseFloat(valStr);
      if (!isNaN(val)) {
        const u = (match[2] || 'Unit').toUpperCase().trim();
        groups[u] = (groups[u] || 0) + val;
      }
    }

    const groupEntries = Object.entries(groups);
    if (groupEntries.length === 1) {
      const [u, totalVal] = groupEntries[0];
      qty = Number.isInteger(totalVal)
        ? totalVal.toLocaleString('en-IN')
        : totalVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
      unit = u === 'UNIT' ? 'Lot' : u;
    } else if (groupEntries.length > 1) {
      qty = groupEntries
        .map(([u, totalVal]) => {
          const formattedVal = Number.isInteger(totalVal)
            ? totalVal.toLocaleString('en-IN')
            : totalVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
          return `${formattedVal} ${u}`;
        })
        .join(' + ');
      unit = '';
    }
  } else {
    const qtyMatch = block.match(/Quantity\s*-\s*([\d\.,]+)\s*([A-Za-z]+)?/i);
    if (qtyMatch) {
      qty = qtyMatch[1].trim();
      unit = (qtyMatch[2] || 'Lot').trim();
    }
  }

  console.log(`Lot ${lotId}: qty = "${qty}", unit = "${unit}"`);
}
