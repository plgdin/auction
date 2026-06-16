import * as fs from 'fs';

function parseMstcCatalogText(text: string): any {
  const lines = text.split('\n').map(l => l.trim());
  const cleanText = lines.join('\n');

  const items: any[] = [];
  const lotBlocks = cleanText.split(/Lot No\s*-\s*/);
  
  if (lotBlocks.length > 1) {
    for (let i = 1; i < lotBlocks.length; i++) {
      const block = lotBlocks[i];
      const blockLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      const lotNoLine = blockLines[0];
      const lotNo = parseInt(lotNoLine);
      if (isNaN(lotNo)) continue;

      let lotName = '';
      const nameMatch = block.match(/Lot Name\s*-\s*([\s\S]*?)(?=Product Type)/i);
      if (nameMatch) {
        lotName = nameMatch[1].replace(/\r?\n/g, ' ').trim();
      }

      let gst = '18.0%';
      const gstMatch = block.match(/GST\s*\(%\)\s*-\s*([\s\S]*?)(?=Lot Location|State|Lot State|TCS|Bid Valid|$)/i);
      if (gstMatch) {
        gst = gstMatch[1].replace(/\r?\n/g, ' ').trim();
      }
      
      let tcs = '0.0';
      const tcsMatch = block.match(/TCS\s*\(%\)\s*-\s*([\s\S]*?)(?=GST|Lot Location|State|Lot State|Bid Valid|$)/i);
      if (tcsMatch) {
        tcs = tcsMatch[1].replace(/\r?\n/g, ' ').trim();
      }
      const taxRate = `${gst} GST${tcs && tcs !== '0.0' && tcs !== '0' ? ' + ' + tcs + '% TCS' : ''}`;

      // Search for sub-items
      const subItems: any[] = [];
      for (let j = 0; j < blockLines.length; j++) {
        const line = blockLines[j];
        if (line.toLowerCase().startsWith('quantity -')) continue;

        let qty = '';
        let unit = '';
        
        const directMatch = line.match(/(?:QTY|Quantity)\s*[:\-]\s*([\d,.]+)\s*([A-Za-z]+)?/i);
        if (directMatch) {
          qty = directMatch[1];
          unit = directMatch[2] || '';
        } else if (/^(?:QTY|Quantity)\s*[:\-]?$/i.test(line) && j + 1 < blockLines.length) {
          const nextLine = blockLines[j + 1];
          const nextMatch = nextLine.match(/^([\d,.]+)\s*([A-Za-z]+)?/i);
          if (nextMatch) {
            qty = nextMatch[1];
            unit = nextMatch[2] || '';
          }
        }

        if (qty) {
          // Find description by looking upwards
          let desc = '';
          for (let k = j - 1; k >= 0; k--) {
            const prevLine = blockLines[k];
            if (
              prevLine.includes('Lot No -') ||
              prevLine.includes('Lot Name -') ||
              prevLine.includes('Product Type -') ||
              prevLine.includes('Category -') ||
              prevLine.toLowerCase().startsWith('qty') ||
              prevLine.toLowerCase().includes('(approx') ||
              prevLine === '(approx.)'
            ) {
              break;
            }
            
            const cleanPrev = prevLine.trim();
            if (desc === '') {
              desc = cleanPrev;
            } else {
              desc = cleanPrev + ' ' + desc;
            }
            
            // If it seems to be the main starting line of the item, we can stop
            if (
              cleanPrev.toLowerCase().includes('poly bag') ||
              cleanPrev.toLowerCase().includes('rags') ||
              cleanPrev.toLowerCase().includes('cfc') ||
              cleanPrev.toLowerCase().includes('tin') ||
              cleanPrev.toLowerCase().includes('brl') ||
              cleanPrev.toLowerCase().includes('jerrican') ||
              cleanPrev.toLowerCase().includes('grease drum') ||
              cleanPrev.toLowerCase().includes('iron scrap') ||
              cleanPrev.toLowerCase().includes('bag 1 md') ||
              cleanPrev.length > 15
            ) {
              break;
            }
          }
          
          if (desc) {
            subItems.push({
              sr: lotNo,
              description: desc.trim(),
              qty: qty.replace(/,/g, ''),
              unit: unit.trim() || 'Nos',
              taxRate
            });
          }
        }
      }

      if (subItems.length > 0) {
        items.push(...subItems);
      } else {
        // Fallback to main lot details
        let mainQty = '1';
        let mainUnit = 'Lot';
        const mainQtyMatch = block.match(/Quantity\s*-\s*([\d\.,]+)\s*([A-Za-z]+)?/i);
        if (mainQtyMatch) {
          mainQty = mainQtyMatch[1].trim();
          mainUnit = (mainQtyMatch[2] || 'Lot').trim();
        }
        items.push({
          sr: lotNo,
          description: lotName || 'Auction Lot Items',
          qty: mainQty,
          unit: mainUnit,
          taxRate
        });
      }
    }
  }

  return items;
}

const text = fs.readFileSync('scratch/dimapur_text.txt', 'utf-8');
const items = parseMstcCatalogText(text);
console.log('EXTRACTED ITEMS (total: ' + items.length + '):');
console.log(JSON.stringify(items, null, 2));
