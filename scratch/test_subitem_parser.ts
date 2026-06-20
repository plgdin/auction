interface SubItem {
  sr: number;
  description: string;
  unit: string;
  qty: string;
}

export function parseSubItemsFromText(text: string): SubItem[] {
  if (!text) return [];
  const subItems: SubItem[] = [];
  const seenKeys = new Set<string>();

  const UNITS =
    "nos|no|sets|set|kgs|kg|gms|gm|mts|mt|mtr|mtrs|ltrs|ltr|pcs|pc|" +
    "items|item|units|unit|bags|bag|box|boxes|bdl|bdls|coil|coils|" +
    "roll|rolls|ac|pair|pairs|drums|drum|sheets|sheet|ton|tons|" +
    "gross|dozen|doz|bottles|bottle|bunches|bunch|reams|ream|each|" +
    "bundle|bundles|set\\/nos|nos\\/set|" +
    "cum|cft|cbm|rm|rft";

  const unitsRegex = new RegExp(`^(?:${UNITS})\\b`, "i");

  // Step 1: Normalize text — clean OCR artifacts, compress whitespace per line
  let normalized = text.replace(/\|/g, " ").replace(/\t/g, " ");

  // Step 2: Pre-split concatenated items (e.g. OCR joining multiple rows into one line)
  const splitOnUnitQty = new RegExp(
    `(\\b(?:${UNITS})\\.?\\s+\\d+[\\d,.]*)\\s+(\\d{1,3})\\.?\\s+([A-Z])`,
    "gi",
  );
  let prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(splitOnUnitQty, "$1\n$2 $3");
  }

  const splitOnQtyUnitNewSerial = new RegExp(
    `(\\b\\d+[\\d,.]*\\s+(?:${UNITS})\\b\\.?)\\s+(\\d{1,3})\\s+([A-Z])`,
    "gi"
  );
  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(splitOnQtyUnitNewSerial, "$1\n$2 $3");
  }

  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(
      /(\d+[\d,.]*)\s+(\d{1,3})\s+([A-Z][A-Z][A-Z])/g,
      "$1\n$2 $3",
    );
  }

  // Pre-split on hyphenated serials as well, e.g. "32.150 Kgs 2-Plastic" -> "32.150 Kgs\n2-Plastic"
  const splitOnQtyUnitNewSerialHyphen = new RegExp(
    `(\\b(?:${UNITS})\\b\\.?\\s*\\d+[\\d,.]*|\\b\\d+[\\d,.]*\\s*(?:${UNITS})\\b\\.?)\\s+(\\d{1,3})\\-([A-Z])`,
    "gi"
  );
  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(splitOnQtyUnitNewSerialHyphen, "$1\n$2-$3");
  }

  // Step 3: Line-merging pre-pass to handle wrapped OCR lines
  const rawLines = normalized.split(/\r?\n/).map((l) => l.trim());
  const mergedLines: string[] = [];
  let currentLine = "";

  function startsWithSerial(line: string): boolean {
    const match = line.match(/^(\d+)([\s.-]+)?(.*)$/);
    if (!match) return false;
    const num = parseInt(match[1], 10);
    if (num > 150) return false; // Reasonable upper bound for sub-item serial numbers
    const rest = match[3].trim();
    if (unitsRegex.test(rest)) return false; // Starts with a unit keyword (e.g. "500 Ltr"), so it is likely a quantity/capacity, not serial
    return true;
  }

  for (const line of rawLines) {
    if (!line) continue;
    if (startsWithSerial(line)) {
      if (currentLine) {
        mergedLines.push(currentLine);
      }
      currentLine = line;
    } else {
      if (currentLine) {
        currentLine += " " + line;
      } else {
        mergedLines.push(line);
      }
    }
  }
  if (currentLine) {
    mergedLines.push(currentLine);
  }

  console.log("--- Merged Lines ---");
  mergedLines.forEach(l => console.log(`> ${l}`));
  console.log("--------------------");

  // Step 4: Process line by line
  for (const line of mergedLines) {
    const lower = line.toLowerCase();

    let cleanedLine = line
      .replace(/\b\d+\.?\d*\s*%/g, "")                     // strip percentage columns (18%, 5.00%, 2.50%)
      .replace(/Mob\.?\s*No\.?\s*[\d\s-]+/gi, "")           // strip "Mob No. 9497612987"
      .replace(/Contact\s*(?:Number|No\.?)\s*:?\s*[\d\s-]+/gi, "")  // strip contact numbers
      .replace(/\s+/g, " ")
      .trim();

    // Truncate after the last <number> <unit> match to discard trailing
    // location/column text from merged OCR table rows.
    const lastUnitMatch = new RegExp(
      `(\\d+[\\d,.]*)\\s+(${UNITS})\\b\\.?`,
      "gi",
    );
    let lastMatchEnd = -1;
    let um;
    while ((um = lastUnitMatch.exec(cleanedLine)) !== null) {
      lastMatchEnd = um.index + um[0].length;
    }
    if (lastMatchEnd > 0 && lastMatchEnd < cleanedLine.length) {
      cleanedLine = cleanedLine.substring(0, lastMatchEnd).trim();
    }

    // Skip header rows, page markers, and irrelevant labels
    if (
      /^sl[\s.]?no/i.test(line) ||
      /^serial\s*no/i.test(line) ||
      lower.includes("nomenclature") ||
      lower.includes("appendix") ||
      lower.includes("annexure") ||
      /\blot\s*no\b/i.test(line) ||
      lower.includes("lot parameters") ||
      lower.includes("lot name") ||
      (lower.includes("description") &&
        (lower.includes("qty") ||
          lower.includes("quantity") ||
          lower.includes("a/u"))) ||
      (lower.includes("quantity") &&
        (lower.includes("sl") ||
          lower.includes("unit") ||
          lower.includes("a/u"))) ||
      lower.includes("u.o.m") ||
      lower.includes("gst%") ||
      /\bpage\s+\d/i.test(line) ||
      /^total\b/i.test(line) ||
      /^grand\s*total/i.test(line) ||
      /^sub\s*total/i.test(line)
    ) {
      continue;
    }

    const matchLine = cleanedLine || line;

    // Check if it starts with a serial number that is actually followed by a unit keyword
    // to prevent malformed text lines from being matched.
    const isUnitAfterSr = new RegExp(`^\\d+\\s*\\b(${UNITS})\\b`, "i").test(matchLine);
    if (isUnitAfterSr) {
      continue;
    }

    // Match 1: "<sr>. DESCRIPTION <unit> <qty>"
    const m1 = matchLine.match(
      new RegExp(
        `^(\\d{1,3})[\\s.-]+(.+?)\\s+\\b(${UNITS})\\b\\.?\\s+(\\d+[\\d,.]*)\\s*$`,
        "i",
      ),
    );
    if (m1) {
      addItem(m1[1], m1[2], m1[3], m1[4]);
      continue;
    }

    // Match 2: "<sr>. DESCRIPTION <qty> <unit>"
    const m2 = matchLine.match(
      new RegExp(
        `^(\\d{1,3})[\\s.-]+(.+?)\\s+(\\d+[\\d,.]*)\\s+\\b(${UNITS})\\b\\.?\\s*$`,
        "i",
      ),
    );
    if (m2) {
      addItem(m2[1], m2[2], m2[4], m2[3]);
      continue;
    }

    // Match 3: "<sr>. DESCRIPTION <qty>" (no explicit unit, default to Nos)
    const m3 = matchLine.match(/^(\d{1,3})[\\s.-]+(.+?)\\s+(\\d+[\d,.]*)$/);
    if (m3) {
      const desc = m3[2].trim();
      if (
        desc.length > 2 &&
        !/^\d+$/.test(desc) &&
        /[a-zA-Z]{2,}/.test(desc)
      ) {
        addItem(m3[1], desc, "Nos", m3[3]);
      }
    }
  }

  function addItem(srStr: string, rawDesc: string, unit: string, qty: string) {
    // Clean trailing junk from description, e.g. ", Qty :", "Qty :", etc.
    let desc = rawDesc.trim();
    desc = desc.replace(/,?\s*Qty\s*:\s*$/i, "");
    desc = desc.replace(/,?\s*Quantity\s*:\s*$/i, "");
    desc = desc.replace(/,?\s*Qty\s*-\s*$/i, "");
    desc = desc.trim();

    if (desc.length < 2 || !/[a-zA-Z]{2,}/.test(desc)) return;

    const sr = parseInt(srStr, 10);
    const key = `${sr}_${desc.toLowerCase().substring(0, 30)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    subItems.push({
      sr,
      description: desc,
      unit: unit.trim(),
      qty: qty.trim(),
    });
  }

  return subItems;
}

const testText = `
General Scrap Items
1-Iron, Qty : 32.150 Kgs
2-Plastic, Qty : 5.750 Kgs
3-Stainless Steel, Qty : 5.600 Kgs
4-Aluminium, Qty : 9.300 Kgs
5-Wood, Qty : Wood 19.500 Kgs
6-Rubber, Qty : 15 Nos
7-Atta Kneeder 25 Kgs, Qty : 1 No
8-Deep Freezer
500 Ltr, Qty : 1 No
9-Centrifugal Pump 1 HP Single Phase, Qty : 1 No
10-Water Dispenser With bottle pedestal Type, Qty : 2 Nos
11-Water Dispenser with Bottle table top type, Qty : 2 Nos
`;

console.log("Parsed sub-items:\n", JSON.stringify(parseSubItemsFromText(testText), null, 2));
