const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

const startString = '  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MstcSanitizedAuction | null>(null);';
const endString = '  // Valuation states';

const startIdx = text.indexOf(startString);
const endIdx = text.indexOf(endString);

if (startIdx !== -1 && endIdx !== -1) {
  const toReplace = text.substring(startIdx, endIdx + endString.length);
  const replacement = `  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MstcSanitizedAuction | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');

  const [interestedMstcIds, setInterestedMstcIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setInterestedMstcIds(dashboardService.getInterestedAuctions(user.id));
    } else {
      setInterestedMstcIds([]);
    }
  }, [user]);

  const handleMstcInterestedToggle = (itemId: string) => {
    if (!user) return;
    dashboardService.toggleInterestedAuction(user.id, itemId);
    setInterestedMstcIds(dashboardService.getInterestedAuctions(user.id));
  };

  // Valuation states`;
  text = text.replace(toReplace, replacement);
  fs.writeFileSync('src/pages/Auctions.tsx', text);
  console.log('Replaced successfully!');
} else {
  console.log('Not found!');
}
