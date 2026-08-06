import { useState, useEffect, useMemo, memo } from 'react';
import { Eye, MapPin, Building2, Calendar, Clock, ShieldCheck, Landmark, Copy, Check, Gavel, Info, Lock } from 'lucide-react';
import { ButtonWithIconDemo } from '../ui/button-with-icon';
import { expandMstcOffice } from '../../services/publicService';
import type { MstcSanitizedAuction } from '../../services/publicService';
import { generateCatalogSummary, parsePdfDateTime, hasConfirmedAssetDocuments } from '../../utils/mstcHelpers';
import clsx from 'clsx';
import { storageService } from '../../services/storageService';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { formatPriceString } from '../../utils/currency';

interface MstcCardProps {
  item: MstcSanitizedAuction;
  isGrid?: boolean;
  onPreview: (item: MstcSanitizedAuction) => void;
  isInterested?: boolean;
  onInterestedToggle?: (id: string) => void;
}

export const MstcCard = memo(function MstcCard({ item, isGrid = true, onPreview, isInterested = false, onInterestedToggle }: MstcCardProps) {
  const { currency } = useAppStore();
  const shortId = (item?.mstc_auction_number || '').split('/').pop() || item?.id?.substring(0, 8) || 'N/A';
  // Calculate summary asynchronously to prevent main-thread blocking when rendering many cards
  const [summary, setSummary] = useState<ReturnType<typeof generateCatalogSummary> | null>(null);

  useEffect(() => {
    let isMounted = true;
    // Defer the heavy parsing task to allow the UI to paint first
    const timer = setTimeout(() => {
      if (isMounted) {
        setSummary(generateCatalogSummary(item));
      }
    }, 10); // Small delay to let React commit the initial DOM

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [item]);

  // Distinguish actual item photos from document page preview images
  const actualPhotos = useMemo(() => {
    if (!summary) return [];
    return (summary.extracted_images || []).filter(
      (url: string) => !url.toLowerCase().includes('_catalog_page_') && !url.toLowerCase().includes('_page_') && !url.toLowerCase().includes('mstc-previews/') && !url.toLowerCase().endsWith('.pdf')
    );
  }, [summary?.extracted_images]);

  const hasOtherMedia = (summary?.extracted_images || []).length > 0;
  const fallbackPreview = item.sanitized_document_path ? `mstc-previews/${item.id}.jpg` : null;
  const rawDisplayImage = useMemo(() => {
    if (actualPhotos.length > 0) return actualPhotos[0];
    if (summary?.preview_image_url) return summary.preview_image_url;

    // Look for any catalog pages inside extracted_images
    const catalogPages = (summary?.extracted_images || []).filter(
      (url: string) => (url.toLowerCase().includes('_catalog_page_') || url.toLowerCase().includes('_page_') || url.toLowerCase().includes('mstc-previews/')) && !url.toLowerCase().endsWith('.pdf')
    );
    if (catalogPages.length > 0) return catalogPages[0];

    return fallbackPreview;
  }, [actualPhotos, summary, fallbackPreview]);

  const [signedDisplayImage, setSignedDisplayImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [highResLoaded, setHighResLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolveImage() {
      setImageLoading(true);
      setHighResLoaded(false);
      if (!rawDisplayImage) {
        setSignedDisplayImage(null);
        setImageLoading(false);
        return;
      }
      const signed = await storageService.getSignedUrls([rawDisplayImage]);
      if (!cancelled) {
        setSignedDisplayImage(signed[0] || null);
        setImageLoading(false);
      }
    }
    resolveImage();
    return () => { cancelled = true; };
  }, [rawDisplayImage]);

  const parts = (item?.mstc_auction_number || '').split('/');
  const rawOffice = parts.length > 1 && parts[0].toUpperCase() === 'MSTC' ? parts[1] : item?.seller_name || '';
  const regionalOfficeName = expandMstcOffice(rawOffice);
  const locationName = expandMstcOffice(item?.location);

  // Parse start and close dates
  const parsedStartDate = summary?.auctionStartTime ? parsePdfDateTime(summary.auctionStartTime) : null;
  const auctionDate = parsedStartDate || new Date(item.opening_date);

  const parsedCloseDate = summary?.auctionCloseTime ? parsePdfDateTime(summary.auctionCloseTime) : null;

  const biddingPeriodStr = (() => {
    const startDate = parsedStartDate || new Date(item.opening_date);
    const endDate = parsedCloseDate || new Date(item.closing_date);

    const formatDateOrdinal = (d: Date) => {
      const day = d.getDate();
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const year = d.getFullYear();

      let suffix = 'th';
      if (day < 11 || day > 13) {
        switch (day % 10) {
          case 1: suffix = 'st'; break;
          case 2: suffix = 'nd'; break;
          case 3: suffix = 'rd'; break;
        }
      }
      return `${day}${suffix} ${month} ${year}`;
    };

    const formatTimeAmpm = (d: Date) => {
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    };

    const startDayStr = formatDateOrdinal(startDate);
    const endDayStr = formatDateOrdinal(endDate);

    const startTimeStr = formatTimeAmpm(startDate);
    const endTimeStr = formatTimeAmpm(endDate);

    if (startDayStr === endDayStr) {
      return `${startDayStr} ${startTimeStr} - ${endTimeStr}`;
    } else {
      return `${startDayStr} ${startTimeStr} - ${endDayStr} ${endTimeStr}`;
    }
  })();

  const now = new Date();
  const diffMs = auctionDate.getTime() - now.getTime();
  const isStarted = diffMs <= 0;
  const isClosed = parsedCloseDate ? (now.getTime() > parsedCloseDate.getTime()) : false;

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = diffDays < 3;
  const isWarning = diffDays < 7;

  const timeLeftBadge = isClosed ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 bg-slate-50">
      Bid Closed
    </span>
  ) : isStarted ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50 animate-pulse">
      Bidding Started
    </span>
  ) : (
    <span className={clsx(
      "font-bold text-xs px-2.5 py-1 rounded-md border flex items-center gap-1",
      isUrgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" :
        isWarning ? "text-amber-700 bg-amber-50 border-amber-200" :
          "text-emerald-700 bg-emerald-50 border-emerald-200"
    )}>
      <Clock className="w-3.5 h-3.5" />
      Starts in {diffDays}d {diffHours}h
    </span>
  );

  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.mstc_auction_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { profile, isAuthenticated } = useAuthStore();
  const isBusinessUser = (isAuthenticated && profile?.subscription_plan === 'pro') || profile?.role === 'admin' || profile?.role === 'superadmin';

  const renderCardHeader = () => {
    if (isGrid) {
      return (
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg shrink-0">
              <span className="text-xs font-semibold text-slate-500 font-mono">
                Ref ID: {shortId}
              </span>
              <button
                onClick={handleCopy}
                className="text-slate-400 hover:text-primary transition-colors shrink-0 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer flex items-center justify-center"
                title="Copy full reference number to clipboard"
                aria-label="Copy reference number"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {isBusinessUser && item.is_reauction && (
              <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-2xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                Re-auction
              </span>
            )}
          </div>
          {(hasConfirmedAssetDocuments(item.raw_materials_text) || hasOtherMedia) && (
            <div className="flex flex-wrap gap-1.5 justify-start">
              {hasConfirmedAssetDocuments(item.raw_materials_text) && (
                <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                  Asset docs available
                </span>
              )}
              {hasOtherMedia && (
                <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                  Images available
                </span>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg shrink-0">
            <span className="text-xs font-semibold text-slate-500 font-mono">
              Ref ID: {shortId}
            </span>
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-primary transition-colors shrink-0 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer flex items-center justify-center"
              title="Copy full reference number to clipboard"
              aria-label="Copy reference number"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          {isBusinessUser && item.is_reauction && (
            <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-2xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Re-auction
            </span>
          )}
        </div>
        {(hasConfirmedAssetDocuments(item.raw_materials_text) || hasOtherMedia) && (
          <div className="flex flex-col items-end gap-1.5">
            {hasConfirmedAssetDocuments(item.raw_materials_text) && (
              <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-3xs uppercase tracking-wide text-right shrink-0">
                Asset documents available
              </span>
            )}
            {hasOtherMedia && (
              <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-3xs uppercase tracking-wide text-right shrink-0">
                Images available
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const isBlurOverlay = false;

  if (!isGrid) {
    // LIST VIEW
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all group relative">
        <div className={clsx("p-5 flex flex-col sm:flex-row gap-5 justify-between", isBlurOverlay && "blur-[6px] select-none pointer-events-none")}>
        {imageLoading ? (
          <div className="w-[120px] h-[120px] rounded-xl border border-slate-100 overflow-hidden shrink-0 bg-slate-100 animate-pulse hidden sm:block"></div>
        ) : signedDisplayImage ? (
          <div className="w-[120px] h-[120px] rounded-xl border border-slate-100 overflow-hidden shrink-0 bg-slate-50 relative hidden sm:block">
            <img
              src={signedDisplayImage}
              alt="Catalog Image"
              loading="lazy"
              decoding="async"
              onLoad={() => setHighResLoaded(true)}
              className={clsx(
                "w-full h-full object-cover object-top transition-all duration-500 ease-out",
                !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                "group-hover:scale-[1.03]"
              )}
            />
          </div>
        ) : (
          <div className="w-[120px] h-[120px] rounded-xl border border-slate-200 shrink-0 bg-slate-50 flex flex-col items-center justify-center text-slate-400 select-none hidden sm:flex gap-1.5">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span className="text-[9px] font-medium tracking-wide text-slate-400 text-center px-1.5 leading-tight">No pictures available</span>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-between">
          <div>
            {renderCardHeader()}

            {(() => {
              const parts = (item?.category_name || '').split(' | ');
              const mainCat = parts[0] || 'Unknown';
              const subCat = parts[1];
              return (
                <div className="mb-3">
                  {subCat ? (
                    <>
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCat}</div>
                      <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                        {subCat}
                      </h3>
                    </>
                  ) : (
                    <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                      {mainCat}
                    </h3>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-slate-600" title={regionalOfficeName}>
                  <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700 truncate text-base">
                    Office: {regionalOfficeName}
                  </span>
                </div>
                {item.location && (
                  <div className="flex items-center text-slate-600" title={locationName}>
                    <MapPin className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">{locationName}</span>
                  </div>
                )}
                <div className="flex items-center text-slate-600" title={summary?.auctionType || 'O-General'}>
                  <Gavel className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700 truncate text-base">
                    Type: {summary?.auctionType || 'O-General'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                <div className="flex items-center text-slate-700">
                  <Landmark className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span className="flex items-center gap-1">
                    <span>EMD: <strong className="text-slate-700 font-semibold">{summary?.depositDetails?.emd ? formatPriceString(summary.depositDetails.emd, currency) : 'Loading...'}</strong></span>
                    <div className="relative group/tooltip inline-block ml-0.5">
                      <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                      <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                        Earnest Money Deposit required to bid on this auction.
                        <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                      </div>
                    </div>
                  </span>
                </div>
                <div className="flex items-center text-slate-700">
                  <ShieldCheck className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span className="flex items-center gap-1">
                    <span>Pre-bid: <strong className="text-slate-700 font-semibold">{summary?.depositDetails?.preBidDdg ? formatPriceString(summary.depositDetails.preBidDdg, currency) : 'Loading...'}</strong></span>
                    <div className="relative group/tooltip inline-block ml-0.5">
                      <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                      <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                        Mandatory deposit required prior to auction start.
                        <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                      </div>
                    </div>
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                <div className="flex items-center text-slate-700">
                  <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span>Bidding Period: <strong className="text-slate-700 font-semibold">{biddingPeriodStr}</strong></span>
                </div>
                <div className="flex items-center text-slate-700">
                  <Eye className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span>Inspection Period: <strong className="text-slate-700 font-semibold">{summary?.inspectionSchedule || 'Loading...'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
            <div>
              {timeLeftBadge}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {item.sanitized_document_path ? (
                <button
                  onClick={() => onPreview(item)}
                  className="flex-grow sm:flex-none inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </button>
              ) : (
                <button
                  disabled
                  className="flex-grow sm:flex-none inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping mr-2"></span>
                  PDF Processing...
                </button>
              )}

              {onInterestedToggle && (
                <ButtonWithIconDemo
                  isInterested={isInterested}
                  onInterestedToggle={() => onInterestedToggle(item.id)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {isBlurOverlay && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/20">
          <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-xl p-4 shadow-xl max-w-[220px] flex flex-col items-center gap-2 text-center border border-slate-700/50">
            <Lock className="w-6 h-6 text-amber-400" />
            <span className="font-bold text-sm">Premium Feature</span>
            <span className="text-xs text-slate-300">Upgrade your account to view Re-auction details</span>
          </div>
        </div>
      )}
    </div>
  );
}

  // GRID VIEW
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all group flex flex-col h-full relative">
      <div className={clsx("flex flex-col h-full p-5 justify-between", isBlurOverlay && "blur-[6px] select-none pointer-events-none")}>
        <div>
          <div className="h-[160px] w-full overflow-hidden rounded-xl border border-slate-100 mb-4 bg-slate-50 relative">
          {imageLoading ? (
            <div className="w-full h-full bg-slate-100 animate-pulse"></div>
          ) : signedDisplayImage ? (
            <img
              src={signedDisplayImage}
              alt="Catalog Image"
              loading="lazy"
              decoding="async"
              onLoad={() => setHighResLoaded(true)}
              className={clsx(
                "w-full h-full object-cover object-top transition-all duration-500 ease-out",
                !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                "group-hover:scale-[1.02]"
              )}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 select-none bg-slate-50/50">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <span className="text-[11px] font-medium tracking-wide">No pictures available</span>
            </div>
          )}
        </div>
        {renderCardHeader()}

        {(() => {
          const parts = (item?.category_name || '').split(' | ');
          const mainCat = parts[0] || 'Unknown';
          const subCat = parts[1];
          return (
            <div className="mb-3">
              {subCat ? (
                <>
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCat}</div>
                  <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                    {subCat}
                  </h3>
                </>
              ) : (
                <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                  {mainCat}
                </h3>
              )}
            </div>
          );
        })()}

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs sm:text-sm">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Office</span>
            <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={regionalOfficeName}>
              {regionalOfficeName}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Location</span>
            <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={locationName || 'N/A'}>
              {locationName || 'N/A'}
            </span>
          </div>
          <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
              <span>EMD Required</span>
              <div className="relative group/tooltip inline-block">
                <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                  Earnest Money Deposit required to bid on this auction.
                  <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                </div>
              </div>
            </span>
            <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={summary?.depositDetails?.emd ? formatPriceString(summary.depositDetails.emd, currency) : 'Loading...'}>
              {summary?.depositDetails?.emd ? formatPriceString(summary.depositDetails.emd, currency) : 'Loading...'}
            </span>
          </div>
          <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
              <span>Pre-bid EMD</span>
              <div className="relative group/tooltip inline-block">
                <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                  Mandatory deposit required prior to auction start.
                  <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                </div>
              </div>
            </span>
            <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={summary?.depositDetails?.preBidDdg ? formatPriceString(summary.depositDetails.preBidDdg, currency) : 'Loading...'}>
              {summary?.depositDetails?.preBidDdg ? formatPriceString(summary.depositDetails.preBidDdg, currency) : 'Loading...'}
            </span>
          </div>
          <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5 col-span-2">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
              <span>Auction Type</span>
              <div className="relative group/tooltip inline-block">
                <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-52 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                  Category (e.g. C-Customs, O-General, P-Property) dictating bidding rules.
                  <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                </div>
              </div>
            </span>
            <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={summary?.auctionType || 'O-General'}>
              {summary?.auctionType || 'O-General'}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mb-4 text-sm text-slate-500 border-t border-slate-50 pt-3">
          <div className="flex justify-between">
            <span>Bidding Period:</span>
            <span className="font-semibold text-slate-700">
              {biddingPeriodStr}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Inspection Period:</span>
            <span className="font-semibold text-slate-700">{summary?.inspectionSchedule || 'Loading...'}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 mt-auto">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 font-medium">Bidding Window</span>
          {timeLeftBadge}
        </div>

        <div className="flex gap-2 w-full mt-1">
          {item.sanitized_document_path ? (
            <button
              onClick={() => onPreview(item)}
              className="flex-grow inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </button>
          ) : (
            <button
              disabled
              className="flex-grow inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping mr-2"></span>
              PDF Processing...
            </button>
          )}

          {onInterestedToggle && (
            <ButtonWithIconDemo
              isInterested={isInterested}
              onInterestedToggle={() => onInterestedToggle(item.id)}
            />
          )}
        </div>
      </div>
      </div>
      
      {isBlurOverlay && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/20">
          <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-xl p-5 shadow-xl max-w-[220px] flex flex-col items-center gap-2 text-center border border-slate-700/50">
            <Lock className="w-7 h-7 text-amber-400 mb-1" />
            <span className="font-bold text-sm">Premium Feature</span>
            <span className="text-xs text-slate-300">Upgrade your account to view Re-auction details</span>
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.item?.mstc_auction_number === nextProps.item?.mstc_auction_number &&
    prevProps.isGrid === nextProps.isGrid &&
    prevProps.isInterested === nextProps.isInterested &&
    prevProps.onPreview === nextProps.onPreview &&
    prevProps.onInterestedToggle === nextProps.onInterestedToggle
  );
});
