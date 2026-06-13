import * as fs from 'fs';

try {
  const html = fs.readFileSync('debug_page.html', 'utf-8');
  
  // Let's find rows with onclick="downloadCatalogue" and see all anchor tags in that table row context
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const trs = html.match(trRegex) || [];
  
  console.log(`Found ${trs.length} total table rows.`);
  let matches = 0;
  for (const tr of trs) {
    if (tr.includes('downloadCatalogue')) {
      matches++;
      console.log(`\n--- Row Match ${matches} ---`);
      // Find all anchors in this row
      const aRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi;
      const anchors = tr.match(aRegex) || [];
      anchors.forEach((a, idx) => {
        console.log(`  Anchor ${idx + 1}: ${a}`);
      });
      if (matches >= 3) break;
    }
  }
} catch (e) {
  console.error(e);
}
