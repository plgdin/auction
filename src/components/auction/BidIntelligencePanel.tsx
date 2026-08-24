import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, ChevronUp, RotateCcw, Calculator, Info
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';

interface BidIntelligencePanelProps {
  itemTitle?: string;
  reservePrice?: number | null;
  categoryName?: string;
  location?: string;
  quantity?: number;
  rawDescription?: string;
}

export const BidIntelligencePanel: React.FC<BidIntelligencePanelProps> = ({
  itemTitle,
  reservePrice = 0,
  categoryName,
  location,
  quantity = 1,
}) => {
  const { currency } = useAppStore();
  const baseBid = reservePrice && reservePrice > 0 ? reservePrice : 100000;

  // Cost inputs
  const [currentBid, setCurrentBid] = useState<number>(baseBid);
  const [userSellingPrice, setUserSellingPrice] = useState<number>(() => Math.round(baseBid * 1.35));
  const [transportation, setTransportation] = useState<number>(() => Math.round(baseBid * 0.04));
  const [loadingUnloading, setLoadingUnloading] = useState<number>(() => Math.round(baseBid * 0.015));
  const [refurbishment, setRefurbishment] = useState<number>(() => Math.round(baseBid * 0.02));
  const [otherFees, setOtherFees] = useState<number>(() => Math.round(baseBid * 0.01));
  const [gstPercent, setGstPercent] = useState<number>(18);
  const [tcsPercent, setTcsPercent] = useState<number>(1);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [warehouseCost, setWarehouseCost] = useState<number>(0);
  const [insuranceCost, setInsuranceCost] = useState<number>(0);
  const [contingencyCost, setContingencyCost] = useState<number>(0);

  const currencySymbol = currency === 'USD' ? '$' : '₹';

  // Real-time calculation engine
  const calculation = useMemo(() => {
    const safeBid = Number(currentBid) || 0;
    const safeSelling = Number(userSellingPrice) || 0;
    const safeTransport = Number(transportation) || 0;
    const safeLoading = Number(loadingUnloading) || 0;
    const safeRefurbish = Number(refurbishment) || 0;
    const safeOther = Number(otherFees) || 0;
    const safeWarehouse = Number(warehouseCost) || 0;
    const safeInsurance = Number(insuranceCost) || 0;
    const safeContingency = Number(contingencyCost) || 0;

    const gstAmount = (safeBid * gstPercent) / 100;
    const tcsAmount = (safeBid * tcsPercent) / 100;

    const totalOverheads = 
      safeTransport + 
      safeLoading + 
      safeRefurbish + 
      safeOther + 
      safeWarehouse + 
      safeInsurance + 
      safeContingency;

    const totalCost = safeBid + gstAmount + tcsAmount + totalOverheads;
    const totalLotValue = safeSelling;
    const estimatedProfit = totalLotValue > 0 ? totalLotValue - totalCost : 0;
    const roiPercent = totalCost > 0 ? Math.round(((totalLotValue - totalCost) / totalCost) * 1000) / 10 : 0;
    const profitMargin = totalLotValue > 0 ? ((totalLotValue - totalCost) / totalLotValue) * 100 : 0;

    // Smart caps
    const conservativeCap = Math.max(0, Math.round(totalLotValue * 0.70 - totalOverheads - ((totalLotValue * 0.70 * (gstPercent + tcsPercent)) / 100)));
    const targetBidCap = Math.max(0, Math.round(totalLotValue * 0.80 - totalOverheads - ((totalLotValue * 0.80 * (gstPercent + tcsPercent)) / 100)));
    const breakEvenCap = Math.max(0, Math.round(totalLotValue - totalOverheads - ((totalLotValue * (gstPercent + tcsPercent)) / 100)));

    let status: 'Strong Buy' | 'Buy' | 'Watch' | 'Avoid' = 'Watch';
    let starCount = 3;
    let confidence = 88;

    if (roiPercent >= 25) {
      status = 'Strong Buy';
      starCount = 5;
      confidence = 94;
    } else if (roiPercent >= 12) {
      status = 'Buy';
      starCount = 4;
      confidence = 90;
    } else if (roiPercent >= 0) {
      status = 'Watch';
      starCount = 3;
      confidence = 85;
    } else {
      status = 'Avoid';
      starCount = 1;
      confidence = 82;
    }

    return {
      totalCost,
      totalLotValue,
      estimatedProfit,
      roiPercent,
      profitMargin,
      gstAmount,
      tcsAmount,
      totalOverheads,
      conservativeCap,
      targetBidCap,
      breakEvenCap,
      status,
      starCount,
      confidence,
    };
  }, [
    currentBid,
    userSellingPrice,
    transportation,
    loadingUnloading,
    refurbishment,
    otherFees,
    gstPercent,
    tcsPercent,
    warehouseCost,
    insuranceCost,
    contingencyCost,
  ]);

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {itemTitle && (
        <div className="bg-white border border-slate-200/80 rounded-2xl px-4.5 py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-900 text-sm truncate">{itemTitle}</span>
            {categoryName && (
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider shrink-0">
                {categoryName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
            {location && <span>📍 {location}</span>}
            {quantity && quantity > 1 && <span className="text-primary font-bold">Qty: {quantity}</span>}
          </div>
        </div>
      )}

      {/* ═══════ SECTION 1: Enter Your Costs (Cost Input Form Card) ═══════ */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span>Enter Your Costs</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Fill in your expenses to see your real-time profit and return.</p>
          </div>
          <button
            onClick={() => {
              setCurrentBid(baseBid);
              setUserSellingPrice(Math.round(baseBid * 1.35));
              setTransportation(Math.round(baseBid * 0.04));
              setLoadingUnloading(Math.round(baseBid * 0.015));
              setRefurbishment(Math.round(baseBid * 0.02));
              setOtherFees(Math.round(baseBid * 0.01));
              setGstPercent(18);
              setTcsPercent(1);
              setWarehouseCost(0);
              setInsuranceCost(0);
              setContingencyCost(0);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Costs</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Your Bid Amount ({currency})
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
              </div>
              <input
                type="number"
                value={currentBid || ''}
                onChange={(e) => setCurrentBid(Number(e.target.value))}
                className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">
              Your Expected Selling Price ({currency})
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
              </div>
              <input
                type="number"
                value={userSellingPrice || ''}
                onChange={(e) => setUserSellingPrice(Number(e.target.value))}
                placeholder="What you think you can sell for"
                className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-emerald-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/30"
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">What you expect to sell the asset or lot items for</p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Transportation Cost ({currency})
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
              </div>
              <input
                type="number"
                value={transportation || ''}
                onChange={(e) => setTransportation(Number(e.target.value))}
                className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Loading & Unloading ({currency})
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
              </div>
              <input
                type="number"
                value={loadingUnloading || ''}
                onChange={(e) => setLoadingUnloading(Number(e.target.value))}
                className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Repair / Cleaning Costs ({currency})
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
              </div>
              <input
                type="number"
                value={refurbishment || ''}
                onChange={(e) => setRefurbishment(Number(e.target.value))}
                className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Other Charges ({currency})
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xs font-semibold">{currencySymbol}</span>
              </div>
              <input
                type="number"
                value={otherFees || ''}
                onChange={(e) => setOtherFees(Number(e.target.value))}
                className="block w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              GST Rate (%)
            </label>
            <select
              value={gstPercent}
              onChange={(e) => setGstPercent(Number(e.target.value))}
              className="block w-full px-3 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer shadow-2xs h-[38px]"
            >
              <option value={0}>0% (Exempt)</option>
              <option value={5}>5% (Concessional)</option>
              <option value={12}>12% (Standard Concession)</option>
              <option value={18}>18% (Standard GST)</option>
              <option value={28}>28% (Luxury / Vehicles)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              TCS Rate (%)
            </label>
            <select
              value={tcsPercent}
              onChange={(e) => setTcsPercent(Number(e.target.value))}
              className="block w-full px-3 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer shadow-2xs h-[38px]"
            >
              <option value={0}>0% (Exempt)</option>
              <option value={0.1}>0.1% (Standard TCS)</option>
              <option value={1}>1% (Scrap Metal & Vehicles)</option>
              <option value={2}>2% (Higher Rate)</option>
              <option value={5}>5% (Special Assets)</option>
            </select>
          </div>
        </div>

        {/* Toggle Advanced Costs */}
        <div className="pt-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{showAdvanced ? 'Hide Advanced Overhead Costs' : 'Show Advanced Overhead Costs (Warehouse, Insurance, Safety Buffer)'}</span>
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3.5 mt-3 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Warehouse & Yard Rent ({currency})
                </label>
                <input
                  type="number"
                  value={warehouseCost || ''}
                  onChange={(e) => setWarehouseCost(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Transit Insurance ({currency})
                </label>
                <input
                  type="number"
                  value={insuranceCost || ''}
                  onChange={(e) => setInsuranceCost(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Safety Buffer ({currency})
                </label>
                <input
                  type="number"
                  value={contingencyCost || ''}
                  onChange={(e) => setContingencyCost(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ SECTION 2: Financial Summary — 4-Card Layout ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Selling Price */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-1">
          <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <span>You Can Sell For</span>
            <div className="relative group inline-block">
              <Info className="w-3.5 h-3.5 text-blue-500 hover:text-blue-600 transition-colors inline-block cursor-help shrink-0 ml-0.5" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[9.5px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none">
                How much you can sell all items in this lot for, based on current market prices.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          </h5>
          <div className="text-sm sm:text-base font-black text-slate-900 truncate">
            {calculation.totalLotValue > 0 ? formatPrice(calculation.totalLotValue, currency) : '—'}
          </div>
          <p className="text-[9px] text-slate-400 font-medium">Market selling price</p>
        </div>

        {/* Cost Price */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-1">
          <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <span>Total You'll Spend</span>
            <div className="relative group inline-block">
              <Info className="w-3.5 h-3.5 text-blue-500 hover:text-blue-600 transition-colors inline-block cursor-help shrink-0 ml-0.5" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[9.5px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none">
                Everything you'll spend — your bid, taxes, transport, loading, and all other costs added up.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          </h5>
          <div className="text-sm sm:text-base font-black text-slate-900 truncate">
            {calculation.totalCost > 0 ? formatPrice(calculation.totalCost, currency) : '—'}
          </div>
          <p className="text-[9px] text-slate-500 font-bold">Bid + tax + all costs</p>
        </div>

        {/* Profit */}
        <div className={clsx(
          "rounded-2xl p-3.5 border shadow-2xs space-y-1",
          calculation.totalLotValue <= 0
            ? "bg-slate-50 border-slate-200 text-slate-500"
            : calculation.estimatedProfit >= 0
            ? "bg-emerald-50/50 border-emerald-100 text-emerald-950"
            : "bg-rose-50/50 border-rose-100 text-rose-950"
        )}>
          <h5 className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
            <span className="opacity-60">Your Profit</span>
            <div className="relative group inline-block">
              <Info className="w-3.5 h-3.5 text-blue-500 hover:text-blue-600 transition-colors inline-block cursor-help shrink-0 ml-0.5" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[9.5px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none">
                How much money you keep after selling. Green = you make money, Red = you lose money.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          </h5>
          <div className="text-sm sm:text-base font-black truncate">
            {calculation.totalLotValue > 0
              ? `${calculation.estimatedProfit >= 0 ? '+' : ''}${formatPrice(calculation.estimatedProfit, currency)}`
              : '—'
            }
          </div>
          <p className="text-[9px] opacity-70 font-medium">Money you keep</p>
        </div>

        {/* ROI % */}
        <div className={clsx(
          "rounded-2xl p-3.5 border shadow-2xs space-y-1",
          calculation.roiPercent >= 20
            ? "bg-emerald-50/50 border-emerald-100 text-emerald-950"
            : calculation.roiPercent >= 0
            ? "bg-amber-50/50 border-amber-100 text-amber-950"
            : "bg-rose-50/50 border-rose-100 text-rose-950"
        )}>
          <h5 className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
            <span className="opacity-60">% Return</span>
            <div className="relative group inline-block">
              <Info className="w-3.5 h-3.5 text-blue-500 hover:text-blue-600 transition-colors inline-block cursor-help shrink-0 ml-0.5" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[9.5px] font-medium normal-case leading-normal rounded-lg shadow-lg z-50 pointer-events-none">
                For every ₹100 you spend, how much profit you make. Higher is better.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          </h5>
          <div className="text-sm sm:text-base font-black truncate">{calculation.roiPercent}%</div>
          <p className="text-[9px] opacity-70 font-medium">Profit per ₹100 spent</p>
        </div>
      </div>

      {/* ═══════ SECTION 4: Smart Target Bidding Caps ═══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider block">
            Conservative Target (25% ROI)
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-950 block">
            {formatPrice(calculation.conservativeCap, currency)}
          </span>
          <span className="text-[11px] text-emerald-700 block font-medium">
            Safe entry bid with high safety buffer
          </span>
        </div>

        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10.5px] font-bold text-indigo-800 uppercase tracking-wider block">
            Recommended Target Bid
          </span>
          <span className="text-xl sm:text-2xl font-black text-indigo-950 block">
            {formatPrice(calculation.targetBidCap, currency)}
          </span>
          <span className="text-[11px] text-indigo-700 block font-medium">
            Optimal balance of win probability & return
          </span>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wider block">
            Walk-Away Ceiling (Break-Even)
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-950 block">
            {formatPrice(calculation.breakEvenCap, currency)}
          </span>
          <span className="text-[11px] text-amber-700 block font-medium">
            Do not exceed this price to prevent losses
          </span>
        </div>
      </div>

      {/* ═══════ SECTION 5: Landed Cost Breakdown Summary Table ═══════ */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Landed Cost Breakdown Summary
        </h5>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 divide-y divide-slate-200/70 text-xs">
          <div className="flex justify-between py-2">
            <span className="text-slate-600 font-medium">Base Hammer Bid Amount</span>
            <span className="font-bold text-slate-900">{formatPrice(Number(currentBid) || 0, currency)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-600 font-medium">GST Tax ({gstPercent}%)</span>
            <span className="font-bold text-slate-900">{formatPrice(calculation.gstAmount, currency)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-600 font-medium">TCS Tax ({tcsPercent}%)</span>
            <span className="font-bold text-slate-900">{formatPrice(calculation.tcsAmount, currency)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-600 font-medium">Logistics & Handling Overheads</span>
            <span className="font-bold text-slate-900">{formatPrice(calculation.totalOverheads, currency)}</span>
          </div>
          <div className="flex justify-between py-2.5 text-sm">
            <span className="text-slate-950 font-black">Total Landed Acquisition Cost</span>
            <span className="font-black text-indigo-950">{formatPrice(calculation.totalCost, currency)}</span>
          </div>
          <div className="flex justify-between py-2.5 text-sm bg-emerald-50/70 -mx-4 -mb-4 px-4 rounded-b-2xl">
            <span className="text-emerald-950 font-black">Projected Net Profit Realization</span>
            <span className={clsx("font-black", calculation.estimatedProfit >= 0 ? "text-emerald-800" : "text-rose-800")}>
              {formatPrice(calculation.estimatedProfit, currency)} ({calculation.profitMargin.toFixed(1)}% Margin)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidIntelligencePanel;
