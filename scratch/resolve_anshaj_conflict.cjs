const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Auctions.tsx');
let text = fs.readFileSync(filePath, 'utf-8');

// The strategy:
// We want to KEEP the code from HEAD (the inline generateCatalogSummary and helpers).
// We want to EXTRACT AuctionCardSkeleton and SkeletonGrid from the incoming branch and append them after the HEAD code.

const headMatch = text.match(/<<<<<<< HEAD\r?\n([\s\S]*?)=======/);
const anshajMatch = text.match(/=======\r?\n([\s\S]*?)>>>>>>> origin\/anshaj\/ui/);

if (headMatch && anshajMatch) {
  const headCode = headMatch[1];
  const anshajCode = anshajMatch[1];

  // Extract the skeleton functions from anshajCode
  const skeletonRegex = /(function AuctionCardSkeleton[\s\S]*?function SkeletonGrid[\s\S]*?\}\r?\n)/;
  const skeletonMatch = anshajCode.match(skeletonRegex);

  if (skeletonMatch) {
    const skeletonsCode = skeletonMatch[1];
    
    // Replace the entire conflict block with headCode + skeletonsCode
    const fullConflictRegex = /<<<<<<< HEAD\r?\n[\s\S]*?>>>>>>> origin\/anshaj\/ui/;
    text = text.replace(fullConflictRegex, headCode + '\n' + skeletonsCode);
    
    fs.writeFileSync(filePath, text);
    console.log('Conflict resolved successfully.');
  } else {
    console.log('Error: Could not find Skeleton code in anshaj/ui section.');
  }
} else {
  console.log('Error: Could not find conflict markers.');
}
