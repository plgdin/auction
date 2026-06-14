// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Search, Gavel, IndianRupee, MapPin, Tag } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { auctionService } from '../../services/auctionService';
import { AuctionCard } from '../../components/auction/AuctionCard';
import type { Auction } from '../../types/database.types';
import { supabase } from '../../lib/supabase';

export function Interested() {
  const { user } = useAuthStore();
  const [watchlist, setWatchlist] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [biddingAuction, setBiddingAuction] = useState<Auction | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [currentMaxBid, setCurrentMaxBid] = useState(0);

  const loadWatchlist = async () => {
    if (!user) return;
    setIsLoading(true);
    
    const wIds = await auctionService.getUserWatchlistIds(user.id);
    
    if (wIds.length > 0) {
      const auctionsData = await Promise.all(
        wIds.map(id => auctionService.getAuctionById(id))
      );
      setWatchlist(auctionsData.filter((a): a is Auction => a !== null));
    } else {
      setWatchlist([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadWatchlist();
  }, [user]);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !biddingAuction) return;

    const amount = Number(bidAmount);
    if (!amount || isNaN(amount)) {
      setBidError('Please enter a valid amount.');
      return;
    }

    const minBid = currentMaxBid > 0 ? currentMaxBid + biddingAuction.bid_increment : biddingAuction.starting_price;
    if (amount < minBid) {
      setBidError(`Bid must be at least ₹${minBid.toLocaleString()}`);
      return;
    }

    setIsSubmittingBid(true);
    setBidError('');
    try {
      const res = await auctionService.placeBid(biddingAuction.id, user.id, amount);
      if (res.success) {
        setBidSuccess(`Success! Placed a bid of ₹${amount.toLocaleString()}. This is now an active bid.`);
        // Refresh watchlist
        setTimeout(() => {
          setBiddingAuction(null);
          setBidAmount('');
          setBidSuccess('');
          loadWatchlist();
        }, 2000);
      } else {
        setBidError(res.message || 'Failed to place bid.');
      }
    } catch (err: any) {
      setBidError(err.message || 'Error occurred while placing bid.');
    } finally {
      setIsSubmittingBid(false);
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
          <p className="text-slate-500 mt-1">Auctions you are monitoring. You can place a bid to make them active.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : watchlist.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 shadow-sm">
          <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Your interested auctions list is empty</h3>
          <p className="text-slate-500 mt-1 mb-6">Click the heart icon on any auction to save it here for later.</p>
          <Link to="/auctions" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-700 transition-colors">
            Browse Auctions
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchlist.map((auction) => (
            <div key={auction.id} className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
              <div className="flex-grow">
                <AuctionCard 
                  auction={auction} 
                  isGrid={true}
                  isWatchlistedInitial={true}
                />
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0">
                <button
                  onClick={async () => {
                    setBiddingAuction(auction);
                    setCurrentMaxBid(0);
                    try {
                      const { data } = await supabase
                        .from('bids')
                        .select('amount')
                        .eq('auction_id', auction.id)
                        .order('amount', { ascending: false })
                        .limit(1);
                      if (data && data.length > 0) {
                        setCurrentMaxBid(data[0].amount);
                      }
                    } catch (err) {}
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/95 shadow transition-colors"
                >
                  <Gavel className="w-4 h-4" />
                  Make Active Bid
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Place Bid Modal */}
      {biddingAuction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-slide-up">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-slate-900">Make Active Bid</h3>
                <button 
                  onClick={() => { setBiddingAuction(null); setBidError(''); setBidAmount(''); }}
                  className="text-slate-400 hover:text-slate-650 font-bold text-lg"
                >
                  &times;
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Place a bid on <span className="font-semibold">{biddingAuction.title}</span>.
              </p>
            </div>

            <form onSubmit={handlePlaceBid} className="p-6 space-y-4">
              {bidError && (
                <div className="p-3 bg-red-50 text-red-750 text-sm font-medium rounded-lg border border-red-200">
                  {bidError}
                </div>
              )}
              {bidSuccess && (
                <div className="p-3 bg-green-50 text-green-750 text-sm font-semibold rounded-lg border border-green-200 animate-pulse">
                  {bidSuccess}
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Current Highest Bid:</span>
                  <span className="font-semibold text-slate-700">
                    {currentMaxBid > 0 ? `₹${currentMaxBid.toLocaleString()}` : 'No bids yet'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Min Bid Required:</span>
                  <span className="font-semibold text-slate-700">
                    ₹{(currentMaxBid > 0 ? currentMaxBid + biddingAuction.bid_increment : biddingAuction.starting_price).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Your Bid Amount (₹)
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IndianRupee className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    required
                    min={currentMaxBid > 0 ? currentMaxBid + biddingAuction.bid_increment : biddingAuction.starting_price}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 font-bold"
                    placeholder="Enter bid amount"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setBiddingAuction(null); setBidError(''); setBidAmount(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBid || !!bidSuccess}
                  className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {isSubmittingBid ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Submit Bid'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
