// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, Lock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';
import { auctionService } from '../../services/auctionService';
import { useAuthStore } from '../../store/authStore';
import type { Auction } from '../../types/database.types';

export function FeaturedAuctionsSection() {
  const { currency } = useAppStore();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    async function loadAuctions() {
      try {
        // Fetch active auctions
        const response = await auctionService.getAuctions({});
        if (response && Array.isArray(response.data)) {
          setAuctions(response.data.slice(0, 3));
        } else {
          setAuctions([]);
        }
      } catch (error) {
        console.error('Error loading recommended auctions:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuctions();
  }, []);

  return (
    <section className="py-20 bg-white relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12 border-b border-slate-200 pb-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Recommended Auctions</h2>
            <p className="mt-4 text-lg text-slate-650">
              Personalized asset recommendations tailored to your procurement preferences.
            </p>
          </div>
          {isAuthenticated && (
            <Link to="/auctions" className="hidden sm:flex items-center text-primary font-semibold hover:text-primary-700">
              View All Auctions <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : isAuthenticated && auctions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8">
            <h3 className="text-lg font-bold text-slate-900">No active auctions at the moment.</h3>
            <p className="mt-2 text-slate-600">Please check back later or subscribe to our notices.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Grid of Auctions */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 transition-all duration-300 ${!isAuthenticated ? 'filter blur-sm select-none pointer-events-none' : ''}`}>
              {/* If empty or not authenticated, we can show mock cards to look premium */}
              {(auctions.length > 0 ? auctions : [
                { id: '1', title: 'Industrial Heavy Machinery Lot', description: 'Surplus plant manufacturing machinery including CNC routers, lathes, and high capacity air compressors.', starting_price: 4500000, end_time: new Date().toISOString() },
                { id: '2', title: 'Corporate E-Waste Disposal', description: 'Over 500 decommissioned workstations, laptops, servers and networking switches from a Fortune 500 client.', starting_price: 250000, end_time: new Date().toISOString() },
                { id: '3', title: 'Commercial Real Estate Complex', description: 'Prime multi-story warehouse space with modern loading docks and convenient highway access.', starting_price: 85000000, end_time: new Date().toISOString() },
              ]).map((auction) => (
                <div key={auction.id} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                  <div className="h-48 bg-slate-100 relative flex items-center justify-center text-slate-400 font-medium text-sm">
                    Image Preview
                  </div>
                  <div className="p-6 flex-grow flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">{auction.title}</h3>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{auction.description || 'No description provided.'}</p>
                    
                    <div className="mt-auto space-y-3">
                      <div className="flex items-center text-slate-700 font-bold font-mono">
                        Start Price: &nbsp;{formatPrice(auction.starting_price, currency)}
                      </div>
                      <div className="flex items-center text-slate-700 text-sm">
                        <Clock className="w-5 h-5 mr-2 text-slate-400" />
                        Ends: {new Date(auction.end_time).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <Link
                      to={`/auctions/${auction.id}`}
                      className="mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-900 hover:bg-primary hover:shadow-md transition-all duration-200"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Auth Gate Overlay */}
            {!isAuthenticated && (
              <div className="absolute inset-0 flex items-center justify-center z-10 px-4 bg-white/30 backdrop-blur-xs rounded-2xl">
                <div className="max-w-md w-full bg-slate-900 text-white p-8 rounded-3xl shadow-2xl text-center border border-slate-800 relative overflow-hidden">
                  {/* Decorative Glowing Circle */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="w-16 h-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-8 h-8" />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-3">Unlock Recommended Auctions</h3>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    Join our secure procurement platform to receive personalized asset recommendations, submit bids, and track your watchlists.
                  </p>
                  
                  <div className="flex flex-col gap-4">
                    <Link
                      to="/auth/login"
                      className="w-full py-3 px-6 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-md transition-all duration-200 text-center"
                    >
                      Sign In Now
                    </Link>
                    <div className="text-sm text-slate-400">
                      New to the platform?{' '}
                      <Link to="/auth/register" className="text-primary-400 hover:text-primary-300 font-semibold underline">
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
    </section>
  );
}
