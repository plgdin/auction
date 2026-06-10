// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, IndianRupee, ArrowRight } from 'lucide-react';
import { auctionService } from '../../services/auctionService';
import type { Auction } from '../../types/database.types';

export function FeaturedAuctionsSection() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAuctions() {
      // Fetch active auctions, limit to 3 for featured section
      const data = await auctionService.getAuctions({ status: 'active' });
      setAuctions(data.slice(0, 3));
      setIsLoading(false);
    }
    loadAuctions();
  }, []);

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12 border-b border-slate-200 pb-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Featured Live Auctions</h2>
            <p className="mt-4 text-lg text-slate-600">
              Participate in real-time forward auctions from premium verified sellers.
            </p>
          </div>
          <Link to="/auctions" className="hidden sm:flex items-center text-primary font-semibold hover:text-primary-700">
            View All Auctions <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <h3 className="text-lg font-medium text-slate-900">No active auctions at the moment.</h3>
            <p className="mt-2 text-slate-500">Please check back later or subscribe to our notices.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {auctions.map((auction) => (
              <div key={auction.id} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow flex flex-col">
                <div className="h-48 bg-slate-200 relative">
                  {/* Placeholder for Auction Image */}
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    Image Preview
                  </div>
                  <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-sm">
                    Live
                  </div>
                </div>
                <div className="p-6 flex-grow flex flex-col">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">{auction.title}</h3>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-2">{auction.description || 'No description provided.'}</p>
                  
                  <div className="mt-auto space-y-3">
                    <div className="flex items-center text-slate-700 font-medium">
                      <IndianRupee className="w-5 h-5 mr-2 text-slate-400" />
                      Start Price: {auction.starting_price.toLocaleString()}
                    </div>
                    <div className="flex items-center text-slate-700 text-sm">
                      <Clock className="w-5 h-5 mr-2 text-slate-400" />
                      Ends: {new Date(auction.end_time).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <Link 
                    to={`/auctions/${auction.id}`}
                    className="mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-900 hover:bg-primary transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8 sm:hidden flex justify-center">
          <Link to="/auctions" className="inline-flex items-center px-6 py-3 border border-slate-300 shadow-sm text-base font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50">
            View All Auctions
          </Link>
        </div>
      </div>
    </section>
  );
}
