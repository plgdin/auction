const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

// 1. Add dashboardService import
text = text.replace(
  "import { useAuthStore } from '../store/authStore';",
  "import { useAuthStore } from '../store/authStore';\nimport { dashboardService } from '../services/dashboardService';"
);

// 2. Add state and handlers
const stateToAdd = `  const [mstcAuctions, setMstcAuctions] = useState<MstcSanitizedAuction[]>([]);
  const [interestedMstcIds, setInterestedMstcIds] = useState<string[]>([]);
`;

const handlersToAdd = `  useEffect(() => {
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

  const checkUserStatus = useCallback(async () => {`;

text = text.replace(
  "  const [mstcAuctions, setMstcAuctions] = useState<MstcSanitizedAuction[]>([]);\n",
  stateToAdd
);

text = text.replace(
  "  const checkUserStatus = useCallback(async () => {",
  handlersToAdd
);

// 3. Update MstcCard props
const oldCard = `<MstcCard
                        key={item.id}
                        item={item}
                        isGrid={isGridView}
                        onPreview={setSelectedPreviewItem}
                      />`;
const newCard = `<MstcCard
                        key={item.id}
                        item={item}
                        isGrid={isGridView}
                        onPreview={setSelectedPreviewItem}
                        isInterested={interestedMstcIds.includes(item.id)}
                        onInterestedToggle={() => handleMstcInterestedToggle(item.id)}
                      />`;
text = text.replace(oldCard, newCard);

// 4. Update MstcDetailsModal props
const oldModal = `<MstcDetailsModal
          item={selectedPreviewItem}
          onClose={() => setSelectedPreviewItem(null)}
          isInterested={false}
        />`;
const newModal = `<MstcDetailsModal
          item={selectedPreviewItem}
          onClose={() => setSelectedPreviewItem(null)}
          isInterested={interestedMstcIds.includes(selectedPreviewItem.id)}
          onInterestedToggle={() => handleMstcInterestedToggle(selectedPreviewItem.id)}
        />`;
text = text.replace(oldModal, newModal);

fs.writeFileSync('src/pages/Auctions.tsx', text);
console.log("Auctions.tsx updated with Interested state successfully.");
