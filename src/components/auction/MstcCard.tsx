import { useState } from 'react';
import { Eye, Download, MapPin, Building2, Calendar, Clock, ShieldCheck, Landmark, Copy, Check, Heart } from 'lucide-react';
import { expandMstcOffice } from '../../services/publicService';
import type { MstcSanitizedAuction } from '../../services/publicService';
import clsx from 'clsx';
import { useAppStore } from '../../store/appStore';
import { formatPriceString } from '../../utils/currency';
import { generateCatalogSummary, formatDateOrdinal } from '../../utils/mstcHelpers';

interface MstcCardProps {
  item: MstcSanitizedAuction;
  isGrid?: boolean;
  onPreview: (item: MstcSanitizedAuction) => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export function MstcCard({ item, isGrid = true, onPreview, isInterested, onInterestedToggle }: MstcCardProps) {
  const { currency } = useAppStore();
  const shortId =
    item.mstc_auction_number.split("/").pop() || item.id.substring(0, 8);
  const summary = generateCatalogSummary(item);
  const photoUrls = (summary.extracted_images || []).filter((url: string) => {
    const lower = url.toLowerCase();
    return !lower.endsWith('.pdf') && /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff?)$/i.test(lower);
  });
  const docUrls = (summary.extracted_images || []).filter((url: string) => url.toLowerCase().endsWith('.pdf'));

  const hasPhotos = photoUrls.length > 0;
  const hasDocAssets = docUrls.length > 0;


  const parts = item.mstc_auction_number.split("/");
  const rawOffice =
    parts.length > 1 && parts[0].toUpperCase() === "MSTC"
      ? parts[1]
      : item.seller_name;
  const regionalOfficeName = expandMstcOffice(rawOffice);
  const locationName = expandMstcOffice(item.location);

  const auctionDate = new Date(item.opening_date);
  const biddingCloseDate = new Date(
    auctionDate.getTime() - 14 * 24 * 60 * 60 * 1000,
  );
  const now = new Date();
  const diffMs = biddingCloseDate.getTime() - now.getTime();
  const isClosed = diffMs <= 0;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const isUrgent = diffDays < 3;
  const isWarning = diffDays < 7;

