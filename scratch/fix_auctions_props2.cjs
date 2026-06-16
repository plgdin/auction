const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

const toReplace = `                      <MstcCard
                        key={item.id}
                        item={item}
                        isGrid={isGridView}
                        onPreview={setSelectedPreviewItem}
                      />`;

const replacement = `                      <MstcCard
                        key={item.id}
                        item={item}
                        isGrid={isGridView}
                        onPreview={setSelectedPreviewItem}
                        isInterested={interestedMstcIds.includes(item.id)}
                        onInterestedToggle={() => handleMstcInterestedToggle(item.id)}
                      />`;

text = text.replace(toReplace.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n'));
text = text.replace(toReplace, replacement); // Fallback for LF

fs.writeFileSync('src/pages/Auctions.tsx', text);
console.log('Replaced MstcCard props!');
