import * as fs from 'fs';

try {
  const html = fs.readFileSync('debug_page.html', 'utf-8');
  console.log(`Loaded debug_page.html. Size: ${html.length} characters.`);
  
  // Find all links containing 'download' or '.jsp'
  const regex = /<a[^>]*href=[^>]*>[^<]*<\/a>/gi;
  const matches = html.match(regex) || [];
  console.log(`Found ${matches.length} total anchor tags.`);
  
  const downloadLinks = matches.filter(tag => tag.toLowerCase().includes('download') || tag.toLowerCase().includes('jsp'));
  console.log(`Found ${downloadLinks.length} download/JSP anchor tags:`);
  downloadLinks.slice(0, 30).forEach((tag, i) => console.log(`${i + 1}: ${tag}`));
} catch (err) {
  console.error('Error reading debug_page.html:', err.message);
}
