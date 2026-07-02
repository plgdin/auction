// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import type { Auction } from '../../types/database.types';
import { lazy, Suspense } from 'react';

// Lazy-load card components to keep them out of the initial chunk
const MstcCard = lazy(() => import('../auction/MstcCard').then(m => ({ default: m.MstcCard })));
const AuctionCard = lazy(() => import('../auction/AuctionCard').then(m => ({ default: m.AuctionCard })));

const MstcDetailsModal = lazy(() => import('../auction/MstcDetailsModal').then(module => ({ default: module.MstcDetailsModal })));

export function FeaturedAuctionsSection() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, user } = useAuthStore();
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<any | null>(null);
  const { interestedMstcIds, toggleInterestedMstcId } = useAppStore();

  const handleMstcInterestedToggle = async (itemId: string) => {
    if (!user) return;
    toggleInterestedMstcId(user.id, itemId);
  };

  useEffect(() => {
    async function loadAuctions() {
      try {
        let recs = [];
        if (isAuthenticated && user) {
          const { recommendationService } = await import('../../services/recommendationService');
          recs = await recommendationService.getRecommendedAuctions(user.id, 4);
        }
        if (recs.length === 0) {
          const { auctionService } = await import('../../services/auctionService');
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[420px] animate-pulse shadow-sm p-4">
                <div className="h-40 bg-slate-100 rounded-xl mb-4 shrink-0" />
                <div className="flex-grow flex flex-col space-y-3">
                  <div className="h-3 bg-slate-200 rounded w-1/4" />
                  <div className="space-y-2 flex-grow">
                    <div className="h-5 bg-slate-200 rounded w-3/4" />
                    <div className="h-5 bg-slate-200 rounded w-1/2" />
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-end mt-auto">
                    <div className="space-y-1.5 w-1/2">
                      <div className="h-2.5 bg-slate-200 rounded w-16" />
                      <div className="h-5 bg-slate-200 rounded w-24" />
                    </div>
                    <div className="h-8 bg-slate-200 rounded w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isAuthenticated && auctions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8">
            <h3 className="text-lg font-bold text-slate-900">No active auctions at the moment.</h3>
            <p className="mt-2 text-slate-600">Please check back later or subscribe to our notices.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Grid of Auctions */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-300 min-h-[400px] ${!isAuthenticated ? 'filter blur-sm select-none pointer-events-none' : ''}`}>
              <Suspense fallback={null}>
              {/* If empty or not authenticated, we can show mock cards to look premium */}
              {(auctions.length > 0 ? auctions : [
                { id: '11111111-1111-1111-1111-111111111111', title: 'Industrial Heavy Machinery Lot', description: 'Surplus plant manufacturing machinery including CNC routers, lathes, and high capacity air compressors.', starting_price: 4500000, end_time: new Date().toISOString() },
                { id: '22222222-2222-2222-2222-222222222222', title: 'Corporate E-Waste Disposal', description: 'Over 500 decommissioned workstations, laptops, servers and networking switches from a Fortune 500 client.', starting_price: 250000, end_time: new Date().toISOString() },
                { id: '33333333-3333-3333-3333-333333333333', title: 'Commercial Real Estate Complex', description: 'Prime multi-story warehouse space with modern loading docks and convenient highway access.', starting_price: 85000000, end_time: new Date().toISOString() },
                { id: '44444444-4444-4444-4444-444444444444', title: 'Fleet Transport Logistics Package', description: 'Package of 12 commercial logistics vans, light duty trucks, and utility vehicles in excellent running condition.', starting_price: 1800000, end_time: new Date().toISOString() }
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
              </Suspense>
            </div>

            {/* Auth Gate Overlay */}
            {!isAuthenticated && (
              <div className="absolute inset-0 flex items-center justify-center z-10 px-4 bg-white/70 rounded-2xl">
                <div className="max-w-md w-full bg-slate-900 text-white p-8 rounded-3xl shadow-2xl text-center border border-slate-800 relative overflow-hidden">
                  {/* Decorative Glowing Circle - Replaced heavy blur-2xl with a fast radial-gradient */}
                  <div className="absolute -top-20 -right-20 w-48 h-48 bg-[radial-gradient(circle_at_center,_rgba(30,41,59,0.8)_0%,_rgba(15,23,42,0)_70%)] pointer-events-none" />
                  
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
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-xs">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        }>
          <MstcDetailsModal
            item={selectedPreviewItem}
            onClose={() => setSelectedPreviewItem(null)}
            isInterested={interestedMstcIds.includes(selectedPreviewItem.id)}
            onInterestedToggle={() => handleMstcInterestedToggle(selectedPreviewItem.id)}
          />
        </Suspense>
      )}
    </section>
  );
}
