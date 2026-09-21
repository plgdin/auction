import { useState, useEffect, useMemo, memo } from 'react';
import { 
  Eye, 
  MapPin, 
  Calendar, 
  Clock, 
  Landmark, 
  Copy, 
  Check, 
  Info,
  FileText
} from 'lucide-react';
import { ButtonWithIconDemo } from '../ui/button-with-icon';
import type { GemAuction } from '../../services/publicService';
import clsx from 'clsx';
import { storageService } from '../../services/storageService';
import { useAppStore } from '../../store/appStore';
import { formatPrice, formatPriceString } from '../../utils/currency';
import { cleanCategoryName } from '../../utils/cleanCategory';

interface GemCardProps {
  item: GemAuction;
  isGrid?: boolean;
  onPreview: (item: GemAuction) => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
  distanceKm?: number | null;
}

export const GemCard = memo(function GemCard({
  item,
  isGrid = true,
  onPreview,
  isInterested = false,
  onInterestedToggle,
  distanceKm,
}: GemCardProps) {
  const effectiveDistance = distanceKm ?? (item as any)?._distanceKm;
  const { currency } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [signedDisplayImage, setSignedDisplayImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [highResLoaded, setHighResLoaded] = useState(false);

  const shortId = item.gem_auction_id || item.id?.substring(0, 8) || 'N/A';
  const cleanAuctionId = (item.gem_auction_id || item.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const hasDocument = Boolean(item.document_url || (item.document_urls && item.document_urls.length > 0) || item.documents_archived);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.gem_auction_id || item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Resolve genuine government scanned catalog image from storage or URL
  const rawDisplayImage = useMemo(() => {
    const raw = (item as any).preview_url || (item as any).image_url;
    if (raw && typeof raw === 'string') {
      if (
        !raw.includes('unsplash.com') &&
        !raw.includes('pexels.com') &&
        !raw.includes('pixabay.com') &&
        !raw.includes('freepik.com') &&
        !raw.includes('stock') &&
        !raw.includes('placeholder')
      ) {
        return raw;
      }
    }
    return (item.documents_archived || item.document_url) ? `gem-previews/${cleanAuctionId}_0.jpg` : null;
  }, [item, cleanAuctionId]);

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
      if (rawDisplayImage.startsWith('http') || rawDisplayImage.startsWith('data:')) {
        setSignedDisplayImage(rawDisplayImage);
        setImageLoading(false);
        return;
      }
      try {
        const signed = await storageService.getSignedUrls([rawDisplayImage]);
        if (!cancelled) {
          setSignedDisplayImage(signed[0] || null);
          setImageLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSignedDisplayImage(null);
          setImageLoading(false);
        }
      }
    }
    resolveImage();
    return () => {
      cancelled = true;
    };
  }, [rawDisplayImage]);

  // Price formatting
  const formattedPrice = useMemo(() => {
    if (item.reserve_price_value_min && item.reserve_price_value_max) {
      return `${formatPrice(item.reserve_price_value_min, currency)} - ${formatPrice(item.reserve_price_value_max, currency)}`;
    }
    if (item.reserve_price_value) {
      return formatPrice(item.reserve_price_value, currency);
    }
    return item.reserve_price_text ? formatPriceString(item.reserve_price_text, currency) : 'No Reserve Price';
  }, [item, currency]);

  // Safe dates parser
  const parseSafeDate = (dStr?: string | null): Date | null => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const startDate = parseSafeDate(item.auction_start_date);
  const endDate = parseSafeDate(item.auction_end_date);
  const now = new Date();

  const isClosed = (endDate && now > endDate) || item.auction_status === 'closed';
  const isStarted = !isClosed && ((startDate && now >= startDate && (!endDate || now <= endDate)) || item.auction_status === 'live');

  const diffMs = startDate ? startDate.getTime() - now.getTime() : 0;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = diffDays >= 0 && diffDays < 3;
  const isWarning = diffDays >= 3 && diffDays < 7;

  const timeLeftBadge = isClosed ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 bg-slate-50">
      Bid Closed
    </span>
  ) : isStarted ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50 animate-pulse flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
      </span>
      Bidding Started
    </span>
  ) : startDate ? (
    <span className={clsx(
      "font-bold text-xs px-2.5 py-1 rounded-md border flex items-center gap-1",
      isUrgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" :
        isWarning ? "text-amber-700 bg-amber-50 border-amber-200" :
          "text-emerald-700 bg-emerald-50 border-emerald-200"
    )}>
      <Clock className="w-3.5 h-3.5" />
      Starts in {diffDays}d {diffHours}h
    </span>
  ) : (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 bg-slate-50">
      Scheduled
    </span>
  );

  const biddingPeriodStr = useMemo(() => {
    if (!startDate && !endDate) return 'See Official Tender Document';
    const formatDateOrdinal = (d: Date) => {
      const day = d.getDate();
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const year = d.getFullYear();
      const suffixes = ['th', 'st', 'nd', 'rd'];
      const suffix = (day < 11 || day > 13) ? (suffixes[day % 10] ?? 'th') : 'th';
      return `${day}${suffix} ${month} ${year}`;
    };

    const formatTimeAmpm = (d: Date) => {
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    };

    if (startDate && endDate) {
      const startDay = formatDateOrdinal(startDate);
      const endDay = formatDateOrdinal(endDate);
      if (startDay === endDay) {
        return `${startDay} ${formatTimeAmpm(startDate)} - ${formatTimeAmpm(endDate)}`;
      }
      return `${startDay} - ${endDay}`;
    }
    if (endDate) return `Ends on ${formatDateOrdinal(endDate)} ${formatTimeAmpm(endDate)}`;
    if (startDate) return `Starts on ${formatDateOrdinal(startDate)}`;
    return 'See Official Tender Document';
  }, [startDate, endDate]);

  const locationDisplay = [item.city, item.district && item.district !== item.city ? item.district : null, item.state || item.location].filter(Boolean).join(', ') || 'India (National)';
  const orgName = item.organisation || item.department || 'Government Entity / PSU';
  const mainCategory = cleanCategoryName(item.category_name, item.title);

  const renderCardHeader = () => {
    if (isGrid) {
      return (
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg shrink-0">
                <span className="text-xs font-semibold text-slate-500 font-mono">
                  Ref ID: {shortId}
                </span>
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-primary transition-colors shrink-0 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer flex items-center justify-center"
                  title="Copy reference number to clipboard"
                  aria-label="Copy reference number"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {item.is_reauction && (
              <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-2xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                Re-auction
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-start">
            {item.emd_amount != null && item.emd_amount > 0 && (
              <span className="bg-amber-50 border border-amber-200/60 text-amber-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                EMD: {formatPrice(item.emd_amount, currency)}
              </span>
            )}
            {hasDocument && (
              <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                Document Online
              </span>
            )}
            {signedDisplayImage && (
              <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                Images Available
              </span>
            )}
            {item.items_schedule && item.items_schedule.length > 0 && (
              <span className="bg-blue-50 border border-blue-200/60 text-blue-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
                {item.items_schedule.length} {item.items_schedule.length === 1 ? 'Lot' : 'Lots'} Listed
              </span>
            )}
          </div>
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
              title="Copy reference number to clipboard"
              aria-label="Copy reference number"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {item.is_reauction && (
            <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-2xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Re-auction
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {hasDocument && (
            <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-3xs uppercase tracking-wide text-right shrink-0">
              Document Online
            </span>
          )}
          {signedDisplayImage && (
            <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-3xs uppercase tracking-wide text-right shrink-0">
              Images Available
            </span>
          )}
        </div>
      </div>
    );
  };

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!isGrid) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all group relative">
        <div className="p-5 flex flex-col sm:flex-row gap-5 justify-between">
          {imageLoading ? (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-100 overflow-hidden shrink-0 bg-slate-100 animate-pulse hidden sm:block"></div>
          ) : signedDisplayImage ? (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-100 overflow-hidden shrink-0 bg-slate-50 relative hidden sm:block">
              <img
                src={signedDisplayImage}
                alt={item.title}
                loading="lazy"
                decoding="async"
                onError={() => setSignedDisplayImage(null)}
                onLoad={() => setHighResLoaded(true)}
                className={clsx(
                  "w-full h-full object-cover object-top transition-all duration-500 ease-out",
                  !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                  "group-hover:scale-[1.03]"
                )}
              />
            </div>
          ) : hasDocument ? (
            <div 
              onClick={() => onPreview(item)}
              className="w-[120px] h-[120px] rounded-xl border border-slate-300 shrink-0 bg-white p-1.5 cursor-pointer hidden sm:flex flex-col justify-between group/doc select-none shadow-2xs hover:border-primary transition-all duration-200"
              title="Click to view official document"
            >
              <div className="w-full h-full border border-slate-800 p-1 flex flex-col justify-between bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-0.5">
                  <span className="text-[6.5px] font-bold text-amber-900 border border-amber-600/80 px-0.5 leading-none">EK KAAM</span>
                  <span className="text-[6.5px] font-bold text-emerald-800 border border-slate-700 px-0.5 leading-none">INDIA</span>
                </div>
                <div className="bg-slate-200 border-y border-slate-800 py-0.5 text-center text-[7.5px] font-bold font-serif text-slate-900 uppercase">
                  Catalogue
                </div>
                <div className="border border-slate-800 text-[6.5px] font-serif divide-y divide-slate-800">
                  <div className="flex divide-x divide-slate-800">
                    <span className="font-bold w-7 shrink-0 px-0.5 bg-slate-100 text-slate-900">No:</span>
                    <span className="px-0.5 text-slate-900 truncate font-mono">{shortId}</span>
                  </div>
                  <div className="flex divide-x divide-slate-800">
                    <span className="font-bold w-7 shrink-0 px-0.5 bg-slate-100 text-slate-900">Type:</span>
                    <span className="px-0.5 text-slate-900 truncate">O-General</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-200 shrink-0 bg-slate-50 flex flex-col items-center justify-center text-slate-400 select-none hidden sm:flex gap-1.5">
              <FileText className="w-6 h-6 text-slate-400" />
              <span className="text-[9px] font-medium tracking-wide text-slate-500 text-center px-1.5 leading-tight">Refer the document</span>
            </div>
          )}

          <div className="flex-1 flex flex-col justify-between">
            <div>
              {renderCardHeader()}

              <div className="mb-3">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
                <h3 
                  onClick={() => onPreview(item)}
                  className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2 cursor-pointer" 
                  title={item.title}
                >
                  {item.title}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-slate-600" title={orgName}>
                    <Landmark className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">
                      Office: {orgName}
                    </span>
                  </div>
                  <div className="flex items-center text-slate-600 gap-1.5 flex-wrap" title={locationDisplay}>
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">{locationDisplay}</span>
                    {effectiveDistance !== undefined && effectiveDistance !== null && (
                      <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0 shadow-2xs">
                        {Math.round(effectiveDistance)} km away
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                  <div className="flex items-center text-slate-700">
                    <span className="flex items-center gap-1">
                      <span>Reserve Price: <strong className="text-slate-700 font-semibold">{formattedPrice}</strong></span>
                      <div className="relative group/tooltip inline-block ml-0.5">
                        <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                          Official reserve or base price for this auction.
                          <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                        </div>
                      </div>
                    </span>
                  </div>
                  <div className="flex items-center text-slate-700">
                    <span className="flex items-center gap-1">
                      <span>Pre-bid EMD: <strong className="text-slate-700 font-semibold">{item.emd_amount != null && item.emd_amount > 0 ? formatPrice(item.emd_amount, currency) : (item.department || 'Not Stated')}</strong></span>
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
                    <span>Bidding Window: <strong className="text-slate-700 font-semibold">{biddingPeriodStr}</strong></span>
                  </div>
                  <div className="flex items-center text-slate-700">
                    <Clock className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span>Inspection: <strong className="text-slate-700 font-semibold">{item.inspection_date || 'See Tender Notice'}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
              <div>
                {timeLeftBadge}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => onPreview(item)}
                  className="flex-grow sm:flex-none inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </button>

                {onInterestedToggle && (
                  <ButtonWithIconDemo
                    isInterested={isInterested}
                    onInterestedToggle={onInterestedToggle}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatGovDate = (dStr?: string | null): string => {
    if (!dStr) return '17-08-2026 15:00:00';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const formatSimpleDate = (dStr?: string | null): string => {
    if (!dStr) return '06-08-2026';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  };

  // Renders authentic official GeM Auction Document preview (matching official GeM portal document)
  const renderDocumentSheetPreview = () => {
    const datedStr = formatSimpleDate(item.created_at || item.scraped_at || item.auction_start_date);
    const endDateTimeStr = formatGovDate(item.auction_end_date);
    const startDateTimeStr = formatGovDate(item.auction_start_date);
    const ministryName = item.ministry || (item.state ? `Govt of ${item.state}` : 'Government of India');
    const departmentName = item.department || 'Government Department';
    const organisationName = item.organisation || orgName;

    return (
      <div 
        onClick={() => onPreview(item)}
        className="w-full h-full bg-slate-100 p-2 overflow-hidden flex flex-col justify-start select-none group/doc shadow-2xs hover:border-primary transition-all duration-200 cursor-pointer"
        title="Click to view official GeM Auction Document"
      >
        {/* Official A4 Document Sheet with border */}
        <div className="w-full h-full border border-slate-900 bg-white p-2 flex flex-col justify-between overflow-hidden">
          {/* Top Header */}
          <div className="flex items-start justify-between border-b border-slate-300 pb-1">
            {/* Left: GeM Logo + 75 Azadi Ka Amrit Mahotsav */}
            <div className="flex items-center">
              {/* GeM Multi-color Star Logo */}
              <div className="flex items-center gap-1">
                <svg viewBox="0 0 40 40" className="w-5 h-5 shrink-0">
                  <polygon points="20,4 25,16 16,13" fill="#E65100" />
                  <polygon points="20,4 32,10 25,16" fill="#FBC02D" />
                  <polygon points="32,10 36,22 25,16" fill="#4CAF50" />
                  <polygon points="36,22 28,30 25,16" fill="#00ACC1" />
                  <polygon points="28,30 20,36 21,23" fill="#1E88E5" />
                  <polygon points="20,36 12,30 21,23" fill="#5E35B1" />
                  <polygon points="12,30 4,22 16,19" fill="#8E24AA" />
                  <polygon points="4,22 8,10 16,13" fill="#D81B60" />
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] font-black tracking-tight text-slate-800 font-sans">GeM</span>
                  <span className="text-[4.5px] font-semibold text-slate-500 tracking-tighter">Government<br/>e Marketplace</span>
                </div>
              </div>

              {/* 75 Azadi Ka Amrit Mahotsav Logo */}
              <div className="flex items-center gap-0.5 border-l border-slate-300 pl-1.5 ml-1.5">
                <div className="flex flex-col leading-none">
                  <span className="text-[7.5px] font-black text-slate-800 italic">75<span className="text-amber-600 text-[5.5px]">th</span></span>
                  <div className="flex h-[2px] w-5 rounded-[0.5px] overflow-hidden my-0.5">
                    <span className="bg-[#FF9933] w-1/3 h-full"></span>
                    <span className="bg-white w-1/3 h-full border-x border-slate-300"></span>
                    <span className="bg-[#138808] w-1/3 h-full"></span>
                  </div>
                  <span className="text-[4px] font-bold text-slate-600 tracking-tighter leading-tight">Azadi Ka<br/>Amrit Mahotsav</span>
                </div>
              </div>
            </div>

            {/* Right: नीलामी संख्या/Auction Number & दिनांक /Dated */}
            <div className="text-right leading-tight font-sans">
              <div className="text-[6.5px] font-semibold text-slate-800">
                <span className="text-slate-600">नीलामी संख्या/Auction No: </span>
                <span className="font-mono font-bold text-slate-950">{shortId}</span>
              </div>
              <div className="text-[6.5px] text-slate-600 mt-0.5">
                <span>दिनांक /Dated: </span>
                <span className="font-semibold text-slate-800">{datedStr}</span>
              </div>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center font-bold text-[8px] text-slate-950 font-sans py-0.5 tracking-wide">
            नीलामी दस्तावेज़ / Auction Document
          </div>

          {/* Official Document Details Table */}
          <div className="border border-slate-800 text-[6.5px] font-sans bg-white divide-y divide-slate-800">
            {/* Header row */}
            <div className="bg-white py-0.5 text-center font-bold text-[7px] text-slate-900 border-b border-slate-800">
              नीलामी विवरण/Auction Details
            </div>

            {/* Row 1: End Date/Time */}
            <div className="flex divide-x divide-slate-800">
              <span className="font-bold w-[125px] shrink-0 px-1 py-0.5 text-slate-900 bg-white leading-tight">
                नीलामी बंद होने की तारीख/समय /End Date/Time
              </span>
              <span className="px-1 py-0.5 text-slate-900 font-mono font-semibold truncate leading-tight flex items-center">
                {endDateTimeStr}
              </span>
            </div>

            {/* Row 2: Opening Date/Time */}
            <div className="flex divide-x divide-slate-800">
              <span className="font-bold w-[125px] shrink-0 px-1 py-0.5 text-slate-900 bg-white leading-tight">
                नीलामी खुलने की तारीख/समय /Opening Date/Time
              </span>
              <span className="px-1 py-0.5 text-slate-900 font-mono font-semibold truncate leading-tight flex items-center">
                {startDateTimeStr}
              </span>
            </div>

            {/* Row 3: Ministry Name */}
            <div className="flex divide-x divide-slate-800">
              <span className="font-bold w-[125px] shrink-0 px-1 py-0.5 text-slate-900 bg-white leading-tight">
                मंत्रालय/राज्य का नाम/Ministry/State Name
              </span>
              <span className="px-1 py-0.5 text-slate-900 font-medium truncate leading-tight flex items-center">
                {ministryName}
              </span>
            </div>

            {/* Row 4: Department Name */}
            <div className="flex divide-x divide-slate-800">
              <span className="font-bold w-[125px] shrink-0 px-1 py-0.5 text-slate-900 bg-white leading-tight">
                विभाग का नाम/Department Name
              </span>
              <span className="px-1 py-0.5 text-slate-900 font-medium truncate leading-tight flex items-center">
                {departmentName}
              </span>
            </div>

            {/* Row 5: Organisation Name */}
            <div className="flex divide-x divide-slate-800">
              <span className="font-bold w-[125px] shrink-0 px-1 py-0.5 text-slate-900 bg-white leading-tight">
                संगठन का नाम/Organisation Name
              </span>
              <span className="px-1 py-0.5 text-slate-900 font-medium truncate leading-tight flex items-center">
                {organisationName}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── GRID VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all group flex flex-col h-full relative">
      <div className="flex flex-col h-full p-5 justify-between">
        <div>
          {/* Card Image / Document Catalogue Header (Exact MSTC Catalogue Preview Style) */}
          <div className="h-[160px] w-full overflow-hidden rounded-xl border border-slate-100 mb-4 bg-slate-50 relative">
            {imageLoading ? (
              <div className="w-full h-full bg-slate-100 animate-pulse"></div>
            ) : signedDisplayImage ? (
              <img
                src={signedDisplayImage}
                alt={item.title}
                loading="lazy"
                decoding="async"
                onError={() => setSignedDisplayImage(null)}
                onLoad={() => setHighResLoaded(true)}
                className={clsx(
                  "w-full h-full object-cover object-top transition-all duration-500 ease-out",
                  !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                  "group-hover:scale-[1.02]"
                )}
              />
            ) : hasDocument ? (
              renderDocumentSheetPreview()
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 select-none bg-slate-50/50">
                <FileText className="w-8 h-8 text-slate-300" />
                <span className="text-[11px] font-medium tracking-wide text-slate-500">Refer the document</span>
              </div>
            )}
          </div>

          {renderCardHeader()}

          <div className="mb-3">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
            <h3 
              onClick={() => onPreview(item)}
              className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2 cursor-pointer" 
              title={item.title}
            >
              {item.title}
            </h3>
          </div>

          {/* Structured Metadata Grid */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs sm:text-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Organisation</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={orgName}>
                {orgName}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Location</span>
                {effectiveDistance !== undefined && effectiveDistance !== null && (
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                    {Math.round(effectiveDistance)} km
                  </span>
                )}
              </span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={locationDisplay}>
                {locationDisplay}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Reserve Price</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Official reserve or base price for this auction.
                    <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={formattedPrice}>
                {formattedPrice}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Department</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Department or administrative division hosting the auction.
                    <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={item.department || item.ministry || 'Government of India'}>
                {item.department || item.ministry || 'Government of India'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5 col-span-2">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Portal Scheme</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-52 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Government of India e-Marketplace Forward Disposal Auction.
                    <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title="GeM Forward Auction (Government of India)">
                GeM Forward Auction (Government of India)
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mb-4 text-sm text-slate-500 border-t border-slate-50 pt-3">
            <div className="flex justify-between">
              <span>Bidding Window:</span>
              <span className="font-semibold text-slate-700">
                {biddingPeriodStr}
              </span>
            </div>
            {item.inspection_date && (
              <div className="flex justify-between">
                <span>Inspection Period:</span>
                <span className="font-semibold text-slate-700">{item.inspection_date}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card Footer */}
        <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 mt-auto">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-medium">Auction Status</span>
            {timeLeftBadge}
          </div>

          <div className="flex gap-2 w-full mt-1">
            <button
              onClick={() => onPreview(item)}
              className="flex-grow inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </button>

            {onInterestedToggle && (
              <ButtonWithIconDemo
                isInterested={isInterested}
                onInterestedToggle={onInterestedToggle}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
