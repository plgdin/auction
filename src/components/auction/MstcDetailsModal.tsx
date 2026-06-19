import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, Heart, FilePlus, ChevronDown, Mail, Phone } from 'lucide-react';
import type { MstcSanitizedAuction } from '../../services/publicService';
import { expandMstcOffice } from '../../services/publicService';
import { useAuthStore } from '../../store/authStore';
import { storageService } from '../../services/storageService';
import { generateCatalogSummary, parsePdfDateTime, calculateLotValue } from '../../utils/mstcHelpers';
import clsx from 'clsx';
import { Dropdown } from 'antd';
import { useQuoteStore } from '../../store/quoteStore';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../../store/appStore';
import { formatPrice, CURRENCIES } from '../../utils/currency';
import { valuationService } from '../../services/valuationService';
import type { ValuationCosts, ValuationOutput } from '../../services/valuationService';
import { marketPriceService } from '../../services/marketPriceService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  DEFAULT_MACRO_INPUTS,  
  predictPrice, 
  detectModelId, 
  detectGrade, 
  detectRegion
} from '../../utils/metalValuationModels';

interface MstcDetailsModalProps {
  item: MstcSanitizedAuction;
  onClose: () => void;
  isInterested?: boolean;
  onInterestedToggle?: () => void;
}

