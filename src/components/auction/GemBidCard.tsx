import { useState } from 'react';
import { Eye, MapPin, Building2, Calendar, Landmark, Download } from 'lucide-react';
import type { GemBid } from '../../services/publicService';

interface GemBidCardProps {
  item: GemBid;
  isGrid?: boolean;
  onPreview: (item: GemBid) => void;
}

export function GemBidCard({
  item,
  isGrid = true,
  onPreview,
}: GemBidCardProps) {
  const [imageError, setImageError] = useState(false);

  // Determine bid status (Active vs Closed)
  const getStatusBadge = () => {
    const now = new Date();
    const end = new Date(item.end_date);

    if (now > end || item.status === 'closed') {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
          CLOSED
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
          ACTIVE BID
        </span>
      );
    }
  };

  // Safe fallback placeholder images based on category name
  const getPlaceholderImage = () => {
    const cat = (item.category_name || '').toLowerCase();
    if (cat.includes('vehicle') || cat.includes('autom') || cat.includes('car') || cat.includes('scrap')) {
      return 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
    } else if (cat.includes('comp') || cat.includes('elect') || cat.includes('e-waste') || cat.includes('cables')) {
      return 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
    } else if (cat.includes('machin') || cat.includes('equip') || cat.includes('metal')) {
      return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
    }
    // Default blue tech texture placeholder
    return 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
  };

  const previewImage = getPlaceholderImage();

  if (isGrid) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-all group duration-300">
        
        {/* Card Image Header */}
        <div className="relative h-44 w-full bg-slate-100 overflow-hidden shrink-0">
          {!imageError ? (
            <img
              src={previewImage}
              alt={item.items}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
              <Building2 className="w-12 h-12 text-slate-300" />
            </div>
          )}

          {/* Status Badge overlay */}
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            {getStatusBadge()}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 md:p-5 flex-grow flex flex-col justify-between">
          <div className="space-y-2.5 text-left">
            
            {/* Header: Department & Category Tag */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold font-mono truncate">
                <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate uppercase tracking-wider" title={item.department_name || 'GeM Bid'}>
                  {item.department_name || 'GeM Procurement'}
                </span>
              </div>
              <span className="shrink-0 px-2 py-0.5 bg-slate-100 text-slate-655 text-[9px] font-extrabold uppercase tracking-wider rounded border border-slate-200/50 max-w-[100px] truncate" title={item.category_name}>
                {item.category_name || 'Tender'}
              </span>
            </div>

            {/* Title / Description */}
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base leading-snug line-clamp-2 min-h-[40px] group-hover:text-primary transition-colors">
              {item.items}
            </h3>

            {/* Details Fields */}
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
              <div>
                <span className="text-slate-400 block font-semibold">BID NUMBER</span>
                <span className="font-bold text-slate-700 truncate block">{item.bid_number}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">QUANTITY</span>
                <span className="font-bold text-slate-700 truncate block">{item.quantity || 'N/A'}</span>
              </div>
              {item.ra_number && (
                <div className="col-span-2">
                  <span className="text-slate-400 block font-semibold">RA NUMBER</span>
                  <span className="font-bold text-slate-700 truncate block">{item.ra_number}</span>
                </div>
              )}
            </div>

            {/* Bidding Dates */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>End: {new Date(item.end_date).toLocaleDateString()}</span>
              </div>
            </div>

          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-2">
            <button
              onClick={() => onPreview(item)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Details
            </button>

            {item.document_url ? (
              <a
                href={item.document_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs rounded-xl border border-primary/20 transition-all text-center"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-300 font-bold text-xs rounded-xl border border-slate-100"
              >
                <Download className="w-3.5 h-3.5" />
                No document
              </button>
            )}
          </div>
        </div>

      </div>
    );
  }

  // Row layout fallback
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-xs transition-shadow text-left">
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {getStatusBadge()}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-mono">
            {item.bid_number}
          </span>
          <span className="text-slate-400 text-xs font-semibold">|</span>
          <span className="text-slate-500 text-xs font-bold font-mono truncate max-w-[200px]" title={item.department_name || ''}>
            {item.department_name || 'GeM Department'}
          </span>
        </div>

        <h3 className="font-extrabold text-slate-800 text-base hover:text-primary transition-colors cursor-pointer" onClick={() => onPreview(item)}>
          {item.items}
        </h3>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium">
          <div>
            <span className="text-slate-400 font-bold mr-1">Quantity:</span>
            <span className="text-slate-700 font-bold">{item.quantity || 'N/A'}</span>
          </div>
          {item.ra_number && (
            <div>
              <span className="text-slate-400 font-bold mr-1">RA Number:</span>
              <span className="text-slate-700 font-bold">{item.ra_number}</span>
            </div>
          )}
          <div>
            <span className="text-slate-400 font-bold mr-1">Category:</span>
            <span className="text-slate-700 font-bold">{item.category_name}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold mr-1">Closing:</span>
            <span className="text-slate-700 font-bold">{new Date(item.end_date).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex sm:flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
        <button
          onClick={() => onPreview(item)}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-655 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>

        {item.document_url && (
          <a
            href={item.document_url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs rounded-xl border border-primary/20 transition-all text-center"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </a>
        )}
      </div>
    </div>
  );
}
