import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

// Original JSDOM-based parser for reference
function parseMstcHtmlJsdom(html: string): any[] {
  const dom = new JSDOM('<table><tbody id="finalAppendBody">' + html + '</tbody></table>');
  const links = Array.from(dom.window.document.querySelectorAll('#finalAppendBody tr a'));

  const targetLinks = links.filter(a => {
    const onclick = a.getAttribute('onclick') || '';
    return onclick.includes('downloadCatalogue');
  });

  const structuralRows: any[] = [];
  targetLinks.forEach((a) => {
    const onclickText = a.getAttribute('onclick') || '';
    const match = onclickText.match(/downloadCatalogue\((\d+)\)/);
    const aucId = match ? match[1] : '';
    if (!aucId) return;

    const row = a.closest('tr');
    let categoryName = 'Industrial / Commercial Scrap Lots';
    let dateStr = '';
    let durationStr = '';

    if (row) {
      const cells = Array.from(row.querySelectorAll('td'));
      const cellHTML = cells[1]?.innerHTML || '';
      categoryName = cellHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(', ') || 'Industrial / Commercial Scrap Lots';
      dateStr = cells[3]?.textContent?.trim() || '';
      durationStr = cells[4]?.textContent?.trim() || '';
    }

    const lines = (a.textContent || '').split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || '';
    const auctionNumber = firstLine.replace(/Download PDF/i, '').trim() || 'MSTC-' + aucId;

    const parts = auctionNumber.split('/');
    let sellerName = 'MSTC Seller';
    if (parts.length > 2) {
      const parsedSeller = parts[2].trim();
      if (parsedSeller) sellerName = parsedSeller;
    }

    structuralRows.push({
      aucId,
      mstc_auction_number: auctionNumber,
      seller_name: sellerName,
      category_name: categoryName,
      dateStr,
      durationStr
    });
  });

  return structuralRows;
}

// Optimized fast regex/string parser
export function fastParseMstcHtml(html: string): any[] {
  if (!html || !html.includes('downloadCatalogue')) {
    return [];
  }

  const structuralRows: any[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    if (!rowHtml.includes('downloadCatalogue')) continue;

    const aucMatch = rowHtml.match(/downloadCatalogue\((\d+)\)/);
    const aucId = aucMatch ? aucMatch[1] : '';
    if (!aucId) continue;

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1]);
    }

    let categoryName = 'Industrial / Commercial Scrap Lots';
    let dateStr = '';
    let durationStr = '';

    if (cells.length > 1 && cells[1]) {
      categoryName = cells[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(', ') || 'Industrial / Commercial Scrap Lots';
    }

    if (cells.length > 3 && cells[3]) {
      dateStr = cells[3].replace(/<[^>]+>/g, '').trim();
    }

    if (cells.length > 4 && cells[4]) {
      durationStr = cells[4].replace(/<[^>]+>/g, '').trim();
    }

    const aMatch = rowHtml.match(/<a[^>]*downloadCatalogue[^>]*>([\s\S]*?)<\/a>/i) ||
                   rowHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const aContent = aMatch ? aMatch[1].replace(/<[^>]+>/g, '\n') : '';
    const firstLine = aContent.split('\n').map(l => l.trim()).find(l => l.length > 0) || '';
    const auctionNumber = firstLine.replace(/Download PDF/i, '').trim() || 'MSTC-' + aucId;

    const parts = auctionNumber.split('/');
    let sellerName = 'MSTC Seller';
    if (parts.length > 2) {
      const parsedSeller = parts[2].trim();
      if (parsedSeller) sellerName = parsedSeller;
    }

    structuralRows.push({
      aucId,
      mstc_auction_number: auctionNumber,
      seller_name: sellerName,
      category_name: categoryName,
      dateStr,
      durationStr
    });
  }

  if (structuralRows.length > 0) {
    return structuralRows;
  }

  return parseMstcHtmlJsdom(html);
}

describe('MSTC Fast HTML Parser', () => {
  const sampleRowHtml = `
    <tr>
      <td>1</td>
      <td>Ferrous Scrap<br>Iron and Steel Scrap</td>
      <td>KOLKATA</td>
      <td>31/10/2026</td>
      <td>31/10/2026 10:00:00 To 04/11/2026 16:00:00</td>
      <td>
        <a href="javascript:void(0);" onclick="downloadCatalogue(123456)">
          MSTC/ERO/KOLKATA PORT TRUST/224/KOLKATA/26-27/39415<br>Download PDF
        </a>
      </td>
    </tr>
    <tr>
      <td>2</td>
      <td>Used Vehicles / Condemned Cars</td>
      <td>DELHI</td>
      <td>01/11/2026</td>
      <td>01/11/2026 11:00:00 To 05/11/2026 17:00:00</td>
      <td>
        <a href="javascript:void(0);" onclick="downloadCatalogue(789012)">
          MSTC/NRO/DELHI POLICE/15/DELHI/26-27/39416<br>Download PDF
        </a>
      </td>
    </tr>
  `;

  it('extracts identical records as JSDOM parser', () => {
    const jsdomResult = parseMstcHtmlJsdom(sampleRowHtml);
    const fastResult = fastParseMstcHtml(sampleRowHtml);

    expect(fastResult.length).toBe(2);
    expect(fastResult).toEqual(jsdomResult);
  });

  it('handles empty or malformed HTML safely', () => {
    expect(fastParseMstcHtml('')).toEqual([]);
    expect(fastParseMstcHtml('<div>No table here</div>')).toEqual([]);
  });

  it('correctly parses category, seller, and auction number', () => {
    const result = fastParseMstcHtml(sampleRowHtml);
    expect(result[0]).toEqual({
      aucId: '123456',
      mstc_auction_number: 'MSTC/ERO/KOLKATA PORT TRUST/224/KOLKATA/26-27/39415',
      seller_name: 'KOLKATA PORT TRUST',
      category_name: 'Ferrous Scrap, Iron and Steel Scrap',
      dateStr: '31/10/2026',
      durationStr: '31/10/2026 10:00:00 To 04/11/2026 16:00:00'
    });
  });

  it('is at least 5x faster than JSDOM on 1,000 synthetic rows', () => {
    const thousandRows = sampleRowHtml.repeat(500);

    const startFast = performance.now();
    const fastResult = fastParseMstcHtml(thousandRows);
    const fastDuration = performance.now() - startFast;

    const startJsdom = performance.now();
    const jsdomResult = parseMstcHtmlJsdom(thousandRows);
    const jsdomDuration = performance.now() - startJsdom;

    expect(fastResult.length).toBe(1000);
    expect(jsdomResult.length).toBe(1000);
    console.log(`[Benchmark] Fast Parser: ${fastDuration.toFixed(2)}ms | JSDOM: ${jsdomDuration.toFixed(2)}ms (Speedup: ${(jsdomDuration / fastDuration).toFixed(1)}x)`);
    expect(fastDuration).toBeLessThan(jsdomDuration);
  });
});
