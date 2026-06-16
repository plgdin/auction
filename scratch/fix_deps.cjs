const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

// Fix the commercial loadData dependency array - these are singular strings, not arrays
text = text.replace(
  "    regionalOffices.join(','),\n    locations.join(','),",
  "    regionalOffice,\n    location,"
);
text = text.replace(
  "    regionalOffices.join(','),\r\n    locations.join(','),",
  "    regionalOffice,\r\n    location,"
);

fs.writeFileSync('src/pages/Auctions.tsx', text);
console.log('Fixed commercial loadData deps');
