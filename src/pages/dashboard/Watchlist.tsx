// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { auctionService } from '../../services/auctionService';
import { AuctionCard } from '../../components/auction/AuctionCard';
import type { Auction } from '../../types/database.types';

export function Watchlist() {
  const { user } = useAuthStore();
  const [watchlist, setWatchlist] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadWatchlist() {
      if (!user) return;
      setIsLoading(true);
      
      const wIds = await auctionService.getUserWatchlistIds(user.id);
      
      if (wIds.length > 0) {
        // We can cheat here and fetch auctions that match these IDs using a filter if we modify the service
        // Since we didn't add an IN filter to getAuctions, we'll fetch all active and filter, or fetch individually.
        // For production, auctionService.getAuctions should accept an array of IDs.
        // Let's just fetch all active for now and filter locally (assuming a small dataset) or we fetch them one by one.
        // Let's fetch one by one for exactness.
        
        const auctionsData = await Promise.all(
          wIds.map(id => auctionService.getAuctionById(id))
        );
        
        setWatchlist(auctionsData.filter((a): a is Auction => a !== null));
      }
      
      setIsLoading(false);
    }
    loadWatchlist();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Heart className="w-6 h-6 mr-3 text-red-500 fill-red-500" />
            My Watchlist
          </h1>
          <p className="text-slate-500 mt-1">Auctions you are monitoring for potential bidding.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : watchlist.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 shadow-sm">
          <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Your watchlist is empty</h3>
          <p className="text-slate-500 mt-1 mb-6">Click the heart icon on any auction to save it here for later.</p>
          <Link to="/auctions" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-700 transition-colors">
            Browse Auctions
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchlist.map((auction) => (
            <AuctionCard 
              key={auction.id} 
              auction={auction} 
              isGrid={true}
              isWatchlistedInitial={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
