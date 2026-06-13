import * as fs from 'fs';

try {
  const html = fs.readFileSync('debug_page.html', 'utf-8');
  console.log(`Loaded debug_page.html. Size: ${html.length} characters.`);
  
  // Find all instances of 'downloadCatalogue' with context
  let index = 0;
  let matches = 0;
  while ((index = html.indexOf('downloadCatalogue', index)) !== -1) {
    matches++;
    const snippet = html.substring(Math.max(0, index - 100), Math.min(html.length, index + 150));
    console.log(`\nMatch ${matches} at position ${index}:`);
    console.log(snippet);
    index += 20; // move past this match
  }
} catch (err) {
  console.error(err);
}
