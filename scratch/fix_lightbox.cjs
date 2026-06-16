const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

// Add lightboxImage state after previewTab state
text = text.replace(
  "const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');",
  "const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');\n  const [lightboxImage, setLightboxImage] = useState<string | null>(null);"
);

fs.writeFileSync('src/pages/Auctions.tsx', text);
console.log('Added lightboxImage state');
