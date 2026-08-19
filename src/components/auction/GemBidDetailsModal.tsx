import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Landmark, Download, AlignLeft, Clock, Calendar, Eye } from 'lucide-react';
import type { GemBid } from '../../services/publicService';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { getGemItemImage } from '../../utils/gemImageResolver';

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

  // In-app document viewer state
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

  const targetBidDocUrl = item.document_url || `https://bidplus.gem.gov.in/showbidDocument/${encodeURIComponent(item.bid_number)}`;
  const defaultBidFilename = `GeM_Bid_${item.bid_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const proxyBidDownloadUrl = `/api/document-proxy?url=${encodeURIComponent(targetBidDocUrl)}&filename=${encodeURIComponent(defaultBidFilename)}&disposition=attachment`;

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-text overflow-y-auto">
        {/* Modal Backdrop click listener */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Modal Container */}
        <div className="relative bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Visual Hero Banner */}
          <div className="relative h-44 w-full bg-slate-900 overflow-hidden shrink-0">
            <img
              src={getGemItemImage(item.items, item.category_name)}
              alt={item.items}
              className="w-full h-full object-cover opacity-85 hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />
            <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-extrabold uppercase bg-primary text-white text-[10px] px-2.5 py-1 rounded-md font-mono tracking-wider shadow-xs">
                {item.category_name || 'GeM Procurement Bid'}
              </span>
              {item.ra_number && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                  Reverse Auction (RA) Active
                </span>
              )}
              {isLive ? (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1 shadow-xs animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" /> Active Bid
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-700 text-slate-200">
                  Closed
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

          {/* Header Block */}
          <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
            <div className="space-y-1.5 text-left w-full">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
                {item.items || 'Tender Item Procurement'}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500 pt-1">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-3xs">
                  <span>Bid No: {item.bid_number}</span>
                  <button
                    onClick={handleCopyId}
                    className="hover:text-primary transition-colors cursor-pointer"
                    title="Copy Bid Number"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                {item.ra_number && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-800 shadow-3xs">
                    <span>RA No: {item.ra_number}</span>
                    <button
                      onClick={handleCopyRa}
                      className="hover:text-emerald-950 transition-colors cursor-pointer"
                      title="Copy RA Number"
                    >
                      {copiedRa ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content Scroll Area */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1 text-left">
            {/* Procurement Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Required Quantity / Units
                </span>
                <p className="text-xl font-black text-slate-900 font-mono">
                  {item.quantity ? `${item.quantity.toLocaleString()} Units` : 'Check Bid Notice PDF'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Status
                </span>
                <p className="text-sm font-bold text-slate-900 capitalize">
                  {item.status || 'Live Submission'}
                </p>
              </div>
            </div>

            {/* Department Details */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Buyer / Department
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-sm font-semibold text-slate-800">
                {item.department_name || 'Ministry / PSU Department'}
              </div>
            </div>

            {/* Schedule Timeline */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Submission Timeline
              </h3>
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-150 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-slate-600">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Start Date & Time</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {new Date(item.start_date).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">End Date & Time</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {new Date(item.end_date).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-3 flex items-center gap-2 text-xs font-bold text-primary">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{countdownStr}</span>
                </div>
              </div>
            </div>

            {/* Official Documents & Corrigenda */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-primary" /> Official Documents & Corrigenda
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Primary Bid Notice Card */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5 shadow-3xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <div className="truncate">
                      <span className="text-xs font-bold text-primary block truncate">
                        Bid Notice Document
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">Primary Tender PDF</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => openInAppViewer(targetBidDocUrl, `Bid Notice: ${item.bid_number}`, defaultBidFilename)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-primary text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                      title="Preview in-app"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={proxyBidDownloadUrl}
                      download={defaultBidFilename}
                      className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* RA Notice if present */}
                {item.ra_document_url && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 shadow-3xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-bold text-emerald-800 block truncate">
                          RA Document Notice
                        </span>
                        <span className="text-[10px] text-emerald-600/70 font-mono block">Reverse Auction PDF</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={() => openInAppViewer(item.ra_document_url!, `RA Notice: ${item.ra_number}`, `GeM_RA_${item.ra_number}.pdf`)}
                        className="p-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 hover:text-emerald-950 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                        title="Preview RA in-app"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={`/api/document-proxy?url=${encodeURIComponent(item.ra_document_url)}&filename=GeM_RA_${item.ra_number}.pdf&disposition=attachment`}
                        download={`GeM_RA_${item.ra_number}.pdf`}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                        title="Download RA PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Corrigendum PDFs */}
                {item.corrigendum_urls && item.corrigendum_urls.map((cUrl, idx) => {
                  const corrFilename = `GeM_Bid_${item.bid_number}_Corrigendum_${idx + 1}.pdf`;
                  const corrDownloadUrl = `/api/document-proxy?url=${encodeURIComponent(cUrl)}&filename=${encodeURIComponent(corrFilename)}&disposition=attachment`;
                  return (
                    <div key={cUrl || idx} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50 shadow-3xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <div className="truncate">
                          <span className="text-xs font-bold text-amber-900 block truncate">
                            Corrigendum #{idx + 1}
                          </span>
                          <span className="text-[10px] text-amber-700/80 font-mono block">Amendment Notice</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => openInAppViewer(cUrl, `Corrigendum #${idx + 1} - Bid ${item.bid_number}`, corrFilename)}
                          className="p-1.5 rounded-lg bg-white border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          title="Preview Corrigendum in-app"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={corrDownloadUrl}
                          download={corrFilename}
                          className="p-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          title="Download Corrigendum PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}

                {/* Additional attached documents (ATC / Specs) */}
                {item.document_urls && item.document_urls
                  .filter((dUrl) => dUrl !== item.document_url && dUrl !== item.ra_document_url && !(item.corrigendum_urls || []).includes(dUrl))
                  .map((dUrl, idx) => {
                    const atcFilename = `GeM_Bid_${item.bid_number}_Attachment_${idx + 1}.pdf`;
                    const atcDownloadUrl = `/api/document-proxy?url=${encodeURIComponent(dUrl)}&filename=${encodeURIComponent(atcFilename)}&disposition=attachment`;
                    return (
                      <div key={dUrl || idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 shadow-3xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-slate-800 block truncate">
                              Attachment #{idx + 1}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">ATC / Technical Spec</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button
                            onClick={() => openInAppViewer(dUrl, `Attachment #${idx + 1} - Bid ${item.bid_number}`, atcFilename)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-primary text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                            title="Preview in-app"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={atcDownloadUrl}
                            download={atcFilename}
                            className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
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
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-end gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-655 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => openInAppViewer(targetBidDocUrl, `Bid Notice: ${item.bid_number}`, defaultBidFilename)}
              className="flex items-center gap-1.5 px-4.5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 shadow-xs transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Preview Bid in App
            </button>
            <a
              href={proxyBidDownloadUrl}
              download={defaultBidFilename}
              className="flex items-center gap-1.5 px-4.5 py-2 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary-hover shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download Bid Notice PDF
            </a>
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
