import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Landmark, Download, AlignLeft, Info, Clock, Calendar, ExternalLink } from 'lucide-react';
import type { GemBid } from '../../services/publicService';

interface GemBidDetailsModalProps {
  item: GemBid;
  onClose: () => void;
}

export const GemBidDetailsModal: React.FC<GemBidDetailsModalProps> = ({
  item,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedRa, setCopiedRa] = useState(false);
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
      const start = new Date(item.start_date).getTime();
      const end = new Date(item.end_date).getTime();

      if (now > end) {
        setCountdownStr('Bid Submission Closed');
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
    navigator.clipboard.writeText(item.bid_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRa = () => {
    if (item.ra_number) {
      navigator.clipboard.writeText(item.ra_number);
      setCopiedRa(true);
      setTimeout(() => setCopiedRa(false), 2000);
    }
  };

  const now = new Date();
  const start = new Date(item.start_date);
  const end = new Date(item.end_date);
  const isLive = now >= start && now <= end;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-text overflow-y-auto">
      
      {/* Modal Backdrop click listener */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Block */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="space-y-1.5 text-left">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-extrabold uppercase text-primary font-mono tracking-wider">
                GeM Procurement Bid
              </span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5 font-bold font-mono text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                <span>{item.bid_number}</span>
                <button 
                  onClick={handleCopyId}
                  className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-slate-655 rounded transition-colors"
                  title="Copy Bid Number"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              {item.ra_number && (
                <div className="flex items-center gap-1.5 font-bold font-mono text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                  <span>RA: {item.ra_number}</span>
                  <button 
                    onClick={handleCopyRa}
                    className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-slate-655 rounded transition-colors"
                    title="Copy RA Number"
                  >
                    {copiedRa ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
            <h2 className="text-lg md:text-xl font-extrabold text-slate-900 leading-snug">
              {item.items}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-755 rounded-xl border border-transparent hover:border-slate-200 transition-all cursor-pointer shrink-0 ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-left">
          
          {/* Status and Countdown Alert */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
            now > end 
              ? 'bg-slate-50 border-slate-200 text-slate-600'
              : isLive
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                : 'bg-blue-50/50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-2.5">
              <Clock className={`w-5 h-5 shrink-0 ${now > end ? 'text-slate-400' : isLive ? 'text-emerald-600' : 'text-blue-600'}`} />
              <div className="text-sm font-extrabold">
                {countdownStr}
              </div>
            </div>
            <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white border capitalize font-mono shadow-3xs">
              Status: {item.status}
            </div>
          </div>

          {/* Core parameter cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left Block: Basic Details */}
            <div className="p-4 rounded-xl border border-slate-150 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Bid Parameters
              </h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-400 font-semibold text-xs block">QUANTITY</span>
                  <span className="font-bold text-slate-800">{item.quantity || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold text-xs block">CATEGORY CLASS</span>
                  <span className="font-bold text-slate-800 capitalize">{item.category_name}</span>
                </div>
              </div>
            </div>

            {/* Right Block: Department Info */}
            <div className="p-4 rounded-xl border border-slate-150 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Department Structure
              </h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-400 font-semibold text-xs block">PROCURING DEPARTMENT</span>
                  <span className="font-bold text-slate-800 block leading-tight">{item.department_name || 'GeM Department'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Timeline Calendar */}
          <div className="p-4 rounded-xl border border-slate-150 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Bidding Timeline
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 font-semibold text-xs block">START DATE & TIME</span>
                <span className="font-bold text-slate-800">{new Date(item.start_date).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 font-semibold text-xs block">CLOSE DATE & TIME</span>
                <span className="font-bold text-slate-800">{new Date(item.end_date).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Raw payload description if present */}
          {item.raw_description && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5" /> Original Listing Raw Description
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs font-mono text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-3xs">
                {item.raw_description}
              </div>
            </div>
          )}

        </div>

        {/* Footer Action buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-655 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
          
          {item.document_url && (
            <a
              href={item.document_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary-hover shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Bid PDF Notice
            </a>
          )}
          {item.ra_document_url && (
            <a
              href={item.ra_document_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download RA PDF Notice
            </a>
          )}
          <a
            href={item.document_url || `https://bidplus.gem.gov.in/showbidDocument/${item.bid_number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 shadow-xs transition-colors cursor-pointer"
          >
            Visit Live Portal <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </div>
  );
};
