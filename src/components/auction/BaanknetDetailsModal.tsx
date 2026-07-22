import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Calendar, Landmark, MapPin, Heart, ExternalLink, Clock, FileDown, Image, Ruler, ChevronLeft, ChevronRight, Shield, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BaanknetAuction } from '../../services/publicService';

interface BaanknetDetailsModalProps {
  item: BaanknetAuction;
  onClose: () => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export const BaanknetDetailsModal: React.FC<BaanknetDetailsModalProps> = ({
  item,
  onClose,
  isInterested = false,
  onInterestedToggle,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [countdownStr, setCountdownStr] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Fetch photos from baanknet_auction_photos table
  useEffect(() => {
    async function fetchPhotos() {
      const { data } = await supabase
        .from('baanknet_auction_photos')
        .select('photo_url')
        .eq('baanknet_auction_id', item.baanknet_auction_id)
        .order('display_order', { ascending: true });
      if (data && data.length > 0) {
        const validPhotos = data
          .map(p => p.photo_url)
          .filter(url => {
            if (!url) return false;
            const lower = url.toLowerCase();
            return !lower.endsWith('.svg') &&
                   !lower.includes('icon') &&
                   !lower.includes('logo') &&
                   !lower.includes('facebook') &&
                   !lower.includes('twitter') &&
                   !lower.includes('linkedin') &&
                   !lower.includes('instagram') &&
                   !lower.includes('youtube') &&
                   !lower.includes('footer') &&
                   !lower.includes('faq') &&
                   !lower.includes('hassle') &&
                   !lower.includes('banner') &&
                   !lower.includes('ebkray');
          });
        setPhotos(validPhotos);
      } else if (item.thumbnail_url) {
        const lower = item.thumbnail_url.toLowerCase();
        if (!lower.endsWith('.svg') && !lower.includes('icon') && !lower.includes('logo') && !lower.includes('footer')) {
          setPhotos([item.thumbnail_url]);
        }
      }
    }
    fetchPhotos();
  }, [item.baanknet_auction_id, item.thumbnail_url]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Live bidding countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const start = new Date(item.auction_start_date).getTime();
      const end = new Date(item.auction_end_date).getTime();

      if (now > end) {
        setCountdownStr('Auction Closed');
      } else if (now >= start && now <= end) {
        const diff = end - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownStr(`Bidding Ends in: ${hours}h ${mins}m ${secs}s`);
      } else {
        const diff = start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdownStr(`Starts in: ${days}d ${hours}h ${mins}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [item]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(item.baanknet_auction_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(item.full_address || `${item.city}, ${item.location}`);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const formattedPrice = item.reserve_price_value
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(item.reserve_price_value)
    : item.reserve_price_text || 'N/A';

  // Determine property status
  const now = new Date();
  const start = new Date(item.auction_start_date);
  const end = new Date(item.auction_end_date);
  const isLive = now >= start && now <= end;
  const isClosed = now > end;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs select-text overflow-y-auto">
      
      {/* Modal Backdrop click listener */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-start shrink-0 text-left">
          <div className="space-y-2 max-w-[85%]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-primary/20 text-primary-200 border border-primary/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                {item.property_type || 'Bank Foreclosure'}
              </span>
              {isLive && (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live Auction
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-snug">{item.title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
              <span>Auction ID: {item.baanknet_auction_id}</span>
              {item.bank_property_id && <span>Property ID: {item.bank_property_id}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1 text-left">
          
          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reserve Price</span>
              <span className="text-2xl font-black text-slate-950 block mt-1">{formattedPrice}</span>
            </div>
            
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 md:col-span-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lending Institution</span>
              <span className="text-lg font-bold text-slate-950 block mt-1 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-slate-400 shrink-0" />
                {item.bank_name || 'Foreclosing Bank'}
              </span>
            </div>
          </div>

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Image className="w-4 h-4 text-slate-400" /> Property Photos ({photos.length})
              </h3>
              <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-video">
                <img
                  src={photos[activePhotoIdx]}
                  alt={`Property photo ${activePhotoIdx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setActivePhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setActivePhotoIdx((i) => (i + 1) % photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 cursor-pointer transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                      {activePhotoIdx + 1} / {photos.length}
                    </div>
                  </>
                )}
              </div>
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                        idx === activePhotoIdx ? 'border-primary shadow-md scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Property Physical Details */}
          {(item.carpet_area || item.furnishing || item.possession_status || item.action_type) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-slate-400" /> Property Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {item.carpet_area && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Carpet Area</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{item.carpet_area}</span>
                    {item.carpet_area_sqft && (
                      <span className="text-[10px] text-slate-500">{item.carpet_area_sqft.toLocaleString()} sq ft</span>
                    )}
                  </div>
                )}
                {item.furnishing && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Furnishing</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{item.furnishing}</span>
                  </div>
                )}
                {item.possession_status && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Possession</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{item.possession_status}</span>
                  </div>
                )}
                {item.action_type && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Action Type</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-indigo-500" />
                      {item.action_type}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Borrower & Description */}
          {(item.borrower_name || item.property_description) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> Borrower & Description
              </h3>
              {item.borrower_name && (
                <div className="bg-amber-50 border border-amber-150 rounded-xl p-4">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Borrower / Guarantor</span>
                  <span className="text-sm font-bold text-amber-900 mt-0.5 block">{item.borrower_name}</span>
                </div>
              )}
              {item.property_description && (
                <p className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                  {item.property_description}
                </p>
              )}
            </div>
          )}

          {/* Location & Address Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Location & Asset Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">State / Territory</span>
                  <p className="font-semibold text-slate-850 mt-0.5">{item.location || 'India'}</p>
                </div>
                {item.city && (
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">City / District</span>
                    <p className="font-semibold text-slate-850 mt-0.5">{item.city} {item.pincode ? `(${item.pincode})` : ''}</p>
                  </div>
                )}
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Address</span>
                  <button
                    onClick={handleCopyAddress}
                    className="text-[10px] font-bold text-primary hover:text-primary-700 flex items-center gap-1 cursor-pointer bg-transparent border-0"
                  >
                    {copiedAddress ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copiedAddress ? 'Copied' : 'Copy Address'}
                  </button>
                </div>
                <p className="bg-slate-50 border border-slate-150 rounded-xl p-4 mt-2 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                  {item.full_address || 'Address details not provided. Please refer to the official bank listing portal.'}
                </p>
              </div>
            </div>
          </div>

          {/* Bidding Window & Dates */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Bidding Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-150 rounded-xl p-4 flex items-center gap-3 bg-slate-50/50">
                <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="text-xs">
                  <span className="block font-bold text-slate-400 uppercase tracking-wider">Bidding Opens</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {new Date(item.auction_start_date).toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="border border-slate-150 rounded-xl p-4 flex items-center gap-3 bg-slate-50/50">
                <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="text-xs">
                  <span className="block font-bold text-slate-400 uppercase tracking-wider">Bidding Closes</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {new Date(item.auction_end_date).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Inspection & EMD dates (only shown when scraped from detail pages) */}
            {(item.inspection_start_date || item.emd_end_date) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                {item.inspection_start_date && (
                  <div className="border border-emerald-150 rounded-xl p-3 bg-emerald-50/50">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Inspection Start</span>
                    <span className="font-bold text-emerald-900 text-xs mt-0.5 block">
                      {new Date(item.inspection_start_date).toLocaleString()}
                    </span>
                  </div>
                )}
                {item.inspection_end_date && (
                  <div className="border border-emerald-150 rounded-xl p-3 bg-emerald-50/50">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Inspection End</span>
                    <span className="font-bold text-emerald-900 text-xs mt-0.5 block">
                      {new Date(item.inspection_end_date).toLocaleString()}
                    </span>
                  </div>
                )}
                {item.emd_end_date && (
                  <div className="border border-rose-150 rounded-xl p-3 bg-rose-50/50">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">EMD Deadline</span>
                    <span className="font-bold text-rose-900 text-xs mt-0.5 block">
                      {new Date(item.emd_end_date).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Countdown Banner */}
            <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-4.5 flex items-center justify-between text-indigo-900 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider">Bidding Timeline</span>
              <span className="font-black text-sm md:text-base tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping shrink-0" />
                {countdownStr}
              </span>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-150 flex flex-wrap items-center justify-between gap-4 shrink-0 text-left">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-450" />}
              {copied ? 'Copied ID' : 'Copy Auction ID'}
            </button>
            
            {onInterestedToggle && (
              <button
                onClick={onInterestedToggle}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-rose-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Heart className={`w-3.5 h-3.5 ${isInterested ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                {isInterested ? 'Saved to Watchlist' : 'Save to Watchlist'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {item.document_url && (
              <a
                href={item.document_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4" /> Download Notice
              </a>
            )}
            
            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Visit Live Portal <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
