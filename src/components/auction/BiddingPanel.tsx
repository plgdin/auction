// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IndianRupee, Clock, ShieldAlert, ArrowUpRight, CheckCircle2, History, AlertTriangle } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { BidConfirmationModal } from './BidConfirmationModal';
import { useAuthStore } from '../../store/authStore';
import { auctionService } from '../../services/auctionService';
import { paymentService } from '../../services/paymentService';
import type { Auction } from '../../types/database.types';
import clsx from 'clsx';

interface BiddingPanelProps {
  auction: Auction;
  bids: any[];
  currentMaxBid: number;
}

export function BiddingPanel({ auction, bids, currentMaxBid }: BiddingPanelProps) {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  
  const [bidInput, setBidInput] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [hasBlockedEmd, setHasBlockedEmd] = useState(false);
  const [isBlockingEmd, setIsBlockingEmd] = useState(false);

  useEffect(() => {
    async function checkEmd() {
      if (user && auction.id) {
        const blocked = await paymentService.checkEmdStatus(user.id, auction.id);
        setHasBlockedEmd(blocked);
      }
    }
    checkEmd();
  }, [user, auction.id]);

  const isActive = auction.status === 'active';
  const minimumNextBid = currentMaxBid === 0 ? auction.starting_price : currentMaxBid + auction.bid_increment;

  // Determine if current user is highest bidder
  const isHighestBidder = isAuthenticated && user && bids.length > 0 && bids[0].bidder_id === user.id;

  const handlePlaceBidClick = () => {
    setErrorMsg(null);
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: `/auctions/${auction.id}` } });
      return;
    }

    const amount = Number(bidInput);
    if (!amount || isNaN(amount)) {
      setErrorMsg('Please enter a valid bid amount.');
      return;
    }

    if (amount < minimumNextBid) {
      setErrorMsg(`Bid must be at least ₹${minimumNextBid.toLocaleString()}`);
      return;
    }

    setIsModalOpen(true);
  };

  const executeBid = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    
    try {
      const response = await auctionService.placeBid(auction.id, user.id, Number(bidInput));
      if (response.success) {
        setBidInput('');
        setIsModalOpen(false);
      } else {
        setErrorMsg(response.message || 'Failed to place bid. Please try again.');
        setIsModalOpen(false);
      }
    } catch {
      setErrorMsg('An unexpected error occurred.');
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlockEmd = async () => {
    if (!user) {
      navigate('/auth/login', { state: { from: `/auctions/${auction.id}` } });
      return;
    }
    
    setIsBlockingEmd(true);
    setErrorMsg(null);
    try {
      const response = await paymentService.blockAuctionEmd(user.id, auction.id, auction.emd_amount);
      if (response.success) {
        setHasBlockedEmd(true);
      } else {
        if (response.message.includes('Insufficient wallet balance')) {
          navigate('/dashboard/wallet');
        } else {
          setErrorMsg(response.message);
        }
      }
    } catch {
      setErrorMsg('Failed to block EMD.');
    } finally {
      setIsBlockingEmd(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden sticky top-28 flex flex-col max-h-[calc(100vh-8rem)]">
        
        {/* Countdown Banner */}
        <div className="bg-slate-900 p-6 flex flex-col items-center justify-center text-white border-b-4 border-primary shrink-0">
          {isActive ? (
            <>
              <p className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Time Remaining
              </p>
              <CountdownTimer endTime={auction.end_time} />
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-xl font-bold text-slate-300">Auction {auction.status}</p>
            </div>
          )}
        </div>

        {/* Bidding Core */}
        <div className="p-6 shrink-0 border-b border-slate-100">
          
          {/* User Status Banner */}
          {isHighestBidder && isActive && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-green-600 mr-2 shrink-0" />
              <p className="text-sm font-semibold">You are currently the highest bidder!</p>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center shadow-sm text-sm font-medium">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">
                {currentMaxBid === 0 ? 'Starting Price' : 'Current Highest Bid'}
              </p>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 flex items-center tracking-tight">
                <IndianRupee className="w-7 h-7 sm:w-8 sm:h-8 mr-1 text-slate-400" />
                {(currentMaxBid === 0 ? auction.starting_price : currentMaxBid).toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center">
                  <ShieldAlert className="w-3 h-3 mr-1" /> EMD Amount
                </p>
                <p className="text-lg font-bold text-slate-900 flex items-center">
                  <IndianRupee className="w-4 h-4 mr-0.5 text-slate-400" />
                  {auction.emd_amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Bid Increment</p>
                <p className="text-lg font-bold text-slate-900 flex items-center">
                  <IndianRupee className="w-4 h-4 mr-0.5 text-slate-400" />
                  {auction.bid_increment.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Input & CTA */}
            <div className="pt-6">
              {!isActive ? (
                <button disabled className="w-full flex justify-center items-center px-8 py-4 border border-transparent text-lg font-bold rounded-xl text-slate-500 bg-slate-100 cursor-not-allowed">
                  Bidding Closed
                </button>
              ) : !hasBlockedEmd ? (
                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-orange-900 mb-1">EMD Required to Bid</p>
                      <p className="text-xs text-orange-800">You must block ₹{auction.emd_amount.toLocaleString()} from your wallet to participate.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleBlockEmd}
                    disabled={isBlockingEmd}
                    className="w-full flex justify-center items-center px-8 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50"
                  >
                    {isBlockingEmd ? 'Processing...' : 'Block EMD Now'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <IndianRupee className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="number"
                      value={bidInput}
                      onChange={(e) => setBidInput(e.target.value)}
                      placeholder={`Min: ₹${minimumNextBid.toLocaleString()}`}
                      className="block w-full pl-11 pr-4 py-4 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg text-slate-900"
                    />
                  </div>
                  <button 
                    onClick={handlePlaceBidClick}
                    className="w-full flex justify-center items-center px-8 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-primary hover:bg-primary-700 shadow-lg hover:shadow-primary/30 transition-all"
                  >
                    Place Bid Now <ArrowUpRight className="ml-2 w-5 h-5" />
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setBidInput(minimumNextBid.toString())}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
                    >
                      +₹{auction.bid_increment.toLocaleString()}
                    </button>
                    <button 
                      onClick={() => setBidInput((minimumNextBid + auction.bid_increment).toString())}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
                    >
                      +₹{(auction.bid_increment * 2).toLocaleString()}
                    </button>
                    <button 
                      onClick={() => setBidInput((minimumNextBid + (auction.bid_increment * 4)).toString())}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
                    >
                      +₹{(auction.bid_increment * 5).toLocaleString()}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Bid History */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-4 border-b border-slate-200 sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
              <History className="w-4 h-4 mr-2" /> Live Bid History
            </h3>
            <div className="flex items-center">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-semibold text-green-600">Live</span>
            </div>
          </div>
          
          <ul className="divide-y divide-slate-200">
            {bids.length === 0 ? (
              <li className="p-8 text-center text-slate-500 text-sm font-medium">
                No bids placed yet. Be the first!
              </li>
            ) : (
              bids.map((bid, index) => {
                const isCurrentUser = isAuthenticated && user && bid.bidder_id === user.id;
                
                return (
                  <li key={bid.id} className={clsx(
                    "p-4 flex items-center justify-between transition-colors",
                    index === 0 ? "bg-white" : "bg-transparent opacity-75 hover:opacity-100"
                  )}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">
                          {isCurrentUser ? 'You' : `Bidder ${bid.bidder_id.substring(0, 6).toUpperCase()}`}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold uppercase rounded">Leading</span>
                        )}
                        {isCurrentUser && index !== 0 && (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded">Outbid</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(bid.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={clsx(
                      "font-bold font-mono",
                      index === 0 ? "text-lg text-primary" : "text-slate-600"
                    )}>
                      ₹{bid.amount.toLocaleString()}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      <BidConfirmationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={executeBid}
        auction={auction}
        bidAmount={Number(bidInput)}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
