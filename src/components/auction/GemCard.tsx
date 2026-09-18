import { useState, useMemo, memo } from 'react';
import { Eye, MapPin, Calendar, Clock, Landmark, Copy, Check, Gavel, Info, Download, RotateCcw } from 'lucide-react';
import { ButtonWithIconDemo } from '../ui/button-with-icon';
import type { GemAuction } from '../../services/publicService';
import clsx from 'clsx';
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
  const [imageError, setImageError] = useState(false);
  const [highResLoaded, setHighResLoaded] = useState(false);

  const shortId = item.gem_auction_id || item.id?.substring(0, 8) || 'N/A';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.gem_auction_id || item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Only genuine images from GeM portal (official PDF first-page thumbnail or authentic image attachments)
  const realGemImage = useMemo(() => {
    if (item.preview_url) return item.preview_url;

    if (item.discovered_api_attachments && item.discovered_api_attachments.length > 0) {
      const imgAtt = item.discovered_api_attachments.find(
        (a) => a.url && /\.(jpe?g|png|webp)(\?.*)?$/i.test(a.url)
      );
      if (imgAtt) return imgAtt.url;
    }

    if (item.document_urls && item.document_urls.length > 0) {
      const imgDoc = item.document_urls.find(
        (u) => u && /\.(jpe?g|png|webp)(\?.*)?$/i.test(u)
      );
      if (imgDoc) return imgDoc;
    }

    return null;
  }, [item.preview_url, item.discovered_api_attachments, item.document_urls]);

  const hasRealImage = Boolean(realGemImage && !imageError);

  // Price formatting (supports single value or min/max range)
  const formattedPrice = useMemo(() => {
    if (item.reserve_price_value_min && item.reserve_price_value_max) {
      return `${formatPrice(item.reserve_price_value_min, currency)} - ${formatPrice(item.reserve_price_value_max, currency)}`;
    }
    if (item.reserve_price_value) {
      return formatPrice(item.reserve_price_value, currency);
    }
    return item.reserve_price_text ? formatPriceString(item.reserve_price_text, currency) : 'No Reserve Price';
  }, [item, currency]);

  // Dates & Bidding Period
  const parseSafeDate = (dStr?: string | null): Date | null => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const startDate = parseSafeDate(item.auction_start_date);
  const endDate = parseSafeDate(item.auction_end_date);
  const now = new Date();

  const isClosed = (endDate && now > endDate) || item.auction_status === 'closed';
  const isStarted = (startDate && now >= startDate && (!endDate || now <= endDate)) || item.auction_status === 'live';

  const diffMs = startDate ? startDate.getTime() - now.getTime() : 0;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = diffDays >= 0 && diffDays < 3;
  const isWarning = diffDays >= 3 && diffDays < 7;

  const timeLeftBadge = isClosed ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 bg-slate-50">
      Auction Closed
    </span>
  ) : isStarted ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50 animate-pulse flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
      </span>
      Live Auction
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
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50">
      Upcoming Forward Auction
    </span>
  );

  const biddingPeriodStr = useMemo(() => {
    if (!startDate && !endDate) return 'See Official Tender Document';

    const formatDateOrdinal = (d: Date) => {
      try {
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
      } catch {
        return '';
      }
    };

    const formatTimeAmpm = (d: Date) => {
      try {
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        return `${hours ? hours : 12}:${minutes} ${ampm}`;
      } catch {
        return '';
      }
    };

    if (startDate && endDate) {
      const startDay = formatDateOrdinal(startDate);
      const endDay = formatDateOrdinal(endDate);
      if (startDay === endDay) {
        return `${startDay} ${formatTimeAmpm(startDate)} - ${formatTimeAmpm(endDate)}`;
      }
      return `${startDay} - ${endDay}`;
    } else if (endDate) {
      return `Ends on ${formatDateOrdinal(endDate)} ${formatTimeAmpm(endDate)}`;
    } else if (startDate) {
      return `Starts ${formatDateOrdinal(startDate)}`;
    }
    return 'See Official Tender Document';
  }, [startDate, endDate]);

  const locationDisplay = [item.city, item.district && item.district !== item.city ? item.district : null, item.state || item.location].filter(Boolean).join(', ') || 'India';
  const orgName = item.organisation || item.department || 'Government of India';
  const mainCategory = cleanCategoryName(item.category_name, item.title);

  const renderCardHeader = (compact: boolean = false) => (
    <div className="flex flex-col gap-2 mb-3">
      {!compact && (
        <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg shrink-0">
            <span className="text-xs font-semibold text-slate-500 font-mono">
              Ref ID: {shortId}
            </span>
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-primary transition-colors shrink-0 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer flex items-center justify-center"
              title="Copy GeM auction ID to clipboard"
              aria-label="Copy reference ID"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <span className="bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
            GeM Disposal
          </span>
          {item.is_reauction && (
            <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5" />
              Re-Auction
            </span>
          )}
          {item.reference_no && (
            <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 truncate max-w-[150px]" title={item.reference_no}>
              {item.reference_no}
            </span>
          )}
        </div>
      </div>
      )}

      <div className="flex flex-wrap gap-1.5 justify-start">
        {item.emd_amount != null && item.emd_amount > 0 && (
          <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
            EMD: ₹{item.emd_amount.toLocaleString('en-IN')}
          </span>
        )}
        {item.inspection_date && (
          <span className="bg-teal-50 border border-teal-200 text-teal-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5 text-teal-600" />
            Inspection: {item.inspection_date}
          </span>
        )}
        {item.items_schedule && item.items_schedule.length > 0 && (
          <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
            {item.items_schedule.length} {item.items_schedule.length === 1 ? 'Lot' : 'Lots'} Listed
          </span>
        )}
        {item.bid_increment_amount && (
          <span className="bg-slate-100 border border-slate-300 text-slate-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
            Min Inc: ₹{item.bid_increment_amount.toLocaleString('en-IN')}
          </span>
        )}
        {(item.documents_archived || (item.document_url && item.document_url.includes('supabase.co'))) ? (
          <span className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            Official PDF
          </span>
        ) : item.document_url ? (
          <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
            Document Online
          </span>
        ) : null}
        <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wide shrink-0">
          Forward Auction
        </span>
      </div>
    </div>
  );

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!isGrid) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all group relative">
        <div className="p-5 flex flex-col sm:flex-row gap-5 justify-between">
          
          {/* GeM Left Tile: Authentic Preview Image OR Specialized Docket Tile */}
          {hasRealImage ? (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-slate-50 relative hidden sm:block shadow-3xs">
              <img
                src={realGemImage!}
                alt={item.title}
                loading="lazy"
                decoding="async"
                onError={() => setImageError(true)}
                onLoad={() => setHighResLoaded(true)}
                className={clsx(
                  "w-full h-full object-cover transition-all duration-500 ease-out",
                  !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                  "group-hover:scale-[1.03]"
                )}
              />
              <div className="absolute bottom-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                <Check className="w-2 h-2 text-emerald-400" />
                Official PDF
              </div>
            </div>
          ) : (
            <div className="w-[120px] h-[120px] rounded-2xl border border-indigo-200/80 overflow-hidden shrink-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white relative hidden sm:flex flex-col justify-between p-3 shadow-2xs group-hover:border-indigo-400/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30">
                  GeM
                </span>
                <Landmark className="w-3.5 h-3.5 text-indigo-300" />
              </div>

              <div className="text-center my-auto">
                <Gavel className="w-6 h-6 text-indigo-300 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono font-bold text-slate-200 block truncate" title={shortId}>
                  {shortId}
                </span>
                <span className="text-[8px] text-slate-400 block font-medium">Govt Disposal</span>
              </div>

              <div className="text-[9px] font-black text-emerald-400 truncate text-center pt-1 border-t border-white/10">
                {formattedPrice}
              </div>
            </div>
          )}

          {/* Details Content */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              {renderCardHeader()}

              <div className="mb-3">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
                <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.title}>
                  {item.title}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-slate-600" title={orgName}>
                    <Landmark className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">
                      Org: {orgName}
                    </span>
                  </div>
                  <div className="flex items-center text-slate-600 gap-1.5 flex-wrap" title={locationDisplay}>
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">{locationDisplay}</span>
                    {effectiveDistance !== undefined && effectiveDistance !== null && (
                      <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0 shadow-2xs">
                        {effectiveDistance} km away
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-slate-600" title="GeM Forward Auction">
                    <Gavel className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate text-base">
                      Type: Forward Auction
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                  <div className="flex items-center text-slate-700">
                    <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="flex items-center gap-1">
                      <span>Reserve Price: <strong className="text-slate-900 font-bold">{formattedPrice}</strong></span>
                      <div className="relative group/tooltip inline-block ml-0.5">
                        <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                          Reserve / Starting price defined in the GeM forward auction notice.
                          <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                        </div>
                      </div>
                    </span>
                  </div>
                  {item.department && (
                    <div className="flex items-center text-slate-700">
                      <span className="text-slate-400 text-xs mr-2 shrink-0">Dept:</span>
                      <span className="font-semibold text-slate-700 truncate">{item.department}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm border-l border-slate-100 pl-4">
                  <div className="flex items-center text-slate-700">
                    <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span>Bidding Window: <strong className="text-slate-700 font-semibold">{biddingPeriodStr}</strong></span>
                  </div>
                  {item.ministry && (
                    <div className="flex items-center text-slate-700">
                      <span className="text-slate-400 text-xs mr-2 shrink-0">Ministry:</span>
                      <span className="font-semibold text-slate-700 truncate">{item.ministry}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
              <div>
                {timeLeftBadge}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {item.document_url && (
                  <a
                    href={
                      item.documents_archived || item.document_url.includes('supabase.co')
                        ? item.document_url
                        : `/api/document-proxy?url=${encodeURIComponent(item.document_url)}&filename=GeM_${encodeURIComponent(item.gem_auction_id)}_Notice.pdf&disposition=attachment`
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex justify-center items-center h-10 px-4 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                    title="Download Official GeM Auction PDF"
                  >
                    <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Auction PDF
                  </a>
                )}

                <button
                  onClick={() => onPreview(item)}
                  className="flex-grow sm:flex-none inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </button>

                <ButtonWithIconDemo
                  isInterested={isInterested}
                  onInterestedToggle={onInterestedToggle}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── GRID VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all group flex flex-col h-full relative">
      <div className="flex flex-col h-full p-5 justify-between">
        <div>
          {/* Card Header: Real GeM Image OR Specialized GeM Dossier Layout */}
          {hasRealImage ? (
            <>
              <div className="h-[160px] w-full overflow-hidden rounded-xl border border-slate-100 mb-4 bg-slate-50 relative group/img">
                <img
                  src={realGemImage!}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  onError={() => setImageError(true)}
                  onLoad={() => setHighResLoaded(true)}
                  className={clsx(
                    "w-full h-full object-cover transition-all duration-500 ease-out",
                    !highResLoaded ? "blur-md scale-105" : "blur-0 scale-100",
                    "group-hover:scale-[1.02]"
                  )}
                />
                <div className="absolute top-2.5 left-2.5 bg-slate-950/75 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  Official GeM Forward Auction
                </div>
              </div>
              {renderCardHeader(false)}
            </>
          ) : (
            <>
              {/* Specialized GeM Image-Free Government Dossier Header */}
              <div className="rounded-2xl p-4 mb-3.5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden shadow-sm border border-slate-800 flex flex-col justify-between min-h-[142px] group-hover:border-indigo-400/50 transition-all">
                {/* Watermark Crest */}
                <div className="absolute -right-3 -bottom-4 text-white/5 pointer-events-none select-none">
                  <Gavel className="w-28 h-28 rotate-12" />
                </div>

                {/* Top Bar: GeM Tag, Re-Auction, and Status */}
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9.5px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                      GeM Forward Auction
                    </span>
                    {item.is_reauction && (
                      <span className="bg-rose-500/25 text-rose-300 border border-rose-400/30 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                        <RotateCcw className="w-2.5 h-2.5" /> Re-Auction
                      </span>
                    )}
                  </div>
                  <div className="scale-90 origin-right">
                    {timeLeftBadge}
                  </div>
                </div>

                {/* Authority / Ministry & Reference */}
                <div className="relative z-10 my-2">
                  <div className="flex items-center gap-1.5 text-indigo-200 text-xs font-bold truncate">
                    <Landmark className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate" title={orgName}>{orgName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                    <span>Ref: {shortId}</span>
                    {item.reference_no && <span className="truncate max-w-[140px]" title={item.reference_no}>• {item.reference_no}</span>}
                  </div>
                </div>

                {/* Price & Increment Spotlight */}
                <div className="relative z-10 pt-2 border-t border-white/10 flex items-baseline justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 block">Reserve Price</span>
                    <span className="text-base sm:text-lg font-black text-emerald-400 tracking-tight">{formattedPrice}</span>
                  </div>
                  {item.bid_increment_amount && (
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block uppercase tracking-wider">Min Increment</span>
                      <span className="text-xs font-bold text-amber-300 font-mono">+₹{item.bid_increment_amount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>

              {renderCardHeader(true)}
            </>
          )}

          <div className="mb-3">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCategory}</div>
            <h3 className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2" title={item.title}>
              {item.title}
            </h3>
          </div>

          {/* Structured Meta Grid */}
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
                    {effectiveDistance} km
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
                    Reserve price defined in the GeM forward auction notice.
                    <div className="absolute top-full left-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-bold text-slate-900 truncate text-xs sm:text-sm" title={formattedPrice}>
                {formattedPrice}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5">Department</span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm" title={item.department || item.ministry || 'Government Dept'}>
                {item.department || item.ministry || 'Govt Department'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5 col-span-2">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Portal Scheme</span>
                <div className="relative group/tooltip inline-block">
                  <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 transition-colors inline-block cursor-help shrink-0" />
                  <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:block w-52 p-2 bg-slate-900 text-white text-[10px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal">
                    Official Government e-Marketplace (GeM) forward auction portal for public disposal of surplus goods.
                    <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </span>
              <span className="font-semibold text-slate-700 truncate text-xs sm:text-sm">
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
          </div>
        </div>

        {/* Card Footer */}
        <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 mt-auto">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-medium">Auction Status</span>
            {timeLeftBadge}
          </div>

          <div className="flex gap-2 w-full mt-1">
            {item.document_url && (
              <a
                href={
                  item.documents_archived || item.document_url.includes('supabase.co')
                    ? item.document_url
                    : `/api/document-proxy?url=${encodeURIComponent(item.document_url)}&filename=GeM_${encodeURIComponent(item.gem_auction_id)}_Notice.pdf&disposition=attachment`
                }
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex justify-center items-center h-10 px-3.5 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                title="Download Official GeM Auction PDF"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                PDF
              </a>
            )}

            <button
              onClick={() => onPreview(item)}
              className="flex-grow inline-flex justify-center items-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </button>

            <ButtonWithIconDemo
              isInterested={isInterested}
              onInterestedToggle={onInterestedToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
