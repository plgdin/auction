import * as fs from 'fs';

try {
  const html = fs.readFileSync('debug_page.html', 'utf-8');
  const index = html.indexOf('id="pdffrm"');
  if (index !== -1) {
    const snippet = html.substring(Math.max(0, index - 200), Math.min(html.length, index + 300));
    console.log('Found pdffrm form tag:');
    console.log(snippet);
  } else {
    console.log('pdffrm not found by ID. Checking form tags:');
    const matches = html.match(/<form[^>]*>/gi) || [];
    matches.forEach((form, i) => console.log(`${i+1}: ${form}`));
  }
} catch (e) {
  console.error(e);
}
