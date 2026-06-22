// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { Auction } from '../../types/database.types';
import { recommendationService } from '../../services/recommendationService';
import { auctionService } from '../../services/auctionService';
import { dashboardService } from '../../services/dashboardService';
import { MstcCard } from '../auction/MstcCard';
import { AuctionCard } from '../auction/AuctionCard';
import { MstcDetailsModal } from '../auction/MstcDetailsModal';

export function FeaturedAuctionsSection() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, user } = useAuthStore();
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<any | null>(null);
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

  useEffect(() => {
    async function loadAuctions() {
      try {
        let recs = [];
        if (isAuthenticated && user) {
          recs = await recommendationService.getRecommendedAuctions(user.id, 4);
        }
        if (recs.length === 0) {
          const response = await auctionService.getAuctions({});
          if (response && Array.isArray(response.data)) {
            recs = response.data.slice(0, 4);
          }
        }
        setAuctions(recs);
      } catch (error) {
        console.error('Error loading recommended auctions:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuctions();
  }, [isAuthenticated, user]);

  return (
    <section className="py-20 bg-white relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12 border-b border-slate-200 pb-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Recommended Auctions</h2>
            <p className="mt-4 text-lg text-slate-655">
              Personalized asset recommendations tailored to your procurement preferences.
            </p>
          </div>
          {isAuthenticated && (
            <Link to="/auctions" className="hidden sm:flex items-center text-slate-900 font-semibold hover:text-black">
              View All Auctions <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
          </div>
        ) : isAuthenticated && auctions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8">
            <h3 className="text-lg font-bold text-slate-900">No active auctions at the moment.</h3>
            <p className="mt-2 text-slate-600">Please check back later or subscribe to our notices.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Grid of Auctions */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-300 ${!isAuthenticated ? 'filter blur-sm select-none pointer-events-none' : ''}`}>
              {/* If empty or not authenticated, we can show mock cards to look premium */}
              {(auctions.length > 0 ? auctions : [
                { id: '1', title: 'Industrial Heavy Machinery Lot', description: 'Surplus plant manufacturing machinery including CNC routers, lathes, and high capacity air compressors.', starting_price: 4500000, end_time: new Date().toISOString() },
                { id: '2', title: 'Corporate E-Waste Disposal', description: 'Over 500 decommissioned workstations, laptops, servers and networking switches from a Fortune 500 client.', starting_price: 250000, end_time: new Date().toISOString() },
                { id: '3', title: 'Commercial Real Estate Complex', description: 'Prime multi-story warehouse space with modern loading docks and convenient highway access.', starting_price: 85000000, end_time: new Date().toISOString() },
                { id: '4', title: 'Fleet Transport Logistics Package', description: 'Package of 12 commercial logistics vans, light duty trucks, and utility vehicles in excellent running condition.', starting_price: 1800000, end_time: new Date().toISOString() }
              ]).map((auction) => {
                if (auction.is_mstc) {
                  return (
                    <MstcCard
                      key={auction.id}
                      item={auction as any}
                      isGrid={true}
                      onPreview={(item) => setSelectedPreviewItem(item)}
                      isInterested={interestedMstcIds.includes(auction.id)}
                      onInterestedToggle={() => handleMstcInterestedToggle(auction.id)}
                    />
                  );
                } else {
                  return (
                    <AuctionCard
                      key={auction.id}
                      auction={auction}
                      isGrid={true}
                    />
                  );
                }
              })}
            </div>

            {/* Auth Gate Overlay */}
            {!isAuthenticated && (
              <div className="absolute inset-0 flex items-center justify-center z-10 px-4 bg-white/30 backdrop-blur-xs rounded-2xl">
                <div className="max-w-md w-full bg-slate-900 text-white p-8 rounded-3xl shadow-2xl text-center border border-slate-800 relative overflow-hidden">
                  {/* Decorative Glowing Circle */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-slate-850 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="w-16 h-16 bg-slate-800 text-white rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-8 h-8" />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-3">Unlock Recommended Auctions</h3>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    Join our secure procurement platform to receive personalized asset recommendations, submit bids, and track your watchlists.
                  </p>
                  
                  <div className="flex flex-col gap-4">
                    <Link
                      to="/auth/login"
                      className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-md transition-all duration-200 text-center"
                    >
                      Sign In Now
                    </Link>
                    <div className="text-sm text-slate-400">
                      New to the platform?{' '}
                      <Link to="/auth/register" className="text-slate-300 hover:text-white font-semibold underline">
                        Create an account
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPreviewItem && (
        <MstcDetailsModal
          item={selectedPreviewItem}
          onClose={() => setSelectedPreviewItem(null)}
          isInterested={interestedMstcIds.includes(selectedPreviewItem.id)}
          onInterestedToggle={() => handleMstcInterestedToggle(selectedPreviewItem.id)}
        />
      )}
    </section>
  );
}
