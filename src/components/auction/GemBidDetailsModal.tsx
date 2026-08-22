import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, Landmark, Download, MapPin, AlignLeft, Info, Clock, Eye, Heart, Calendar, FileText, Phone, UserCheck, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import type { GemBid } from '../../services/publicService';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { getGemItemImage } from '../../utils/gemImageResolver';

interface GemBidDetailsModalProps {
  item: GemBid;
  onClose: () => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export const GemBidDetailsModal: React.FC<GemBidDetailsModalProps> = ({
  item,
  onClose,
  isInterested = false,
  onInterestedToggle,
}) => {
  const [copiedBid, setCopiedBid] = useState(false);
  const [copiedRa, setCopiedRa] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [countdownStr, setCountdownStr] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'details'>('details');

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

  // Safe date parser
  const safeParse = (d?: string | null): Date | null => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const safeDateStr = (d?: string | null): string => {
    const parsed = safeParse(d);
    return parsed ? parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not Available';
  };

  // Helper to extract Contact Officers & Phone Numbers
  const contactDetails = useMemo(() => {
    const combinedText = `${item.items || ''} ${item.department || ''} ${item.organisation || ''}`;
    const contacts: { name: string; phone?: string }[] = [];

    const phoneMatches = Array.from(
      new Set(combinedText.match(/\b[6-9]\d{9}\b|\b\d{5}\s*\d{5}\b|\b\d{3,5}[-\s]\d{6,8}\b/g) || [])
    );

    if (phoneMatches.length > 0) {
      phoneMatches.forEach((ph) => {
        contacts.push({
          name: 'Procurement Officer / Nodal Helpline',
          phone: ph,
        });
      });
    }

    return contacts;
  }, [item.items, item.department, item.organisation]);

  // Live bidding countdown timer
  useEffect(() => {
    const startD = safeParse(item.start_date);
    const endD = safeParse(item.end_date);

    if (!startD && !endD) {
      setCountdownStr('Schedule Pending');
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const startMs = startD ? startD.getTime() : 0;
      const endMs = endD ? endD.getTime() : 0;

      if (endD && now > endMs) {
        setCountdownStr('Bid Submission Closed');
      } else if (startD && endD && now >= startMs && now <= endMs) {
        const diff = endMs - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownStr(`Bidding Ends in: ${hours}h ${mins}m ${secs}s`);
      } else if (startD && now < startMs) {
        const diff = startMs - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdownStr(`Starts in: ${days}d ${hours}h ${mins}m`);
      } else {
        setCountdownStr('Schedule Pending');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [item.start_date, item.end_date]);

  const handleCopyBid = () => {
    navigator.clipboard.writeText(item.bid_number);
    setCopiedBid(true);
    setTimeout(() => setCopiedBid(false), 2000);
  };

  const handleCopyRa = () => {
    if (item.ra_number) {
      navigator.clipboard.writeText(item.ra_number);
      setCopiedRa(true);
      setTimeout(() => setCopiedRa(false), 2000);
    }
  };

  const handleCopyPhone = (ph: string) => {
    navigator.clipboard.writeText(ph);
    setCopiedPhone(ph);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const now = new Date();
  const startD = safeParse(item.start_date);
  const endD = safeParse(item.end_date);
  const isClosed = endD ? now > endD : false;
  const isLive = startD && endD ? (now >= startD && now <= endD) : false;

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

  // Documents collection
  interface DocumentEntry {
    url: string;
    label: string;
    safeName: string;
    downloadUrl: string;
  }

  const getAvailableDocuments = (): DocumentEntry[] => {
    const entries: DocumentEntry[] = [];
    if (targetBidDocUrl) {
      entries.push({
        url: targetBidDocUrl,
        label: 'Official GeM Bid Document PDF',
        safeName: defaultBidFilename,
        downloadUrl: proxyBidDownloadUrl,
      });
    }

    if (Array.isArray(item.document_urls)) {
      item.document_urls.forEach((url, idx) => {
        if (url && url !== targetBidDocUrl && url !== item.source_url) {
          const safeName = `GeM_Bid_${item.bid_number}_Attachment_${idx + 1}.pdf`;
          const downloadUrl = `/api/document-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}&disposition=attachment`;
          entries.push({
            url,
            label: `Bid Attachment #${idx + 1}`,
            safeName,
            downloadUrl,
          });
        }
      });
    }
    return entries;
  };

  const availableDocs = getAvailableDocuments();
  const primaryDoc = availableDocs[0];
  const itemImage = getGemItemImage(item.items || item.bid_number, item.category_name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs select-text overflow-hidden">
      
      {/* Modal Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 text-left">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-slate-500">Ref: {item.bid_number}</span>
            <button
              onClick={handleCopyBid}
              className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center"
              title="Copy Bid Number"
            >
              {copiedBid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {onInterestedToggle && (
              <button
                onClick={onInterestedToggle}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-2xs",
                  isInterested 
                    ? "bg-rose-50 border-rose-200 text-rose-700" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Heart className={clsx("w-3.5 h-3.5", isInterested ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
                <span>{isInterested ? "Interested" : "I'm Interested"}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('details')}
              className={clsx(
                "py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer",
                activeTab === 'details'
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              )}
            >
              Catalog Details
            </button>
          </div>
        </div>

        {/* Main Content Body (Split Screen) */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
          
          {/* Left Panel: Bid Information */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            
            {/* Category & Title Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                  GeM PROCUREMENT BID
                </span>
                {item.category_name && (
                  <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    {item.category_name}
                  </span>
                )}
                {item.state && (
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-red-500" />
                    {item.state}
                  </span>
                )}
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 leading-tight">
                {item.items || `GeM Bid Notice #${item.bid_number}`}
              </h3>
            </div>

            {/* Official Bid Reference Banner */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-3xs">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Official GeM Bid Number
                </span>
                <span className="text-base font-bold text-slate-800 break-all select-all font-mono">
                  {item.bid_number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyBid}
                  className={clsx(
                    "flex items-center justify-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-all shrink-0 cursor-pointer shadow-3xs",
                    copiedBid
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-primary hover:border-primary/30"
                  )}
                >
                  {copiedBid ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Bid Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Bid</span>
                    </>
                  )}
                </button>

                {item.ra_number && (
                  <button
                    onClick={handleCopyRa}
                    className={clsx(
                      "flex items-center justify-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-all shrink-0 cursor-pointer shadow-3xs",
                      copiedRa
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                    )}
                  >
                    {copiedRa ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>RA Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy RA</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Department & Authority Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Department Overview */}
              <div className="md:col-span-7 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span>Procuring Department / Authority</span>
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </span>
                  <span className="text-base font-black text-indigo-950 mt-1 flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-indigo-600 shrink-0" />
                    {item.department || item.organisation || 'Government Authority'}
                  </span>
                </div>

                {item.organisation && item.organisation !== item.department && (
                  <div className="border-t border-slate-100 pt-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-400 uppercase text-[10px]">Organisation: </span>
                    <span className="font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{item.organisation}</span>
                  </div>
                )}
              </div>

              {/* Quantity & Items Info */}
              <div className="md:col-span-5 bg-gradient-to-br from-indigo-50 via-indigo-50/70 to-blue-50 border border-indigo-200/80 rounded-2xl p-4.5 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[10.5px] font-black text-indigo-800 uppercase tracking-widest block">
                    Quantity Required
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-indigo-950 block mt-1 tracking-tight">
                    {item.quantity ? `${item.quantity.toLocaleString()} Units` : 'Lot Procurement'}
                  </span>
                </div>
              </div>

            </div>

            {/* Procurement Officers & Contact Helpline Info */}
            {contactDetails.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50/80 via-amber-50/50 to-orange-50/60 rounded-2xl p-4.5 border border-amber-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <span className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
                    Procurement Officer & Helpline Contact
                  </span>
                  <span className="text-[10px] bg-amber-200/80 text-amber-950 font-black px-2 py-0.5 rounded">
                    DIRECT HELPLINE
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {contactDetails.map((contact, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl p-3 border border-amber-200/70 flex items-center justify-between gap-3 shadow-3xs"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {contact.name}
                        </span>
                        {contact.phone && (
                          <span className="text-xs font-mono font-extrabold text-amber-900 block mt-0.5">
                            {contact.phone}
                          </span>
                        )}
                      </div>

                      {contact.phone && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`tel:${contact.phone.replace(/[\s-]/g, '')}`}
                            className="p-2 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors font-bold text-xs cursor-pointer"
                            title="Call Officer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleCopyPhone(contact.phone!)}
                            className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-xs font-bold cursor-pointer"
                            title="Copy Phone Number"
                          >
                            {copiedPhone === contact.phone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* General Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Location Details */}
              <div className="md:col-span-6 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">State & Location</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">State / Territory</span>
                  <span className="text-[14px] font-extrabold text-slate-900 mt-0.5">
                    {item.state || 'India'}
                  </span>
                </div>

                {item.category_name && (
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Procurement Category</span>
                    <span className="text-[13.5px] font-bold text-indigo-800 mt-0.5">{item.category_name}</span>
                  </div>
                )}
              </div>

              {/* Bidding Schedule & Dates */}
              <div className="md:col-span-6 bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Bid Submission Timeline</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Bid Start Date</span>
                  <span className="text-[13.5px] font-extrabold text-blue-950 mt-0.5">{safeDateStr(item.start_date)}</span>
                </div>

                <div className="flex flex-col border-t border-slate-100 pt-2">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Bid End Date</span>
                  <span className="text-[13.5px] font-extrabold text-amber-900 mt-0.5">{safeDateStr(item.end_date)}</span>
                </div>

                <div className="flex flex-col border-t border-slate-100 pt-2">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bid Status</span>
                  <div>
                    {isClosed ? (
                      <span className="inline-block font-black text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 bg-slate-100">
                        BID SUBMISSION CLOSED
                      </span>
                    ) : isLive ? (
                      <span className="inline-block font-black text-xs px-2.5 py-1 rounded-md border border-emerald-300 text-emerald-800 bg-emerald-100 animate-pulse">
                        LIVE PROCUREMENT BID
                      </span>
                    ) : (
                      <span className="inline-block font-black text-xs px-2.5 py-1 rounded-md border border-blue-300 text-blue-800 bg-blue-100">
                        UPCOMING BID
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Bidding Timeline Countdown Banner */}
            <div className="bg-indigo-50/70 border border-indigo-150 rounded-2xl p-4 flex items-center justify-between text-indigo-950 shadow-3xs">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                Bidding Timeline
              </span>
              <span className="font-black text-sm sm:text-base tracking-wide flex items-center gap-2 text-indigo-900">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping shrink-0" />
                {countdownStr}
              </span>
            </div>

            {/* Items & Specifications Summary */}
            {item.items && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-slate-400" /> Items & Procurement Scope
                </h4>
                <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-150 leading-relaxed whitespace-pre-wrap">
                  {item.items}
                </p>
              </div>
            )}

            {/* Official Bid Documents List */}
            {availableDocs.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Official GeM Bid Documents & Attachments ({availableDocs.length})</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableDocs.map((doc, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between gap-3 shadow-3xs hover:border-indigo-300 transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate" title={doc.label}>
                            {doc.label}
                          </h5>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            GeM Official Bid PDF
                          </span>
                        </div>
                      </div>

                      {/* Explicit & Simple Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => openInAppViewer(doc.url, `${doc.label}: ${item.items || item.bid_number}`, doc.safeName)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 shadow-3xs transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Preview</span>
                        </button>

                        <a
                          href={doc.downloadUrl}
                          download={doc.safeName}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Panel: Clean Document Action Card (No Iframe Preview) */}
          {(itemImage || availableDocs.length > 0) && (
            <div className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 p-5 overflow-visible lg:overflow-y-auto flex flex-col space-y-5">
              
              {/* Category Reference Image */}
              {itemImage && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">
                    <span>Category Reference Image</span>
                  </h4>
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video border border-slate-200 shadow-2xs">
                    <img
                      src={itemImage}
                      alt={item.items || item.bid_number}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

              {/* Sleek Document Action Card without embedded iframe */}
              {availableDocs.length > 0 && primaryDoc && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>Official Bid Document</span>
                    <span className="text-[9.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded">
                      {availableDocs.length} Docs
                    </span>
                  </h4>

                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 rounded-2xl p-5 text-white border border-slate-800 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="p-3.5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0 shadow-inner">
                        <FileText className="w-8 h-8" />
                      </div>
                      <span className="text-[10px] font-black tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shrink-0">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Verified PDF Bid
                      </span>
                    </div>

                    <div className="space-y-1 relative z-10">
                      <h5 className="text-sm sm:text-base font-extrabold text-slate-100 line-clamp-2 leading-snug">
                        {primaryDoc.label}
                      </h5>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        Official Government e-Procurement Bid Document
                      </span>
                    </div>

                    {/* Prominent Action Buttons */}
                    <div className="flex flex-col gap-2.5 pt-2 relative z-10">
                      <button
                        onClick={() => openInAppViewer(primaryDoc.url, `${primaryDoc.label}: ${item.items || item.bid_number}`, primaryDoc.safeName)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer shadow-md"
                      >
                        <Eye className="w-4 h-4 text-indigo-600" />
                        <span>Preview Document in Fullscreen</span>
                      </button>

                      <a
                        href={primaryDoc.downloadUrl}
                        download={primaryDoc.safeName}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all cursor-pointer shadow-md border border-indigo-400/30"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Official PDF Document</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-all cursor-pointer text-center"
          >
            Close Details
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {primaryDoc && (
              <>
                <button
                  onClick={() => openInAppViewer(primaryDoc.url, `${primaryDoc.label}: ${item.items || item.bid_number}`, primaryDoc.safeName)}
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2.5 px-5 rounded-xl text-sm font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-xs active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Bid Document
                </button>

                <a
                  href={primaryDoc.downloadUrl}
                  download={primaryDoc.safeName}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex justify-center items-center py-2.5 px-5 rounded-xl text-sm font-bold text-white bg-slate-950 hover:bg-primary hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Official PDF
                </a>
              </>
            )}
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
    </div>
  );
};
