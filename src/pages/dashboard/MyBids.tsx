// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, ArrowRight, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { auctionService } from '../../services/auctionService';
import type { Auction } from '../../types/database.types';
import clsx from 'clsx';

type TabType = 'active' | 'previous';

function BidItemSkeleton() {
  return (
    <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6 animate-pulse">
      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="h-4 bg-slate-200 rounded w-12" />
          <div className="h-3.5 bg-slate-200 rounded w-24" />
        </div>
        <div className="h-5 bg-slate-250 rounded w-1/2" />
        <div className="h-3.5 bg-slate-200 rounded w-32" />
      </div>
      <div className="w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3">
        <div className="space-y-1.5 text-right">
          <div className="h-2.5 bg-slate-200 rounded w-20" />
          <div className="h-6 bg-slate-200 rounded w-28" />
        </div>
        <div className="h-9 bg-slate-200 rounded w-28" />
      </div>
    </div>
  );
}

export function MyBids() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [bids, setBids] = useState<any[]>([]); // Includes bid info + auction
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setIsLoading(true);
      
      const userBids = await auctionService.getUserBids(user.id);
      setBids(userBids);
      setIsLoading(false);
    }
    loadData();
  }, [user]);

  const getActiveBids = () => bids.filter(b => b.auction.status === 'active');
  const getPreviousBids = () => bids.filter(b => b.auction.status === 'closed' || b.auction.status === 'cancelled');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Bids</h1>
          <p className="text-slate-500">Track and manage your active and past bidding history.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          {(['active', 'previous'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                "px-6 py-4 text-sm font-semibold capitalize transition-colors border-b-2",
                activeTab === tab
                  ? "border-primary text-primary bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              {tab === 'active' ? 'Ongoing Bids' : 'Previous Bids'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-0">
          {isLoading ? (
            <div className="divide-y divide-slate-100">
              {[...Array(3)].map((_, i) => (
                <BidItemSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* ONGOING BIDS */}
              {activeTab === 'active' && (
                getActiveBids().length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <Gavel className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">No active bids</h3>
                    <p className="text-slate-500 mt-1 mb-6">You haven't placed any bids on auctions yet.</p>
                    <Link to="/auctions" className="inline-flex items-center text-primary font-medium hover:underline">
                      Explore auctions <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                ) : (
                  getActiveBids().map((bid) => (
                    <div key={bid.id} className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded uppercase tracking-wide">Live</span>
                          <span className="text-xs text-slate-500 font-medium">REF: {bid.auction.reference_number}</span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-2">{bid.auction.title}</h4>
                        <div className="flex items-center text-sm text-slate-500">
                          <Clock className="w-4 h-4 mr-1.5" />
                          Ends {new Date(bid.auction.end_time).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="w-full sm:w-auto bg-slate-50 sm:bg-transparent p-4 sm:p-0 rounded-lg sm:rounded-none flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end sm:text-right border sm:border-none border-slate-200">
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold mb-1">Your Highest Bid</p>
                          <p className="text-xl font-bold text-primary">₹{bid.amount.toLocaleString()}</p>
                        </div>
                        <Link 
                          to={`/auctions/${bid.auction.id}`}
                          className="sm:mt-3 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-primary transition-colors"
                        >
                          View Auction
                        </Link>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* PREVIOUS BIDS */}
              {activeTab === 'previous' && (
                getPreviousBids().length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <XCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">No previous bids</h3>
                    <p className="text-slate-500 mt-1">Your past bidding history will appear here.</p>
                  </div>
                ) : (
                  getPreviousBids().map((bid) => {
                    const isWon = bid.auction.winner_id === user?.id;
                    return (
                      <div key={bid.id} className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={clsx(
                              "px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wide",
                              isWon ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-650"
                            )}>
                              {isWon ? 'Won' : 'Ended'}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">REF: {bid.auction.reference_number}</span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 mb-2">{bid.auction.title}</h4>
                          <div className="flex items-center text-sm text-slate-500">
                            Closed {new Date(bid.auction.end_time).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="w-full sm:w-auto text-right">
                           <p className="text-xs text-slate-500 uppercase font-bold mb-1">Your Bid</p>
                           <p className="text-lg font-bold text-slate-700">₹{bid.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