export const MstcDetailsModal: React.FC<MstcDetailsModalProps> = ({
  item,
  onClose,
  isInterested = false,
  onInterestedToggle
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [signedImages, setSignedImages] = useState<Record<string, string>>({});
  const [signedDisplayImage, setSignedDisplayImage] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to download the catalog PDF.');
      return;
    }

    if (!item.sanitized_document_path) {
      toast.error('No document path available.');
      return;
    }

    setDownloading(true);
    try {
      const storagePath = storageService.extractStoragePath(item.sanitized_document_path);
      const cleanAuctionNum = item.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
      const filename = `${cleanAuctionNum}_catalog.pdf`;
      
      const success = await storageService.downloadPrivateFile('auction_documents', storagePath, filename);
      if (success) {
        toast.success('Catalog PDF downloaded successfully.');
      } else {
        toast.error('Failed to download the catalog PDF. Please try again.');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('An error occurred during catalog download.');
    } finally {
      setDownloading(false);
    }
  };

  const { currency } = useAppStore();
  const currencySymbol = CURRENCIES[currency]?.symbol || '₹';

  const [modalTab, setModalTab] = useState<'catalog' | 'valuation'>('catalog');
  const [customCosts, setCustomCosts] = useState<ValuationCosts>({
    currentBid: 0,
    transportation: 5000,
    loadingUnloading: 2000,
    refurbishment: 0,
    otherFees: 1000,
    extraCharge: 0,
  });
  const [valuationData, setValuationData] = useState<ValuationOutput | null>(null);
  const [isValuating, setIsValuating] = useState(false);
  const [selectedChartItemId, setSelectedChartItemId] = useState<string>('total');
  const [extraChargeType, setExtraChargeType] = useState<string>('none');

  const extraChargeLabels: Record<string, string> = {
    none: 'None (₹0)',
    customs_10: 'Customs Duty (10%)',
    customs_15: 'Customs Duty (15%)',
    customs_20: 'Customs Duty (20%)',
    local_5: 'Entry Tax / Octroi (5%)',
    env_2: 'Environmental Cess (2%)',
    brokerage_3: 'Brokerage & Clearance (3%)',
    warehousing_5k: 'Warehousing Surcharge (fixed ₹5,000)',
    inspection_2k: 'Inspection / Quarantine (fixed ₹2,500)',
  };

  const extraChargeMenu = (
    <div 
      className="bg-white rounded-xl shadow-lg border border-slate-200 p-2 min-w-[220px] max-h-[280px] overflow-y-auto flex flex-col gap-0.5 z-90"
      onClick={(e) => e.stopPropagation()}
    >
      {Object.entries(extraChargeLabels).map(([key, label]) => {
        const isSelected = extraChargeType === key;
        return (
          <div
            key={key}
            onClick={() => {
              setExtraChargeType(key);
            }}
            className={clsx(
              "flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer text-xs font-bold transition-colors select-none",
              isSelected
                ? "bg-primary-50/70 text-primary"
                : "hover:bg-slate-50 text-slate-700 hover:text-slate-900"
            )}
          >
            <span>{label}</span>
            {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </div>
        );
      })}
    </div>
  );

  useEffect(() => {
    let charge = 0;
    const bid = customCosts.currentBid || 0;
    if (extraChargeType === 'customs_10') charge = bid * 0.10;
    else if (extraChargeType === 'customs_15') charge = bid * 0.15;
    else if (extraChargeType === 'customs_20') charge = bid * 0.20;
    else if (extraChargeType === 'local_5') charge = bid * 0.05;
    else if (extraChargeType === 'env_2') charge = bid * 0.02;
    else if (extraChargeType === 'brokerage_3') charge = bid * 0.03;
    else if (extraChargeType === 'warehousing_5k') charge = 5000;
    else if (extraChargeType === 'inspection_2k') charge = 2500;

    setCustomCosts(prev => {
      if (prev.extraCharge === charge) return prev;
      return { ...prev, extraCharge: charge };
    });
  }, [extraChargeType, customCosts.currentBid]);

  const getChartData = () => {
    if (!valuationData) return [];

    let currentVal = valuationData.totalLotValue;
    let targetTitle = item.raw_materials_text || item.category_name;

    if (selectedChartItemId !== 'total') {
      const idx = parseInt(selectedChartItemId, 10);
      const it = valuationData.items[idx];
      if (it) {
        currentVal = it.totalValue;
        targetTitle = it.name || targetTitle;
      }
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    // Use ML model to generate realistic price history variations
    const modelId = detectModelId(targetTitle) || 'scrap_steel';
    const grade = detectGrade(targetTitle, modelId);
    const region = detectRegion(item.location || '', targetTitle);
    
    const baseLME = DEFAULT_MACRO_INPUTS.LME_Steel_Scrap_USD;
    const modelPoints: number[] = [];
    
    // Generate 6 months of historical prices by varying LME index slightly
    // Jan (-5 months) to Jun (current)
    for (let i = -5; i <= 0; i++) {
      const tempInputs = {
        ...DEFAULT_MACRO_INPUTS,
        LME_Steel_Scrap_USD: baseLME + (i * 12) + (Math.random() * 5 - 2.5) // Adds slight variation
      };
      const pricePoint = predictPrice(modelId, grade, region, tempInputs, targetTitle);
      modelPoints.push(pricePoint);
    }
    
    // Scale the actual 'currentVal' using the shape of the ML model points
    const currentModelPrice = modelPoints[modelPoints.length - 1];
    
    return months.map((m, i) => {
      // If the model yields 0, fallback to a flat value to avoid NaN
      const multiplier = currentModelPrice > 0 ? (modelPoints[i] / currentModelPrice) : 1;
      return {
        name: m,
        value: Math.round(currentVal * multiplier)
      };
    });
  };

  useEffect(() => {
    if (item) {
      const summary = generateCatalogSummary(item);

      let defaultBid = summary.totalMarketValue || 0;
      if (defaultBid <= 0) {
        const rawPreBid = summary.depositDetails?.preBidDdg || '';
        const preBidVal = rawPreBid.replace(/[^\d]/g, '');
        const parsedVal = parseInt(preBidVal, 10);
        defaultBid = isNaN(parsedVal) || parsedVal <= 0 ? 50000 : parsedVal;
      }

      setCustomCosts({
        currentBid: defaultBid,
        transportation: 5000,
        loadingUnloading: 2000,
        refurbishment: 0,
        otherFees: 1000,
        extraCharge: 0,
      });
      setExtraChargeType('none');
      setModalTab('catalog');
      setSelectedChartItemId('total');
    } else {
      setValuationData(null);
    }
  }, [item]);

  useEffect(() => {
    if (!item) return;
    let isMounted = true;
    const runValuation = async () => {
      setIsValuating(true);
      try {
        const summary = generateCatalogSummary(item);
        const hasImages = !!(summary.extracted_images && summary.extracted_images.length > 0);
        const rawItems = (summary.items || []).map((it: any) => ({
          sr: it.sr,
          description: it.description || '',
          qty: String(it.qty || '1'),
          unit: it.unit || 'Nos',
          marketPrice: it.marketPrice || '',
        }));
        const result = await valuationService.calculateValuation(rawItems, customCosts, hasImages);
        if (isMounted) {
          setValuationData(result);
        }
      } catch (err) {
        console.error('Valuation engine calculation failed:', err);
      } finally {
        if (isMounted) {
          setIsValuating(false);
        }
      }
    };
    runValuation();
    return () => {
      isMounted = false;
    };
  }, [item, customCosts]);

  useEffect(() => {
    let cancelled = false;
    const fetchSignedUrls = async () => {
      const summary = generateCatalogSummary(item);
      const hasOtherMedia = item.raw_materials_text && summary.extracted_images && summary.extracted_images.length > 0;
      const displayImageRaw = summary.preview_image_url || (hasOtherMedia ? summary.extracted_images![0] : null);
      const imageUrlsRaw = (summary.extracted_images || []).filter((url: string) => !url.toLowerCase().endsWith('.pdf'));

      const urlsToSign = [...imageUrlsRaw];
      if (displayImageRaw && !urlsToSign.includes(displayImageRaw)) {
        urlsToSign.push(displayImageRaw);
      }
      if (urlsToSign.length === 0) return;

      const signed = await storageService.getSignedUrls(urlsToSign, 'auction_documents');
      if (cancelled) return;

      const newSignedImages: Record<string, string> = {};
      urlsToSign.forEach((url, i) => {
        newSignedImages[url] = signed[i] || url;
      });
      setSignedImages(newSignedImages);
      if (displayImageRaw) {
        setSignedDisplayImage(newSignedImages[displayImageRaw] || null);
      }
    };
    fetchSignedUrls();
    return () => { cancelled = true; };
  }, [item]);

  const summary = generateCatalogSummary(item);
  const shortId = item.mstc_auction_number.split('/').pop() || item.id.substring(0, 8);
  const regionalOfficeName = expandMstcOffice(
    item.mstc_auction_number.split('/')[0].toUpperCase() === 'MSTC'
      ? item.mstc_auction_number.split('/')[1]
      : item.seller_name
  );
  const locationName = expandMstcOffice(item.location || '');

  // Parse start and close dates
  const parsedStartDate = summary.auctionStartTime ? parsePdfDateTime(summary.auctionStartTime) : null;
  const auctionDate = parsedStartDate || new Date(item.opening_date);
  const parsedCloseDate = summary.auctionCloseTime ? parsePdfDateTime(summary.auctionCloseTime) : null;
  const now = new Date();
  const diffMs = auctionDate.getTime() - now.getTime();
  const isStarted = diffMs <= 0;
  const isClosed = parsedCloseDate ? (now.getTime() > parsedCloseDate.getTime()) : false;

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const isUrgent = diffDays < 3;
  const isWarning = diffDays < 7;

  const addItemToActiveQuote = useQuoteStore(state => state.addItemToActiveQuote);

  const handleAddItemToQuote = (row: any) => {
    const qty = parseFloat(row.qty.replace(/,/g, '')) || 1;
    let price = 0;
    const priceMatch = (row.marketPrice || '').match(/Ôé╣([\d,]+)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/,/g, ''));
    }
    
    let taxRate = 18;
    const taxMatch = (row.taxRate || '').match(/(\d+)%/);
    if (taxMatch) {
      taxRate = parseInt(taxMatch[1], 10);
    }

    addItemToActiveQuote({
      description: row.description,
      qty,
      unit: row.unit || 'Units',
      price,
      taxRate
    });

    toast.success(`Added "${row.description}" to quote`);
  };

  const handleAddAllItemsToQuote = () => {
    if (!summary.items || summary.items.length === 0) return;
    
    summary.items.forEach(row => {
      const qty = parseFloat(row.qty.replace(/,/g, '')) || 1;
      let price = 0;
      const priceMatch = (row.marketPrice || '').match(/Ôé╣([\d,]+)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(/,/g, ''));
      }
      
      let taxRate = 18;
      const taxMatch = (row.taxRate || '').match(/(\d+)%/);
      if (taxMatch) {
        taxRate = parseInt(taxMatch[1], 10);
      }

      addItemToActiveQuote({
        description: row.description,
        qty,
        unit: row.unit || 'Units',
        price,
        taxRate
      });
    });

    toast.success(`Added all ${summary.items.length} items to quote`);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-xs p-4 sm:p-6 md:p-8 animate-fade-in">
        <div className="relative w-full max-w-7xl h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-205 animate-scale-up animate-duration-200">
          
          {/* Modal Header */}
          <div className="px-6 py-4.5 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold text-slate-500 font-mono">
                Ref: {shortId}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shortId);
                  setCopiedRef(true);
                  setTimeout(() => setCopiedRef(false), 2000);
                }}
                className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center"
                title="Copy Reference ID"
              >
                {copiedRef ? (
                  <Check className="w-3.5 h-3.5 text-emerald-605" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              {onInterestedToggle && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInterestedToggle();
                  }}
                  className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-rose-500 cursor-pointer flex items-center justify-center ml-1"
                  title={isInterested ? "Remove from interested list" : "Add to interested list"}
                >
                  <Heart className={clsx("w-3.5 h-3.5", isInterested ? "fill-rose-500 text-rose-500" : "")} />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5.5 h-5.5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
            <button
              onClick={() => setModalTab('catalog')}
              className={clsx(
                "py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider",
                modalTab === 'catalog'
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              )}
            >
              Catalog Details
            </button>
            <button
              onClick={() => setModalTab('valuation')}
              className={clsx(
                "py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider flex items-center gap-2",
                modalTab === 'valuation'
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              )}
            >
              <span>Valuation & ROI Engine</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
            {/* Left Side: Details Scrollable */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/25">
              {modalTab === 'valuation' ? (
                <div className="space-y-6">
                  {/* Cost Input Form Card */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                        Interactive Bid & Cost Estimator
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">Real-time ROI Calculation</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Current Bid Amount ({currency})</label>
                        <div className="relative rounded-xl shadow-2xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
                          </div>
                          <input
                            type="number"
                            value={customCosts.currentBid}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCustomCosts(prev => ({ ...prev, currentBid: v === '' ? '' : Math.max(0, parseFloat(v) || 0) }));
                            }}
                            className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Transportation Cost ({currency})</label>
                        <div className="relative rounded-xl shadow-2xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
                          </div>
                          <input
                            type="number"
                            value={customCosts.transportation}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCustomCosts(prev => ({ ...prev, transportation: v === '' ? '' : Math.max(0, parseFloat(v) || 0) }));
                            }}
                            className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Loading & Unloading ({currency})</label>
                        <div className="relative rounded-xl shadow-2xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
                          </div>
                          <input
                            type="number"
                            value={customCosts.loadingUnloading}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCustomCosts(prev => ({ ...prev, loadingUnloading: v === '' ? '' : Math.max(0, parseFloat(v) || 0) }));
                            }}
                            className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Refurbishment Costs ({currency})</label>
                        <div className="relative rounded-xl shadow-2xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
                          </div>
                          <input
                            type="number"
                            value={customCosts.refurbishment}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCustomCosts(prev => ({ ...prev, refurbishment: v === '' ? '' : Math.max(0, parseFloat(v) || 0) }));
                            }}
                            className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Other Service Charges ({currency})</label>
                        <div className="relative rounded-xl shadow-2xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
                          </div>
                          <input
                            type="number"
                            value={customCosts.otherFees}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCustomCosts(prev => ({ ...prev, otherFees: v === '' ? '' : Math.max(0, parseFloat(v) || 0) }));
                            }}
                            className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono mb-1.5">Customs & Extra Charges ({currency})</label>
                        <div className="relative rounded-xl shadow-2xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                            <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
                          </div>
                          <Dropdown
                            popupRender={() => extraChargeMenu}
                            trigger={['click']}
                            placement="bottomLeft"
                          >
                            <button
                              type="button"
                              className="w-full flex justify-between items-center pl-7 pr-8 py-2 border border-slate-250 rounded-xl bg-white text-sm font-bold text-slate-900 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-left cursor-pointer h-[38px]"
                            >
                              <span className="truncate">
                                {extraChargeLabels[extraChargeType]}
                              </span>
                              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                            </button>
                          </Dropdown>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isValuating || !valuationData ? (
                    <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">Recalculating Valuation...</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs font-medium">Querying SerpAPI live market pricing and simulating category valuations.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Investment & ROI metrics grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs space-y-1">
                          <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Estimated Lot Value</h5>
                          <div className="text-lg font-black text-slate-900 font-mono">
                            {valuationData.totalLotValue > 0 ? formatPrice(valuationData.totalLotValue, currency) : 'N/A'}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Market value of items</p>
                        </div>

                        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs space-y-1">
                          <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Total Lot Cost</h5>
                          <div className="text-lg font-black text-slate-900 font-mono">
                            {valuationData.totalLotValue > 0 ? formatPrice(valuationData.totalCost, currency) : 'N/A'}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Bid + logistics</p>
                        </div>

                        <div className={clsx(
                          "rounded-2xl p-4.5 border shadow-2xs space-y-1",
                          valuationData.totalLotValue <= 0
                            ? "bg-slate-50 border-slate-200 text-slate-500"
                            : valuationData.estimatedProfit >= 0
                            ? "bg-emerald-50/50 border-emerald-150 text-emerald-950"
                            : "bg-rose-50/50 border-rose-150 text-rose-950"
                        )}>
                          <h5 className="text-[9px] font-bold opacity-60 uppercase tracking-widest font-mono">Projected Profit</h5>
                          <div className="text-lg font-black font-mono">
                            {valuationData.totalLotValue > 0
                              ? `${valuationData.estimatedProfit >= 0 ? '+' : ''}${formatPrice(valuationData.estimatedProfit, currency)}`
                              : 'N/A'
                            }
                          </div>
                          <p className="text-[10px] opacity-70 font-medium">Net profit estimate</p>
                        </div>

                        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-2xs space-y-1">
                          <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Break-Even Bid</h5>
                          <div className="text-lg font-black text-slate-900 font-mono">
                            {valuationData.totalLotValue > 0 ? formatPrice(valuationData.breakEven, currency) : 'N/A'}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Includes handling</p>
                        </div>
                      </div>

                      {/* Valuation Breakdown Table */}
                      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2 flex items-center justify-between">
                          <span>Valuation Details per Item</span>
                          <span className="text-[10px] text-slate-400 font-medium normal-case font-sans">
                            Valued using live pricing analysis
                          </span>
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-slate-150 bg-white">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-650 border-b border-slate-250 font-mono">
                                <th className="py-2.5 px-3.5 font-bold">Item Description</th>
                                <th className="py-2.5 px-3.5 font-bold text-right w-20">Quantity</th>
                                <th className="py-2.5 px-3.5 font-bold text-right w-32">Unit Est. Value</th>
                                <th className="py-2.5 px-3.5 font-bold text-right w-36">Total Est. Value</th>
                                <th className="py-2.5 px-3.5 font-bold text-center w-24">Confidence</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-105 text-slate-700">
                              {valuationData.items.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 px-3.5 font-bold text-slate-900">{row.name}</td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-slate-650">{row.qty}</td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-slate-950 font-bold">
                                    {row.notAvailable ? 'N/A' : formatPrice(row.unitValue, currency)}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-slate-950 font-bold">
                                    {row.notAvailable ? 'N/A' : formatPrice(row.totalValue, currency)}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center font-mono">
                                    <span className={clsx(
                                      "text-[10px] font-bold px-2 py-0.5 rounded",
                                      row.notAvailable ? "bg-slate-100 text-slate-650" :
                                      row.confidence >= 75 ? "bg-emerald-50 text-emerald-700" :
                                        row.confidence >= 55 ? "bg-amber-50 text-amber-700" :
                                          "bg-rose-50 text-rose-700"
                                    )}>
                                      {row.notAvailable ? 'N/A' : `${row.confidence}%`}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Risk & Confidence Assessment Panel */}
                      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                            Risk & Confidence Assessment
                          </h4>
                          <span className={clsx(
                            "text-xs font-bold px-3 py-1 rounded-full",
                            valuationData.riskAnalysis.riskLevel === 'Low Risk' ? "bg-emerald-50 text-emerald-700 border border-emerald-150" :
                              valuationData.riskAnalysis.riskLevel === 'Medium Risk' ? "bg-amber-50 text-amber-700 border border-amber-150" :
                                "bg-rose-50 text-rose-700 border border-rose-150"
                          )}>
                            {valuationData.riskAnalysis.riskLevel}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                              <span>Data Quality</span>
                              <span className="text-slate-700">{valuationData.riskAnalysis.dataConfidence}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                  className="h-full bg-slate-800 rounded-full transition-all duration-500"
                                  style={{ width: `${valuationData.riskAnalysis.dataConfidence}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                              <span>Pricing Consistency</span>
                              <span className="text-slate-700">{valuationData.riskAnalysis.pricingConfidence}%</span>
                            </div>
                            <div className="h-2 bg-slate-105 rounded-full overflow-hidden">
                              <div
                                  className={clsx(
                                      "h-full rounded-full transition-all duration-500",
                                      valuationData.riskAnalysis.pricingConfidence >= 70 ? "bg-emerald-500" :
                                          valuationData.riskAnalysis.pricingConfidence >= 40 ? "bg-amber-500" : "bg-rose-500"
                                  )}
                                  style={{ width: `${valuationData.riskAnalysis.pricingConfidence}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                              <span>Overall Confidence</span>
                              <span className="text-slate-700 font-bold">{valuationData.riskAnalysis.overallConfidence}%</span>
                            </div>
                            <div className="h-2 bg-slate-105 rounded-full overflow-hidden">
                              <div
                                  className={clsx(
                                      "h-full rounded-full transition-all duration-500",
                                      valuationData.riskAnalysis.overallConfidence >= 70 ? "bg-emerald-600" :
                                          valuationData.riskAnalysis.overallConfidence >= 45 ? "bg-amber-600" : "bg-rose-600"
                                  )}
                                  style={{ width: `${valuationData.riskAnalysis.overallConfidence}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-655 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 font-medium">
                          {valuationData.riskAnalysis.reasoning}
                        </p>
                      </div>

                      {/* Price Trend Chart Panel */}
                      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                              Price Trend Comparison (6 Months)
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium font-sans mt-0.5">
                              Market rate tracking of auction lot items over time
                            </p>
                          </div>
                          <select
                            value={selectedChartItemId}
                            onChange={(e) => setSelectedChartItemId(e.target.value)}
                            className="bg-slate-50 border border-slate-250 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-700 cursor-pointer"
                          >
                            <option value="total">Total Lot Value</option>
                            {valuationData.items.map((item, idx) => (
                              <option key={idx} value={String(idx)}>
                                {item.name} (Qty: {item.qty})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="h-[220px] w-full">
                          {valuationData.totalLotValue <= 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400 font-medium text-xs bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl select-none">
                              No trend data available for this item
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={getChartData()} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                  dataKey="name"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                />
                                <YAxis
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(v) => `${currencySymbol}${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v.toLocaleString('en-IN')}`}
                                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                />
                                <Tooltip
                                  formatter={(value: any) => [`${currencySymbol}${value.toLocaleString('en-IN')}`, 'Est. Value']}
                                  contentStyle={{
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: '#ffffff',
                                    color: '#0f172a',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                                  }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVal)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>

                      {/* International Market Comparison Panel */}
                      {valuationData.internationalTotals && valuationData.totalLotValue > 0 && (
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                              Average International Market Price
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Global Average Rate
                            </span>
                          </div>

                          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block">Average Global Value</span>
                              <h3 className="text-2xl font-black text-slate-955 mt-1">
                                {formatPrice(Math.round((valuationData.internationalTotals.in + valuationData.internationalTotals.us + valuationData.internationalTotals.uk) / 3), currency)}
                              </h3>
                              <p className="text-[10px] text-slate-400 font-medium mt-1">
                                Computed average across India, USA, and UK market rates
                              </p>
                            </div>
                            <div className="flex gap-3 text-xs font-mono font-semibold text-slate-655 bg-white p-3 rounded-xl border border-slate-150 shrink-0">
                              <div className="pr-3 border-r border-slate-200">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">US Rate</span>
                                <span>${Math.round(((valuationData.internationalTotals.in + valuationData.internationalTotals.us + valuationData.internationalTotals.uk) / 3) / 85).toLocaleString('en-US')}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">UK Rate</span>
                                <span>£{Math.round(((valuationData.internationalTotals.in + valuationData.internationalTotals.us + valuationData.internationalTotals.uk) / 3) / 108).toLocaleString('en-GB')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Category & Auction Ref Title */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Category / Item Type</h4>
                {(() => {
                  const parts = item.category_name.split(' | ');
                  const mainCat = parts[0];
                  const subCat = parts[1];
                  return (
                    <div className="flex flex-col gap-0.5">
                      {subCat ? (
                        <>
                          <span className="text-sm font-bold text-primary uppercase tracking-wider">{mainCat}</span>
                          <h3 className="text-3xl font-black text-slate-950 leading-tight">{subCat}</h3>
                        </>
                      ) : (
                        <h3 className="text-3xl font-black text-slate-955 leading-tight">{mainCat}</h3>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Auction Reference Banner */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-3xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Official Auction Reference Number</span>
                  <span className="font-mono text-base font-bold text-slate-800 break-all select-all">{item.mstc_auction_number}</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(item.mstc_auction_number);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={clsx(
                    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all shrink-0 cursor-pointer shadow-3xs",
                    copied
                      ? "bg-emerald-50 border-emerald-250 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-707 hover:bg-slate-50 hover:text-primary hover:border-primary/30"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Reference Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Ref Number</span>
                    </>
                  )}
                </button>
              </div>

              {/* General Parameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Seller & Location Details */}
                <div className="md:col-span-6 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Regional Office</span>
                    <span className="text-[13.5px] font-bold text-slate-800 leading-snug mt-0.5">
                      {regionalOfficeName}
                    </span>
                  </div>
                  {item.location && (
                    <div className="flex flex-col border-t border-slate-100 pt-2">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Location / State</span>
                      <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">{locationName}</span>
                    </div>
                  )}
                </div>

                {/* Dates & Countdown */}
                <div className="md:col-span-6 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-start gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Auction Date</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {parsedStartDate ? auctionDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : auctionDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Inspection Date Range</span>
                    <span className="text-[13.5px] font-bold text-slate-800 mt-0.5">
                      {summary.inspectionSchedule || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col border-t border-slate-100 pt-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Status</span>
                    <div>
                      {(() => {
                        if (isClosed) {
                          return <span className="inline-block font-bold text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 bg-slate-50">Bidding Closed</span>;
                        }
                        if (isStarted) {
                          return <span className="inline-block font-bold text-xs px-2.5 py-1 rounded border border-rose-200 text-rose-700 bg-rose-50 animate-pulse">Bidding Started</span>;
                        }
                        return (
                          <span className={clsx(
                            "inline-block font-bold text-xs px-2.5 py-1 rounded border",
                            isUrgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" :
                            isWarning ? "text-amber-700 bg-amber-50 border-amber-200" :
                            "text-emerald-700 bg-emerald-50 border-emerald-200"
                          )}>
                            {diffDays > 0 ? `Starts in ${diffDays}d ${diffHours}h` : `Starts in ${diffHours}h ${diffMins}m`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Identified Materials & Lots */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2.5 gap-2">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
                    <span>Identified Inventory & Materials</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-sans font-medium normal-case">
                      {summary.items.length} lots identified
                    </span>
                  </h4>
                  {summary.items.length > 0 && (
                    <button
                      onClick={handleAddAllItemsToQuote}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 bg-primary/5 border border-primary/20 rounded-lg transition-colors cursor-pointer"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                      Add All to Quote
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-150 bg-white">
                  <table className="w-full text-left border-collapse text-[13.5px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-650 border-b border-slate-250 font-mono">
                        <th className="py-3 px-3.5 font-bold w-12 text-center">Lot</th>
                        <th className="py-3 px-3.5 font-bold">Material Description</th>
                        <th className="py-3 px-3.5 font-bold text-right">Quantity</th>
                        <th className="py-3 px-3.5 font-bold text-center">Market Price</th>
                        <th className="py-3 px-3.5 font-bold text-center w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-105 text-slate-700">
                      {summary.items.map((row) => (
                        <tr key={row.sr} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">{row.sr}</td>
                          <td className="py-3 px-3.5 font-bold text-slate-900">{row.description}</td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-950 font-bold">{row.qty} {row.unit}</td>
                          <td className={clsx(
                            "py-3 px-3.5 text-center font-mono text-xs font-bold",
                            row.marketPrice === "Not Available"
                              ? "text-slate-500 bg-slate-100/50"
                              : "text-emerald-600 bg-emerald-50/50"
                          )}>
                            {row.marketPrice}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <button
                              onClick={() => handleAddItemToQuote(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-primary hover:bg-slate-100 border border-slate-200 hover:border-primary/30 rounded-md transition-colors cursor-pointer"
                              title="Add to Quote"
                            >
                              <FilePlus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Eligibility, Compliance & Financial Terms */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Compliance Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2.5">
                    Buyer Eligibility & Compliance
                  </h4>
                  <ul className="list-disc pl-5 space-y-2 text-[13.5px] text-slate-705">
                    {summary.eligibility.map((el, i) => (
                      <li key={i} className="leading-relaxed">{el}</li>
                    ))}
                  </ul>
                </div>

                {/* Financial Charges Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2.5">
                    Financial Terms & Service Fees
                  </h4>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 text-[11px] uppercase font-mono tracking-wider">EMD Details</span>
                      <span className="font-bold text-slate-850 text-[13.5px]">
                        {summary.depositDetails.emd}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 text-[11px] uppercase font-mono tracking-wider">Pre-bid EMD</span>
                      <span className="font-bold text-slate-850 text-[13.5px]">
                        {summary.depositDetails.preBidDdg}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Market Intelligence & ROI Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2.5 flex items-center justify-between">
                    <span>Market Analysis & ROI</span>
                  </h4>
                  {(() => {
                    let totalTurnover = 0;
                    let metalCount = 0;
                    let vehicleCount = 0;
                    let ewasteCount = 0;
                    summary.items.forEach(lot => {
                      const val = calculateLotValue(lot.qty, lot.unit, lot.marketPrice || '2500');
                      totalTurnover += val;
                      const desc = (lot.description || '').toLowerCase();
                      if (desc.includes('steel') || desc.includes('iron') || desc.includes('copper') || desc.includes('metal') || desc.includes('brass')) {
                        metalCount++;
                      } else if (desc.includes('vehicle') || desc.includes('car') || desc.includes('bus') || desc.includes('truck') || desc.includes('motorcycle')) {
                        vehicleCount++;
                      } else if (desc.includes('computer') || desc.includes('laptop') || desc.includes('battery') || desc.includes('e-waste') || desc.includes('electronic')) {
                        ewasteCount++;
                      }
                    });

                    // Determine dynamic multiplier based on dominant commodity type
                    let closingBidMultiplier = marketPriceService.getCommodityMultiplier('default');
                    const totalItems = summary.items.length || 1;
                    if (metalCount / totalItems > 0.5) {
                      closingBidMultiplier = marketPriceService.getCommodityMultiplier('steel_iron_ferrous');
                    } else if (vehicleCount / totalItems > 0.5) {
                      closingBidMultiplier = marketPriceService.getCommodityMultiplier('vehicle');
                    } else if (ewasteCount / totalItems > 0.5) {
                      closingBidMultiplier = marketPriceService.getCommodityMultiplier('e_waste');
                    }

                    const finalTurnover = valuationData ? valuationData.totalLotValue : totalTurnover;
                    const predictedClosingBid = finalTurnover * closingBidMultiplier;
                    const projectedProfit = finalTurnover - predictedClosingBid;
                    const roi = predictedClosingBid > 0 ? (projectedProfit / predictedClosingBid) * 100 : 0;

                    if (finalTurnover <= 0) {
                      return (
                        <div className="py-4 text-center text-slate-500 font-bold bg-slate-50 border border-dashed border-slate-205 rounded-xl font-mono text-xs">
                          Pricing Not Available
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3 text-[13.5px] text-slate-705">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Projected Turnover</span>
                          <span className="font-bold text-slate-900">
                            ₹{finalTurnover.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Predicted Closing Bid</span>
                          <span className="font-bold text-indigo-650">
                            ₹{predictedClosingBid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Projected Profit</span>
                          <span className="font-bold text-emerald-605">
                            ₹{projectedProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pb-1">
                          <span className="text-slate-500 font-semibold">Projected ROI</span>
                          <span className="font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                            +{roi.toFixed(1)}% ROI
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Key Contact Personnel */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-5">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100 pb-2.5">
                  Key Contact Personnel
                </h4>

                {/* MSTC Contacts */}
                {(() => {
                  const mstcContacts = summary.keyContacts.filter(c => 
                    c.role.toLowerCase().includes('mstc') || c.role.toLowerCase().includes('auction officer')
                  );
                  const sellerContacts = summary.keyContacts.filter(c => 
                    !c.role.toLowerCase().includes('mstc') && !c.role.toLowerCase().includes('auction officer')
                  );

                  return (
                    <div className="space-y-4">
                      {/* MSTC Officer Section */}
                      {mstcContacts.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-mono bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                              MSTC Auction Officers
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {mstcContacts.map((contact, i) => (
                              <div key={`mstc-${i}`} className="bg-blue-50/30 border border-blue-150/50 p-3.5 rounded-xl space-y-2">
                                <span className="text-[10px] font-mono text-blue-600 font-bold uppercase tracking-wider">{contact.role}</span>
                                <h4 className="text-[13.5px] font-black text-slate-900">{contact.name}</h4>
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-605 font-mono break-all flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">{contact.email}</a>
                                  </p>
                                  {contact.phone && contact.phone !== 'no contact info available' && (
                                    <p className="text-xs text-slate-605 font-mono flex items-center gap-1.5">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="hover:text-primary transition-colors">{contact.phone}</a>
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Seller / Site Contacts Section */}
                      {sellerContacts.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                              Seller / Site Contacts
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sellerContacts.map((contact, i) => (
                              <div key={`seller-${i}`} className="bg-emerald-50/30 border border-emerald-150/50 p-3.5 rounded-xl space-y-2">
                                <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase tracking-wider">{contact.role}</span>
                                <h4 className="text-[13.5px] font-black text-slate-900">{contact.name}</h4>
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-605 font-mono break-all flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">{contact.email}</a>
                                  </p>
                                  {contact.phone && contact.phone !== 'no contact info available' && (
                                    <p className="text-xs text-slate-605 font-mono flex items-center gap-1.5">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="hover:text-primary transition-colors">{contact.phone}</a>
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
                </>
              )}
            </div>

            {/* Right Side: Image/Preview Panel */}
            {(() => {
              const hasOtherMedia = item.raw_materials_text && summary.extracted_images && summary.extracted_images.length > 0;
              const displayImage = summary.preview_image_url || (hasOtherMedia ? summary.extracted_images![0] : null);

              return (
                <div className="w-full md:w-[440px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50 p-5 overflow-y-auto flex flex-col space-y-5">
                  {/* Image Gallery */}
                  {(() => {
                    const imageUrls = (summary.extracted_images || []).filter(
                      (url: string) => !url.toLowerCase().endsWith('.pdf')
                    );
                    if (imageUrls.length === 0) return null;
                    return (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150 pb-2 flex items-center justify-between">
                          <span>Auction Images</span>
                          <span className="text-[9.5px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded font-mono">{imageUrls.length} Photos</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {imageUrls.map((url: string, idx: number) => {
                            const finalSrc = signedImages[url] || url;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setLightboxImage(finalSrc)}
                                className="relative rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-white group cursor-zoom-in aspect-square"
                              >
                                <img
                                  src={finalSrc}
                                  alt={`Auction image ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-250"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {displayImage ? (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150 pb-2">
                        Catalog Document Preview
                      </h4>
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xs bg-white group p-1.5">
                        <button
                          type="button"
                          onClick={() => setLightboxImage(signedDisplayImage || displayImage)}
                          className="block w-full text-left cursor-zoom-in relative focus:outline-none"
                        >
                          <img
                            src={signedDisplayImage || displayImage}
                            alt="PDF Catalog Preview"
                            className="w-full h-auto object-cover rounded-xl group-hover:scale-[1.01] transition-transform duration-250"
                          />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full py-12 flex flex-col items-center justify-center text-slate-400 gap-2 select-none bg-white rounded-2xl border border-slate-200 shadow-2xs">
                      <svg className="w-10 h-10 text-slate-355" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      <span className="text-xs font-semibold tracking-wide">No preview available</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-150 bg-slate-50/50 flex flex-col sm:flex-row gap-3 sm:justify-end items-center">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-[15px] font-bold text-slate-650 hover:text-slate-850 hover:bg-slate-200 transition-all cursor-pointer text-center"
            >
              Close Details
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="w-full sm:w-auto inline-flex justify-center items-center py-3 px-7 rounded-xl text-[15px] font-bold text-white bg-slate-950 hover:bg-primary hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF Catalog
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-955/90 backdrop-blur-md p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer z-10"
            title="Close image"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Large Catalog Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg border border-white/10 shadow-2xl select-none animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
