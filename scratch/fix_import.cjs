const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

// Remove unused MstcDetailsModal import
text = text.replace(
  /import \{ MstcDetailsModal \} from '\.\.\/components\/auction\/MstcDetailsModal';\r?\n/,
  ''
);

fs.writeFileSync('src/pages/Auctions.tsx', text);
console.log('Removed unused MstcDetailsModal import');
