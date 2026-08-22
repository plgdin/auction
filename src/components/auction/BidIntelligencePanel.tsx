import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, ChevronUp, RotateCcw, Calculator
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';

interface BidIntelligencePanelProps {
  reservePrice?: number | null;
}

export const BidIntelligencePanel: React.FC<BidIntelligencePanelProps> = ({
  reservePrice = 0,
}) => {
  const { currency } = useAppStore();
  const baseBid = reservePrice && reservePrice > 0 ? reservePrice : 100000;

  // Cost input states
  const [bidAmount, setBidAmount] = useState<number>(baseBid);
  const [sellingPrice, setSellingPrice] = useState<number>(() => Math.round(baseBid * 1.35));
  const [transportCost, setTransportCost] = useState<number>(() => Math.round(baseBid * 0.04));
  const [loadingCost, setLoadingCost] = useState<number>(() => Math.round(baseBid * 0.015));
  const [refurbishCost, setRefurbishCost] = useState<number>(() => Math.round(baseBid * 0.02));
  const [otherFees, setOtherFees] = useState<number>(() => Math.round(baseBid * 0.01));
  const [gstPercent, setGstPercent] = useState<number>(18);
  const [tcsPercent, setTcsPercent] = useState<number>(1);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Advanced costs
  const [warehouseCost, setWarehouseCost] = useState<number>(0);
  const [insuranceCost, setInsuranceCost] = useState<number>(0);
  const [contingencyCost, setContingencyCost] = useState<number>(0);

  // Currency helper
  const currencySymbol = currency === 'USD' ? '$' : '₹';

  // Cost calculation engine
  const calculation = useMemo(() => {
    const safeBid = Number(bidAmount) || 0;
    const safeSelling = Number(sellingPrice) || 0;
    const safeTransport = Number(transportCost) || 0;
    const safeLoading = Number(loadingCost) || 0;
    const safeRefurbish = Number(refurbishCost) || 0;
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

    const totalLandedCost = safeBid + gstAmount + tcsAmount + totalOverheads;
    const netProfit = safeSelling - totalLandedCost;
    const roiPercent = totalLandedCost > 0 ? (netProfit / totalLandedCost) * 100 : 0;
    const profitMargin = safeSelling > 0 ? (netProfit / safeSelling) * 100 : 0;

    // Smart bidding caps
    const conservativeCap = Math.max(0, safeSelling * 0.70 - totalOverheads - ((safeSelling * 0.70 * (gstPercent + tcsPercent)) / 100));
    const targetBidCap = Math.max(0, safeSelling * 0.80 - totalOverheads - ((safeSelling * 0.80 * (gstPercent + tcsPercent)) / 100));
    const breakEvenCap = Math.max(0, safeSelling - totalOverheads - ((safeSelling * (gstPercent + tcsPercent)) / 100));

    // Verdict
    let verdict: 'STRONG BUY' | 'BUY' | 'WATCH' | 'AVOID' = 'WATCH';
    let starCount = 3;

    if (roiPercent >= 25) {
      verdict = 'STRONG BUY';
      starCount = 5;
    } else if (roiPercent >= 12) {
      verdict = 'BUY';
      starCount = 4;
    } else if (roiPercent >= 0) {
      verdict = 'WATCH';
      starCount = 3;
    } else {
      verdict = 'AVOID';
      starCount = 1;
    }

    return {
      totalLandedCost,
      netProfit,
      roiPercent,
      profitMargin,
      gstAmount,
      tcsAmount,
      totalOverheads,
      conservativeCap,
      targetBidCap,
      breakEvenCap,
      verdict,
      starCount,
    };
  }, [
    bidAmount,
    sellingPrice,
    transportCost,
    loadingCost,
    refurbishCost,
    otherFees,
    gstPercent,
    tcsPercent,
    warehouseCost,
    insuranceCost,
    contingencyCost,
  ]);

  const stars = Array.from({ length: 5 }, (_, i) => i < calculation.starCount ? '★' : '☆').join('');

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      
      {/* Hero Recommendation Card */}
      <div
        className={clsx(
          "rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden",
          calculation.verdict === 'STRONG BUY'
            ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700"
            : calculation.verdict === 'BUY'
            ? "bg-gradient-to-r from-emerald-600 to-indigo-700"
            : calculation.verdict === 'WATCH'
            ? "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700"
            : "bg-gradient-to-r from-rose-700 via-red-700 to-rose-900"
        )}
      >
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
              AI BID VERDICT
            </span>
            <span className="text-amber-300 font-mono tracking-widest text-base">
              {stars}
            </span>
          </div>
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight">
            {calculation.verdict}
          </h3>
          <p className="text-xs text-white/80 max-w-md">
            {calculation.verdict === 'STRONG BUY'
              ? 'High-margin opportunity with low projected risk and strong upside.'
              : calculation.verdict === 'BUY'
              ? 'Profitable opportunity under current market cost assumptions.'
              : calculation.verdict === 'WATCH'
              ? 'Moderate margins. Maintain strict bidding caps to avoid losses.'
              : 'Negative ROI under current inputs. Lower your bid or increase selling price.'}
          </p>
        </div>

        {/* Key Metrics Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto relative z-10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">
              Total Landed Cost
            </span>
            <span className="text-base sm:text-lg font-black block mt-0.5">
              {formatPrice(calculation.totalLandedCost, currency)}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">
              Net Profit
            </span>
            <span className={clsx("text-base sm:text-lg font-black block mt-0.5", calculation.netProfit >= 0 ? "text-emerald-200" : "text-rose-200")}>
              {formatPrice(calculation.netProfit, currency)}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">
              ROI %
            </span>
            <span className={clsx("text-base sm:text-lg font-black block mt-0.5", calculation.roiPercent >= 0 ? "text-emerald-200" : "text-rose-200")}>
              {calculation.roiPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Smart Bid Targets (Walk-Away Recommendations) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4.5 shadow-2xs space-y-1">
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

        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4.5 shadow-2xs space-y-1">
          <span className="text-[10.5px] font-bold text-indigo-800 uppercase tracking-wider block">
            Recommended Optimal Bid
          </span>
          <span className="text-xl sm:text-2xl font-black text-indigo-950 block">
            {formatPrice(calculation.targetBidCap, currency)}
          </span>
          <span className="text-[11px] text-indigo-700 block font-medium">
            Optimal balance of win probability & return
          </span>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4.5 shadow-2xs space-y-1">
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

      {/* Interactive Cost & Valuation Simulator */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3.5 gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span>Interactive Landed Cost & Profit Simulator</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize your expected bid, transport, taxes, and selling price to recalculate real margins.
            </p>
          </div>

          <button
            onClick={() => {
              setBidAmount(baseBid);
              setSellingPrice(Math.round(baseBid * 1.35));
              setTransportCost(Math.round(baseBid * 0.04));
              setLoadingCost(Math.round(baseBid * 0.015));
              setRefurbishCost(Math.round(baseBid * 0.02));
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
            <span>Reset Estimates</span>
          </button>
        </div>

        {/* Primary Cost Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          <div>
            <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Simulated Bid Amount ({currency})
            </label>
            <div className="relative rounded-xl">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={bidAmount || ''}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Enter bid"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
              Expected Selling Price ({currency})
            </label>
            <div className="relative rounded-xl">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-emerald-600 text-xs font-bold pointer-events-none">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={sellingPrice || ''}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full pl-8 pr-3.5 py-2.5 bg-emerald-50/40 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-950 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                placeholder="Expected realization"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Transportation / Freight ({currency})
            </label>
            <div className="relative rounded-xl">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={transportCost || ''}
                onChange={(e) => setTransportCost(Number(e.target.value))}
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Loading & Handling ({currency})
            </label>
            <div className="relative rounded-xl">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={loadingCost || ''}
                onChange={(e) => setLoadingCost(Number(e.target.value))}
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Repair & Refurbishment ({currency})
            </label>
            <div className="relative rounded-xl">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={refurbishCost || ''}
                onChange={(e) => setRefurbishCost(Number(e.target.value))}
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              GST Rate
            </label>
            <select
              value={gstPercent}
              onChange={(e) => setGstPercent(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            >
              <option value={0}>0% (Exempt)</option>
              <option value={5}>5% (Concessional)</option>
              <option value={12}>12% (Standard)</option>
              <option value={18}>18% (Standard GST)</option>
              <option value={28}>28% (Luxury / Vehicles)</option>
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
            <span>{showAdvanced ? 'Hide Advanced Overhead Costs' : 'Show Advanced Overhead Costs (Warehouse, Insurance, Buffer)'}</span>
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3.5 mt-3 border-t border-slate-100">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
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
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
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
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
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

        {/* Cost Breakdown Summary Table */}
        <div className="border-t border-slate-100 pt-4">
          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Landed Cost Breakdown Summary
          </h5>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 divide-y divide-slate-200/70 text-xs">
            <div className="flex justify-between py-2">
              <span className="text-slate-600 font-medium">Base Hammer Bid Amount</span>
              <span className="font-bold text-slate-900">{formatPrice(Number(bidAmount) || 0, currency)}</span>
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
              <span className="font-black text-indigo-950">{formatPrice(calculation.totalLandedCost, currency)}</span>
            </div>
            <div className="flex justify-between py-2.5 text-sm bg-emerald-50/70 -mx-4 -mb-4 px-4 rounded-b-2xl">
              <span className="text-emerald-950 font-black">Projected Net Profit Realization</span>
              <span className={clsx("font-black", calculation.netProfit >= 0 ? "text-emerald-800" : "text-rose-800")}>
                {formatPrice(calculation.netProfit, currency)} ({calculation.profitMargin.toFixed(1)}% Margin)
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default BidIntelligencePanel;
