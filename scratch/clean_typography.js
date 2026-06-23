import fs from 'fs';
import path from 'path';

const files = [
  path.resolve('src/components/auction/MstcDetailsModal.tsx'),
  path.resolve('src/components/auction/MstcDetailsModal.ui.tsx')
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace all font-mono classes
    content = content.replace(/\bfont-mono\b/g, '');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Cleaned font-mono from ${file}`);
  } else {
    console.warn(`File not found: ${file}`);
  }
}
