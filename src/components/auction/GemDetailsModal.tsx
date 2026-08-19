import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Landmark, Download, MapPin, AlignLeft, Info, Clock, Eye } from 'lucide-react';
import type { GemAuction } from '../../services/publicService';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { getGemItemImage } from '../../utils/gemImageResolver';

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
  
  // In-app document preview state
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    filename: string;
  }>({
    isOpen: false,
    title: '',
    url: '',
    filename: '',
  });

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
      if (e.key === 'Escape' && !viewerState.isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, viewerState.isOpen]);

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

  const targetDocUrl =
    item.document_url ||
    `https://forwardauction.gem.gov.in/eprocure/eauction-download-document/${encodeURIComponent(item.gem_auction_id)}`;
  const defaultFilename = `GeM_Auction_${item.gem_auction_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const proxyDownloadUrl = `/api/document-proxy?url=${encodeURIComponent(targetDocUrl)}&filename=${encodeURIComponent(defaultFilename)}&disposition=attachment`;

  const openInAppViewer = (url: string, title: string, filename: string) => {
    setViewerState({
      isOpen: true,
      title,
      url,
      filename,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs select-text overflow-y-auto">
        {/* Modal Backdrop click listener */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Modal Container */}
        <div className="relative bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 text-left">
          {/* Visual Hero Banner */}
          <div className="relative h-44 w-full bg-slate-900 overflow-hidden shrink-0">
            <img
              src={getGemItemImage(item.title, item.category_name)}
              alt={item.title}
              className="w-full h-full object-cover opacity-85 hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />
            <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
              <span className="bg-primary text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-xs">
                {item.category_name || 'Forward Auction'}
              </span>
              {isLive && (
                <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" /> Live Auction
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white bg-slate-950/50 hover:bg-slate-950/80 rounded-full backdrop-blur-xs transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex justify-between items-start shrink-0">
            <div className="space-y-2 max-w-[95%]">
              <h2 className="text-xl md:text-2xl font-black tracking-tight line-clamp-2">
                {item.title}
              </h2>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                <span>Auction ID: {item.gem_auction_id}</span>
                <button
                  onClick={handleCopyId}
                  className="hover:text-white transition-colors cursor-pointer"
                  title="Copy Auction ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            {/* Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-150 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Reserve / Starting Price
                </span>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {formattedPrice}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-150 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Status
                </span>
                <div className="text-sm font-black text-slate-900 tracking-tight capitalize">
                  {item.auction_status || 'Live'}
                </div>
              </div>
            </div>

            {/* Department & Organisation Overview */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-slate-400" /> Department & Authority
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {item.organisation && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                    <span className="text-slate-400 font-semibold block mb-0.5">Organisation</span>
                    <span className="font-bold text-slate-800 line-clamp-2">{item.organisation}</span>
                  </div>
                )}
                {item.ministry && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                    <span className="text-slate-400 font-semibold block mb-0.5">Ministry</span>
                    <span className="font-bold text-slate-800 line-clamp-2">{item.ministry}</span>
                  </div>
                )}
                {item.department && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                    <span className="text-slate-400 font-semibold block mb-0.5">Department</span>
                    <span className="font-bold text-slate-800 line-clamp-2">{item.department}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Location & Address */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" /> Location Details
                </h3>
                <button
                  onClick={handleCopyAddress}
                  className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer"
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

            {/* Official Documents & In-App Viewer Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" /> Official Notice Documents & Lot Schedules
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Primary Notice PDF Card */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-primary/25 bg-primary/5 shadow-3xs">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        e-Auction Notice PDF
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">Primary Document</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => openInAppViewer(targetDocUrl, `e-Auction Notice: ${item.title}`, defaultFilename)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-primary hover:border-primary/40 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                      title="Preview in-app"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={proxyDownloadUrl}
                      download={defaultFilename}
                      className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Secondary attached documents (Schedule of Lots, Terms) */}
                {item.document_urls && item.document_urls
                  .filter((url) => url !== item.document_url && url !== item.source_url)
                  .map((docUrl, idx) => {
                    const attachFilename = `GeM_${item.gem_auction_id}_Attachment_${idx + 1}.pdf`;
                    const attachDownloadUrl = `/api/document-proxy?url=${encodeURIComponent(docUrl)}&filename=${encodeURIComponent(attachFilename)}&disposition=attachment`;
                    return (
                      <div key={docUrl || idx} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 shadow-3xs">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-slate-800 block truncate">
                              Attachment #{idx + 1}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">Lot Schedule / Terms</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button
                            onClick={() => openInAppViewer(docUrl, `Attachment #${idx + 1} - ${item.title}`, attachFilename)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-primary text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                            title="Preview in-app"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={attachDownloadUrl}
                            download={attachFilename}
                            className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                            title="Download attachment"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
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
              Scraped At: {(() => {
                const d = item.created_at || item.scraped_at || item.updated_at;
                if (!d) return 'Recently Ingested';
                const parsed = new Date(d);
                return isNaN(parsed.getTime()) ? 'Recently Ingested' : parsed.toLocaleString();
              })()}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => openInAppViewer(targetDocUrl, `e-Auction Notice: ${item.title}`, defaultFilename)}
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Preview Notice in App
              </button>
              <a
                href={proxyDownloadUrl}
                download={defaultFilename}
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Notice PDF
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* In-App PDF Document Viewer */}
      <DocumentViewerModal
        isOpen={viewerState.isOpen}
        onClose={() => setViewerState((prev) => ({ ...prev, isOpen: false }))}
        title={viewerState.title}
        documentUrl={viewerState.url}
        filename={viewerState.filename}
      />
    </>
  );
};
