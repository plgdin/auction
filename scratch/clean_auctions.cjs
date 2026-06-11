const fs = require('fs');

let content = fs.readFileSync('src/pages/Auctions.tsx', 'utf8');

// Normalize line endings to LF for easier processing, then convert back to CRLF if needed
const hasCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Remove the first duplicate syntax block
const toRemove1 = `              />
              {/* Overlay for mobile filters */}
              {isFiltersOpen && (
                <div 
                  className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
                  onClick={() => setIsFiltersOpen(false)}
                />
              )}
            </div>
          )}`;

if (content.includes(toRemove1)) {
  content = content.replace(toRemove1, '');
  console.log('Removed duplicate syntax block 1');
} else {
  console.error('Error: duplicate syntax block 1 not found');
}

// 2. Remove duplicate toolbar comments
content = content.replace('            {/* Toolbar */}\n            {/* Toolbar */}', '            {/* Toolbar */}');

// 3. Find the second ") : (" and remove the duplicated MSTC card block.
const parts = content.split(') : (');
if (parts.length === 3) {
  // parts[0] is the content before first ") : ("
  // parts[1] is the first MSTC card content
  // parts[2] is the second MSTC card content + the rest of the file
  
  // We want to extract the rest of the file from parts[2].
  // The second MSTC card ends at the first "            )}" in parts[2].
  const closeMarker = '            )}';
  const closeIdx = parts[2].indexOf(closeMarker);
  if (closeIdx !== -1) {
    const restOfFile = parts[2].substring(closeIdx + closeMarker.length);
    content = parts[0] + ') : (' + parts[1] + restOfFile;
    console.log('Removed duplicate MSTC card block 2');
  } else {
    console.error('Error: closing )} marker not found in duplicate block');
  }
} else {
  console.error('Error: expected exactly 2 occurrences of ") : (", found:', parts.length - 1);
}

if (hasCrlf) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync('src/pages/Auctions.tsx', content, 'utf8');
console.log('Cleanup completed successfully.');
