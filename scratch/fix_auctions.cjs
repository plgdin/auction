const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

// 1. Add import
text = text.replace('import { AuctionFilters } from \'../components/auction/AuctionFilters\';', 'import { AuctionFilters } from \'../components/auction/AuctionFilters\';\nimport { MstcDetailsModal } from \'../components/auction/MstcDetailsModal\';');

// 2. Remove lightbox state
text = text.replace('  const [lightboxImage, setLightboxImage] = useState<string | null>(null);\r\n', '');
text = text.replace('  const [lightboxImage, setLightboxImage] = useState<string | null>(null);\n', '');

// 3. Remove useEffect
text = text.replace(/  useEffect\(\(\) => \{\r?\n\s*const handleKeyDownEsc = \(e: KeyboardEvent\) => \{\r?\n\s*if \(e\.key === 'Escape'\) \{\r?\n\s*setLightboxImage\(null\);\r?\n\s*\}\r?\n\s*\};\r?\n\s*if \(lightboxImage\) \{\r?\n\s*window\.addEventListener\('keydown', handleKeyDownEsc\);\r?\n\s*\}\r?\n\s*return \(\) => \{\r?\n\s*window\.removeEventListener\('keydown', handleKeyDownEsc\);\r?\n\s*\};\r?\n\s*\}, \[lightboxImage\]\);\r?\n/g, '');

// 4. Replace the huge modal section
const modalStartRegex = /      \{\/\* Catalog Details Modal \*\/\}(.|\r|\n)*?\r?\n\}/g;
const replacement = `      {/* Catalog Details Modal */}
      {selectedPreviewItem && (
        <MstcDetailsModal
          item={selectedPreviewItem}
          onClose={() => setSelectedPreviewItem(null)}
          isInterested={false}
        />
      )}
    </div>
  );
}`;
text = text.replace(modalStartRegex, replacement);

fs.writeFileSync('src/pages/Auctions.tsx', text);
console.log("Done");
