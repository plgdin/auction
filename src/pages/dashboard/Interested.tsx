// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { MstcCard } from '../../components/auction/MstcCard';
import { MstcDetailsModal } from '../../components/auction/MstcDetailsModal';
import { MstcSearchService } from '../../services/publicService';
import { dashboardService } from '../../services/dashboardService';
import type { MstcSanitizedAuction } from '../../services/publicService';

export function Interested() {
  const { user } = useAuthStore();
  const [mstcWatchlist, setMstcWatchlist] = useState<MstcSanitizedAuction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Government Preview Modal
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MstcSanitizedAuction | null>(null);

  const loadMstcWatchlist = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const ids = dashboardService.getInterestedAuctions(user.id);
      if (ids.length > 0) {
        const items = await Promise.all(
          ids.map(id => MstcSearchService.getMstcAuctionById(id))
        );
        setMstcWatchlist(items.filter((item): item is MstcSanitizedAuction => item !== null));
      } else {
        setMstcWatchlist([]);
      }
    } catch (error) {
      console.error('Failed to load MSTC watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMstcWatchlist();
  }, [user]);

  const handleMstcInterestedToggle = (itemId: string) => {
    if (!user) return;
    dashboardService.toggleInterestedAuction(user.id, itemId);
    // Reload MSTC list
    loadMstcWatchlist();
    // If preview modal is open for this item, close it
    if (selectedPreviewItem?.id === itemId) {
      setSelectedPreviewItem(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Heart className="w-6 h-6 mr-3 text-red-500 fill-red-500" />
            Interested Auctions
          </h1>
          <p className="text-slate-500 mt-1">Auctions and government catalogs you are monitoring.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : mstcWatchlist.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 shadow-sm">
          <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Your interested government catalogs list is empty</h3>
          <p className="text-slate-500 mt-1 mb-6">Click the heart icon on any government catalog to save it here for later.</p>
          <Link to="/auctions?tab=mstc" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/95 transition-colors">
            Browse Government Catalogs
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mstcWatchlist.map((item) => (
            <MstcCard
              key={item.id}
              item={item}
              isGrid={true}
              onPreview={setSelectedPreviewItem}
              isInterested={true}
              onInterestedToggle={() => handleMstcInterestedToggle(item.id)}
            />
          ))}
        </div>
      )}

      {/* Catalog Details Modal */}
      {selectedPreviewItem && (
        <MstcDetailsModal
          item={selectedPreviewItem}
          onClose={() => setSelectedPreviewItem(null)}
          isInterested={true}
          onInterestedToggle={() => handleMstcInterestedToggle(selectedPreviewItem.id)}
        />
      )}
    </div>
  );
}