  const timeLeftBadge = isClosed ? (
    <span className="font-bold text-xs px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50">
      Bidding Started
    </span>
  ) : (
    <span
      className={clsx(
        "font-bold text-xs px-2.5 py-1 rounded-md border flex items-center gap-1",
        isUrgent
          ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse"
          : isWarning
            ? "text-amber-700 bg-amber-50 border-amber-200"
            : "text-emerald-700 bg-emerald-50 border-emerald-200",
      )}
    >
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

  const cardHeader = (
    <div className="flex justify-between items-start gap-4 mb-3">
      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg shrink-0">
        <span className="text-xs font-semibold text-slate-500 font-mono">
          Ref ID: {shortId}
        </span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-primary transition-colors shrink-0 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer flex items-center justify-center"
          title="Copy full reference number to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 animate-scaleIn" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        {hasDocAssets && (
          <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-3xs uppercase tracking-wide text-right shrink-0">
            Asset documents available
          </span>
        )}
        {hasPhotos && (
          <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-3xs uppercase tracking-wide text-right shrink-0">
            Images available
          </span>
        )}
      </div>
    </div>
  );

  if (!isGrid) {
    // LIST VIEW
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all group p-5 flex flex-col sm:flex-row gap-5 justify-between">
        {(() => {
          const displayImage =
            summary.extracted_images && summary.extracted_images.length > 0
              ? summary.extracted_images[0]
              : summary.preview_image_url;

          return displayImage ? (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-150 overflow-hidden shrink-0 bg-slate-50 relative hidden sm:block">
              <img 
                src={displayImage} 
                alt="Catalog Image" 
                className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-300"
              />
            </div>
          ) : (
            <div className="w-[120px] h-[120px] rounded-xl border border-slate-200 shrink-0 bg-slate-50 flex flex-col items-center justify-center text-slate-400 select-none hidden sm:flex gap-1.5">
              <svg
                className="w-6 h-6 text-slate-355"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              <span className="text-[9px] font-medium tracking-wide text-slate-400 text-center px-1.5 leading-tight">
                No pictures available
              </span>
            </div>
          );
        })()}

        <div className="flex-1 flex flex-col justify-between">
          <div>
            {cardHeader}

            {(() => {
              const parts = item.category_name.split(" | ");
              const mainCat = parts[0];
              const subCat = parts[1];
              return (
                <div className="mb-3">
                  {subCat ? (
                    <>
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{mainCat}</div>
                      <h3 className="text-lg font-bold text-slate-955 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                        {subCat}
                      </h3>
                    </>
                  ) : (
                    <h3 className="text-lg font-bold text-slate-955 group-hover:text-primary transition-colors line-clamp-2" title={item.category_name}>
                      {mainCat}
                    </h3>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2 text-xs">
                <div
                  className="flex items-center text-slate-600"
                  title={regionalOfficeName}
                >
                  <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700 truncate">
                    Office: {regionalOfficeName}
                  </span>
                </div>
                {item.location && (
                  <div
                    className="flex items-center text-slate-600"
                    title={locationName}
                  >
                    <MapPin className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate">
                      {locationName}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs border-l border-slate-100 pl-4">
                <div className="flex items-center text-slate-655">
                  <Landmark className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span>
                    EMD:{" "}
                    <strong className="text-slate-700 font-semibold">
                      {formatPriceString(summary.depositDetails.emd, currency)}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center text-slate-655">
                  <ShieldCheck className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span>
                    Pre-bid:{" "}
                    <strong className="text-slate-700 font-semibold">
                      {formatPriceString(summary.depositDetails.preBidDdg, currency)}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs border-l border-slate-100 pl-4">
                <div className="flex items-center text-slate-655">
                  <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span>
                    Date:{" "}
                    <strong className="text-slate-700 font-semibold">
                      {formatDateOrdinal(item.opening_date)}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center text-slate-655">
                  <Clock className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                  <span>
                    Starts:{" "}
                    <strong className="text-slate-700 font-semibold">
                      {formatDateOrdinal(biddingCloseDate)}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
            <div>{timeLeftBadge}</div>

            <div className="flex gap-2 w-full sm:w-auto">
              {item.sanitized_document_path ? (
                <>
                  <button
                    onClick={() => onPreview(item)}
                    className="flex-grow sm:flex-none inline-flex justify-center items-center py-2 px-5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                  <a
                    href={item.sanitized_document_path}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex justify-center items-center p-2.5 rounded-lg border border-slate-250 text-slate-655 hover:bg-slate-50 hover:border-slate-350 hover:text-slate-900 transition-colors cursor-pointer"
                    title="Download PDF Catalog"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </>
              ) : (
                <button
                  disabled
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-450 animate-ping mr-2"></span>
                  PDF Processing...
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // GRID VIEW
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all group flex flex-col h-full p-5 justify-between">
      <div>
        <div className="h-[160px] w-full overflow-hidden rounded-xl border border-slate-100 mb-4 bg-slate-50 relative">
          {(() => {
            const displayImage =
              summary.extracted_images && summary.extracted_images.length > 0
                ? summary.extracted_images[0]
                : summary.preview_image_url;

            return displayImage ? (
              <>
                <img 
                  src={displayImage} 
                  alt="Catalog Image" 
                  className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                />

              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 select-none bg-slate-50/50">
                <svg
                  className="w-8 h-8 text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
                <span className="text-[11px] font-medium tracking-wide">
                  No pictures available
                </span>
              </div>
            );
          })()}
        </div>
        {cardHeader}

        {(() => {
          const parts = item.category_name.split(" | ");
          const mainCat = parts[0];
          const subCat = parts[1];
          return (
            <div className="mb-3">
              {subCat ? (
                <>
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">
                    {mainCat}
                  </div>
                  <h3
                    className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2"
                    title={item.category_name}
                  >
                    {subCat}
                  </h3>
                </>
              ) : (
                <h3
                  className="text-lg font-bold text-slate-950 group-hover:text-primary transition-colors line-clamp-2"
                  title={item.category_name}
                >
                  {mainCat}
                </h3>
              )}
            </div>
          );
        })()}

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4 grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Office</span>
            <span className="font-bold text-slate-700 truncate" title={regionalOfficeName}>
              {regionalOfficeName}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Location</span>
            <span className="font-bold text-slate-700 truncate" title={locationName || 'N/A'}>
              {locationName || 'N/A'}
            </span>
          </div>
          <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
            <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">EMD Required</span>
            <span className="font-bold text-slate-700 truncate" title={formatPriceString(summary.depositDetails.emd, currency)}>
              {formatPriceString(summary.depositDetails.emd, currency)}
            </span>
          </div>
          <div className="flex flex-col min-w-0 border-t border-slate-200/60 pt-2.5">
            <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Pre-bid EMD</span>
            <span className="font-bold text-slate-700 truncate" title={formatPriceString(summary.depositDetails.preBidDdg, currency)}>
              {formatPriceString(summary.depositDetails.preBidDdg, currency)}
            </span>
          </div>
        </div>


        <div className="space-y-1.5 mb-4 text-xs text-slate-500 border-t border-slate-50 pt-3">
          <div className="flex justify-between">
            <span>Auction Date:</span>
            <span className="font-semibold text-slate-700">
              {formatDateOrdinal(item.opening_date)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Bidding Starts:</span>
            <span className="font-semibold text-slate-700">
              {formatDateOrdinal(biddingCloseDate)}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 mt-auto">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 font-medium">
            Bidding Window
          </span>
          {timeLeftBadge}
        </div>

        <div className="flex gap-2 w-full mt-1">
          {item.sanitized_document_path ? (
            <button
              onClick={() => onPreview(item)}
              className="flex-grow inline-flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </button>
          ) : (
            <button
              disabled
              className="flex-grow inline-flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
            >
              <span className="w-2 h-2 rounded-full bg-amber-450 animate-ping mr-2"></span>
              PDF Processing...
            </button>
          )}

          {onInterestedToggle && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onInterestedToggle();
              }}
              className="inline-flex justify-center items-center p-2.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-colors cursor-pointer shrink-0"
              title={isInterested ? "Remove from interested list" : "Add to interested list"}
            >
              <Heart className={clsx("w-4 h-4", isInterested ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
