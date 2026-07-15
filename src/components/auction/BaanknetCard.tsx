import { useState } from 'react';
import { Eye, MapPin, Building2, Calendar, Landmark, Heart } from 'lucide-react';
import type { BaanknetAuction } from '../../services/publicService';

interface BaanknetCardProps {
  item: BaanknetAuction;
  isGrid?: boolean;
  onPreview: (item: BaanknetAuction) => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export function BaanknetCard({
  item,
  isGrid = true,
  onPreview,
  isInterested = false,
  onInterestedToggle,
}: BaanknetCardProps) {
  const [imageError, setImageError] = useState(false);

  // Parse reserve price numeric value or fallback
  const formattedPrice = item.reserve_price_value
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(item.reserve_price_value)
    : item.reserve_price_text || 'N/A';

  // Determine property status (Live vs Upcoming vs Closed)
  const getStatusBadge = () => {
    const now = new Date();
    const start = new Date(item.auction_start_date);
    const end = new Date(item.auction_end_date);

    if (now > end) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
          CLOSED
        </span>
      );
    } else if (now >= start && now <= end) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
          LIVE BIDDING
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
          UPCOMING
        </span>
      );
    }
  };

  // Safe fallback placeholder images based on property type
  const getPlaceholderImage = () => {
    const type = (item.property_type || '').toLowerCase();
    if (type.includes('land') || type.includes('plot')) {
      return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
    } else if (type.includes('vehicle') || type.includes('car')) {
      return 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
    } else if (type.includes('commercial') || type.includes('office') || type.includes('shop')) {
      return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
    }
    // Default to residential/house
    return 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
  };

  const previewImage = getPlaceholderImage();

  if (isGrid) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-all group duration-300">
        
        {/* Card Image Header */}
        <div className="relative h-44 w-full bg-slate-100 overflow-hidden shrink-0">
          {!imageError ? (
            <img
              src={previewImage}
              alt={item.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
              <Building2 className="w-12 h-12 text-slate-355" />
            </div>
          )}

          {/* Watchlist Toggle Button */}
          {onInterestedToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInterestedToggle();
              }}
              className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-rose-500 rounded-full hover:scale-110 shadow-sm transition-all duration-200 border border-slate-100/50 cursor-pointer"
            >
              <Heart className={`w-4 h-4 ${isInterested ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
            </button>
          )}

          {/* Status Badge overlay */}
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            {getStatusBadge()}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 md:p-5 flex-grow flex flex-col justify-between">
          <div className="space-y-2.5">
            
            {/* Header: Bank Name & Category Tag */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold font-mono truncate">
                <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate uppercase tracking-wider">{item.bank_name || 'Bank Auction'}</span>
              </div>
              <span className="shrink-0 px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-extrabold uppercase tracking-wider rounded border border-slate-200/55">
                {item.property_type || 'Foreclosure'}
              </span>
            </div>

            {/* Title */}
            <h3 className="font-bold text-slate-900 line-clamp-2 text-sm leading-snug group-hover:text-primary transition-colors min-h-[36px] text-left">
              {item.title}
            </h3>

            {/* Location & Address */}
            <div className="flex items-start gap-1.5 text-xs text-slate-500 text-left">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div className="line-clamp-2 leading-relaxed">
                {item.city ? `${item.city}, ` : ''}{item.location || 'India'}
              </div>
            </div>

            {/* Reserve Price Card Section */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3.5 mt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">Reserve Price</span>
              <span className="text-base font-extrabold text-slate-950 block mt-0.5 text-left">{formattedPrice}</span>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-4">
            <div className="text-[11px] text-slate-400 flex items-center gap-1 leading-tight text-left">
              <Calendar className="w-3.5 h-3.5 text-slate-350 shrink-0" />
              <div>
                <span className="block font-medium">Bidding Starts</span>
                <span className="font-semibold text-slate-600">{new Date(item.auction_start_date).toLocaleDateString()}</span>
              </div>
            </div>

            <button
              onClick={() => onPreview(item)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List View Layout
  return (
    <div className="flex flex-col sm:flex-row bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all group duration-300 p-5 gap-5">
      
      {/* Thumbnail */}
      <div className="relative w-full sm:w-60 h-40 bg-slate-100 rounded-lg overflow-hidden shrink-0">
        {!imageError ? (
          <img
            src={previewImage}
            alt={item.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
            <Building2 className="w-12 h-12 text-slate-355" />
          </div>
        )}

        <div className="absolute top-3 left-3">
          {getStatusBadge()}
        </div>
      </div>

      {/* Info details */}
      <div className="flex-grow flex flex-col justify-between text-left">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold font-mono">
              <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="uppercase tracking-wider">{item.bank_name || 'Bank Auction'}</span>
            </div>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-extrabold uppercase tracking-wider rounded border border-slate-200/55">
              {item.property_type || 'Foreclosure'}
            </span>
          </div>

          <h3 className="font-bold text-slate-950 text-base leading-snug group-hover:text-primary transition-colors mb-2">
            {item.title}
          </h3>

          <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-3">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {item.full_address || `${item.city ? `${item.city}, ` : ''}${item.location || 'India'}`}
            </div>
          </div>
        </div>

        {/* Grid Stats Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-4 gap-4 mt-auto">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reserve Price</span>
              <span className="text-lg font-black text-slate-900 block mt-0.5">{formattedPrice}</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Calendar className="w-4 h-4 text-slate-355 mr-1.5 shrink-0" />
              <div>
                <span className="block font-medium">Bidding Starts</span>
                <span className="font-bold text-slate-700">{new Date(item.auction_start_date).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onInterestedToggle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInterestedToggle();
                }}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-rose-500 rounded-lg hover:scale-105 transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${isInterested ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
              </button>
            )}
            <button
              onClick={() => onPreview(item)}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
