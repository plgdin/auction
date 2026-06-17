// @ts-nocheck
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MapPin, Tag } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import type { Auction } from '../../types/database.types';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';
import { auctionService } from '../../services/auctionService';
import clsx from 'clsx';

interface AuctionCardProps {
  auction: Auction;
  isGrid?: boolean;
  isWatchlistedInitial?: boolean;
}

export function AuctionCard({ auction, isGrid = true, isWatchlistedInitial = false }: AuctionCardProps) {
  const { isAuthenticated, user } = useAuthStore();
  const { currency } = useAppStore();
  const navigate = useNavigate();
  const [isWatchlisted, setIsWatchlisted] = useState(isWatchlistedInitial);
  const [isToggling, setIsToggling] = useState(false);

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: `/auctions` } });
      return;
    }

    setIsToggling(true);
    try {
      const added = await auctionService.toggleWatchlist(user.id, auction.id);
      setIsWatchlisted(added);
    } catch (error) {
      console.error('Failed to toggle watchlist', error);
    } finally {
      setIsToggling(false);
    }
  };

  const isActive = auction.status === 'active';

  const now = new Date();
  const endTime = new Date(auction.end_time);
  const createdAt = new Date(auction.created_at);
  const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let statusBadgeLabel = 'Upcoming';
  let statusBadgeColor = 'bg-primary-600';

  if (endTime > now && endTime <= fortyEightHoursLater) {
    statusBadgeLabel = 'Closes Soon';
    statusBadgeColor = 'bg-amber-600 animate-pulse';
  } else if (createdAt >= sevenDaysAgo) {
    statusBadgeLabel = 'Recently Added';
    statusBadgeColor = 'bg-green-650';
  }

  if (!isGrid) {
    // LIST VIEW
    return (
      <Link 
        to={`/auctions/${auction.id}`}
        className="flex flex-col sm:flex-row bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all group"
      >
        <div className="w-full sm:w-64 h-48 sm:h-auto bg-slate-100 relative shrink-0">
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            No Image
          </div>
          <div className="absolute top-3 left-3 flex gap-2">
            <span className={clsx(
              "px-2.5 py-1 text-xs font-bold rounded-md shadow-sm uppercase tracking-wider text-white",
              statusBadgeColor
            )}>
              {statusBadgeLabel}
            </span>
          </div>
          <button
            onClick={handleWatchlistToggle}
            disabled={isToggling}
            className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
          >
            <Heart className={clsx("w-5 h-5", isWatchlisted ? "fill-red-500 text-red-500" : "text-slate-500")} />
          </button>
        </div>
        
        <div className="p-5 flex-grow flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1 flex items-center">
                <Tag className="w-3 h-3 mr-1" /> REF: {auction.reference_number}
              </p>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2">
                {auction.title}
              </h3>
            </div>
            <div className="text-right ml-4 shrink-0">
              <p className="text-xs text-slate-500 uppercase font-medium mb-1">Starting Price</p>
              <p className="text-lg font-extrabold text-slate-900 font-mono text-right">
                {formatPrice(auction.starting_price, currency)}
              </p>
            </div>
          </div>
          
          <p className="text-slate-600 text-sm line-clamp-2 mb-4">
            {auction.description || 'No description provided.'}
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium border border-slate-200">
              Office: {auction.regional_office}
            </span>
            {auction.pre_bid && (
              <span className="bg-amber-50 text-amber-800 px-2 py-1 rounded-md font-semibold border border-amber-200">
                Pre-bid Required
              </span>
            )}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-4 items-center">
            <div className="flex items-center text-sm text-slate-500">
              <MapPin className="w-4 h-4 mr-1.5" />
              {auction.location || 'Multiple Locations'}
            </div>
            <div className="flex justify-end">
              {isActive ? (
                <CountdownTimer endTime={auction.end_time} compact />
              ) : (
                <span className="text-sm font-medium text-slate-500">Ended</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // GRID VIEW
  return (
    <Link 
      to={`/auctions/${auction.id}`}
      className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all group flex flex-col h-full"
    >
      <div className="h-48 bg-slate-100 relative shrink-0">
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          No Image
        </div>
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={clsx(
            "px-2.5 py-1 text-xs font-bold rounded-md shadow-sm uppercase tracking-wider text-white",
            statusBadgeColor
          )}>
            {statusBadgeLabel}
          </span>
        </div>
        <button
          onClick={handleWatchlistToggle}
          disabled={isToggling}
          className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
        >
          <Heart className={clsx("w-5 h-5", isWatchlisted ? "fill-red-500 text-red-500" : "text-slate-500")} />
        </button>
      </div>
      
      <div className="p-5 flex-grow flex flex-col">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center">
          <Tag className="w-3 h-3 mr-1" /> REF: {auction.reference_number}
        </p>
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2 mb-3">
          {auction.title}
        </h3>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-slate-600">
            <MapPin className="w-4 h-4 mr-1.5 text-slate-400 shrink-0" />
            <span className="truncate">{auction.location || 'Multiple Locations'}</span>
          </div>
          <div className="text-xs text-slate-500 flex justify-between items-center gap-2">
            <span className="truncate">Office: {auction.regional_office}</span>
            {auction.pre_bid && (
              <span className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-semibold border border-amber-200 shrink-0">
                Pre-bid
              </span>
            )}
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
          <div>
            <p className="text-xs text-slate-500 uppercase font-medium mb-1">Starting Price</p>
            <p className="text-lg font-extrabold text-slate-900 font-mono">
              {formatPrice(auction.starting_price, currency)}
            </p>
          </div>
          <div>
            {isActive ? (
              <CountdownTimer endTime={auction.end_time} compact />
            ) : (
              <span className="text-sm font-medium text-slate-500">Ended</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
