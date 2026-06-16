const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

// Replace MstcCard usage
const oldCardRegex = /<MstcCard\r?\n\s*key=\{auction\.id\}\r?\n\s*item=\{auction\}\r?\n\s*isGrid=\{isGridView\}\r?\n\s*onPreview=\{setSelectedPreviewItem\}\r?\n\s*\/>/g;
const newCard = `<MstcCard
                        key={auction.id}
                        item={auction}
                        isGrid={isGridView}
                        onPreview={setSelectedPreviewItem}
                        isInterested={interestedMstcIds.includes(auction.id)}
                        onInterestedToggle={() => handleMstcInterestedToggle(auction.id)}
                      />`;

text = text.replace(oldCardRegex, newCard);

// Replace MstcDetailsModal usage
const oldModalRegex = /<MstcDetailsModal\r?\n\s*item=\{selectedPreviewItem\}\r?\n\s*onClose=\{\(\) => setSelectedPreviewItem\(null\)\}\r?\n\s*isInterested=\{false\}\r?\n\s*\/>/g;
const newModal = `<MstcDetailsModal
          item={selectedPreviewItem}
          onClose={() => setSelectedPreviewItem(null)}
          isInterested={interestedMstcIds.includes(selectedPreviewItem.id)}
          onInterestedToggle={() => handleMstcInterestedToggle(selectedPreviewItem.id)}
        />`;

text = text.replace(oldModalRegex, newModal);

fs.writeFileSync('src/pages/Auctions.tsx', text);
console.log('Props replaced successfully!');
