import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Landmark, Download, MapPin, AlignLeft, Info, Clock } from 'lucide-react';
import type { GemAuction } from '../../services/publicService';

interface GemDetailsModalProps {
  item: GemAuction;
  onClose: () => void;
}

export const GemDetailsModal: React.FC<GemDetailsModalProps> = ({
  item,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [countdownStr, setCountdownStr] = useState<string>('');

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
    navigator.clipboard.writeText(item.gem_auction_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAddress = () => {
    const addr = item.full_address || `${item.city ? `${item.city}, ` : ''}${item.location}`;
    navigator.clipboard.writeText(addr);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const formattedPrice = item.reserve_price_value
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(item.reserve_price_value)
    : item.reserve_price_text || 'No Reserve Price';

  const now = new Date();
  const start = new Date(item.auction_start_date);
  const end = new Date(item.auction_end_date);
  const isLive = now >= start && now <= end;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/40 backdrop-blur-xs select-text overflow-y-auto">
      
      {/* Modal Backdrop click listener */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-start shrink-0 text-left">
          <div className="space-y-2 max-w-[85%]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-primary/20 text-primary-200 border border-primary/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                {item.category_name || 'Government Disposal'}
              </span>
              {isLive && (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live Notice
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-snug">{item.title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                Notice ID: {item.gem_auction_id}
                <button
                  onClick={handleCopyId}
                  className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                  title="Copy Notice ID"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </span>
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
              <span className="text-2xl font-black text-slate-955 block mt-1">{formattedPrice}</span>
            </div>
            
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 md:col-span-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Organisation</span>
              <span className="text-sm font-bold text-slate-950 block mt-1 leading-snug">
                {item.organisation || 'N/A'}
              </span>
            </div>
          </div>

          {/* Ministry / Department Details */}
          {(item.ministry || item.department) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-slate-400" /> Government Structure
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {item.ministry && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ministry</span>
                    <span className="text-sm font-bold text-slate-805 mt-0.5 block">{item.ministry}</span>
                  </div>
                )}
                {item.department && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department</span>
                    <span className="text-sm font-bold text-slate-805 mt-0.5 block">{item.department}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location & Address */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" /> Disposal Location
              </h3>
              <button
                onClick={handleCopyAddress}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
              >
                {copiedAddress ? (
                  <>Copied <Check className="w-3.5 h-3.5 text-emerald-500" /></>
                ) : (
                  <>Copy Location <Copy className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
            <div className="bg-slate-55 border border-slate-150 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {item.full_address || `${item.city ? `${item.city}, ` : ''}${item.location}`}
              </p>
              <div className="flex gap-4 text-xs text-slate-400">
                {item.city && <span>City: {item.city}</span>}
                {item.location && <span>State: {item.location}</span>}
                {item.pincode && <span>Pincode: {item.pincode}</span>}
              </div>
            </div>
          </div>

          {/* Bidding & Event Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Bidding Timeline
            </h3>
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bidding Starts</span>
                  <span className="font-bold text-slate-800 block mt-1">
                    {new Date(item.auction_start_date).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bidding Ends</span>
                  <span className="font-bold text-slate-800 block mt-1">
                    {new Date(item.auction_end_date).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-150 pt-3 flex items-center gap-2 text-xs font-bold text-slate-600">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>{countdownStr}</span>
              </div>
            </div>
          </div>

          {/* Raw Description / Ingestion Logs */}
          {item.raw_description && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-slate-400" /> Notice Description
              </h3>
              <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-150 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {item.raw_description}
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-400 font-mono font-bold">
            Scraped At: {new Date(item.scraped_at).toLocaleString()}
          </span>
          <div className="flex gap-2">
            {item.document_url && (
              <a
                href={item.document_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Notice PDF Document
              </a>
            )}
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Go to GeM notice page <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini stub component for ExternalLink
const ExternalLink = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);
