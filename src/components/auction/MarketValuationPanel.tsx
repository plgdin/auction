import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, BarChart3, Calculator, RefreshCw, Sparkles,
  Cpu, ChevronDown, ChevronUp
} from 'lucide-react';
import type { Auction } from '../../types/database.types';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';
import { 
  METALLIC_MODELS, 
  DEFAULT_MACRO_INPUTS,  
  predictPrice, 
  detectModelId, 
  detectGrade, 
  detectRegion
} from '../../utils/metalValuationModels';
import type { MacroInputs } from '../../utils/metalValuationModels';
import { marketPriceService } from '../../services/marketPriceService';

interface MarketValuationPanelProps {
  auction: Auction;
  currentBid: number;
}

export function MarketValuationPanel({ auction, currentBid }: MarketValuationPanelProps) {
  const { currency } = useAppStore();
  // Check if this is a metal-related product
  const titleLower = auction.title.toLowerCase();
  const isMetal = 
    titleLower.includes('scrap') || 
    titleLower.includes('steel') || 
    titleLower.includes('iron') || 
    titleLower.includes('copper') || 
    titleLower.includes('aluminium') || 
    titleLower.includes('aluminum') || 
    titleLower.includes('metal') || 
    titleLower.includes('vehicle') || 
    titleLower.includes('car') || 
    titleLower.includes('truck') || 
    titleLower.includes('bus') || 
    titleLower.includes('transport') || 
    titleLower.includes('auto') ||
    titleLower.includes('e-waste') ||
    titleLower.includes('ewaste') ||
    titleLower.includes('motherboard') ||
    titleLower.includes('printer') ||
    titleLower.includes('monitor') ||
    titleLower.includes('computer') ||
    titleLower.includes('laptop') ||
    titleLower.includes('smartphone') ||
    titleLower.includes('tablet') ||
    titleLower.includes('tv') ||
    titleLower.includes('camera') ||
    titleLower.includes('smartwatch') ||
    titleLower.includes('console') ||
    titleLower.includes('electronics');

  // Parse initial quantity and unit
  const parseQuantityAndUnit = (title: string) => {
    const cleanTitle = title.replace(/,/g, '');
    const match = cleanTitle.match(/(\d+(?:\.\d+)?)\s*(MT|Tons|Ton|kg|Kg|g|Nos|Pcs|Units|Barrels|Liters)/i);
    if (match) {
      return {
        qty: parseFloat(match[1]),
        unit: match[2]
      };
    }
    // Check for common fallback values
    if (cleanTitle.toLowerCase().includes('gold')) return { qty: 100, unit: 'g' };
    if (cleanTitle.toLowerCase().includes('silver')) return { qty: 10, unit: 'kg' };
    if (cleanTitle.toLowerCase().includes('copper')) return { qty: 5, unit: 'Tons' };
    if (cleanTitle.toLowerCase().includes('coal')) return { qty: 25, unit: 'Tons' };
    return { qty: 1, unit: 'Unit' };
  };

  const initialParsed = parseQuantityAndUnit(auction.title);

  // States for interactive calculator
  const [activeTab, setActiveTab] = useState<'market' | 'regression'>(isMetal ? 'regression' : 'market');
  const [simulatedBid, setSimulatedBid] = useState<number>(currentBid || auction.starting_price);
  const [quantity, setQuantity] = useState<number>(initialParsed.qty);
  const [showTaxes, setShowTaxes] = useState<boolean>(true);

  // AI Regression States
  const [selectedModelId, setSelectedModelId] = useState<string>(detectModelId(auction.title) || 'scrap_steel');
  const [selectedGrade, setSelectedGrade] = useState<string>(detectGrade(auction.title, selectedModelId));
  const [selectedRegion, setSelectedRegion] = useState<string>(detectRegion(auction.location || '', auction.title));
  const [macroInputs, setMacroInputs] = useState<MacroInputs>(DEFAULT_MACRO_INPUTS);
  const [showMacroSettings, setShowMacroSettings] = useState<boolean>(false);

  // Sync simulated bid if current bid changes (e.g. real-time updates)
  useEffect(() => {
    if (currentBid) {
      setSimulatedBid(currentBid);
    }
  }, [currentBid]);

  // Ensure fresh data is fetched when panel opens
  useEffect(() => {
    let mounted = true;
    const fetchFreshPrices = async () => {
      try {
        await marketPriceService.fetchCommodityPrices();
        await marketPriceService.fetchPriceHistoryLogs();
        if (mounted) {
          // Force a re-render to pick up new prices if they changed
          setQuantity(prev => prev);
        }
      } catch (e) {
        console.warn('Failed to fetch fresh prices in Valuation Panel', e);
      }
    };
    fetchFreshPrices();
    return () => { mounted = false; };
  }, []);

  // Sync grade when model changes
  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    const model = METALLIC_MODELS[modelId];
    if (model) {
      setSelectedGrade(model.grades[0]);
    }
  };

  // Determine market rate based on title/category
  const getMarketData = (title: string, basePrice: number) => {
    const t = title.toLowerCase();

    const getHistoryForComm = (commId: string, mult = 1, fallbackArray: number[]) => {
      try {
        const logs = marketPriceService.getPriceHistoryLogs()
          .filter(log => log.commodityId === commId)
          .slice(0, 6)
          .reverse(); // oldest first for chart
        if (logs.length >= 3) {
          return logs.map(log => log.price * mult);
        }
      } catch (e) {
        console.warn('Error reading price history logs:', e);
      }
      return fallbackArray;
    };

    if (t.includes('gold')) {
      const priceVal = marketPriceService.getCommodityPrice('gold') || 7450;
      return { 
        name: 'Gold (99.9% Purity)', 
        avgPrice: priceVal, 
        unit: 'g', 
        source: 'Metals API', 
        trend: 'up',
        history: getHistoryForComm('gold', 1, [7320, 7350, 7390, 7380, 7420, 7450]),
        multiplier: 1
      };
    }
    if (t.includes('silver')) {
      const priceVal = marketPriceService.getCommodityPrice('silver') || 91000;
      return { 
        name: 'Silver (99.9% Purity)', 
        avgPrice: priceVal, 
        unit: 'kg', 
        source: 'Metals API', 
        trend: 'up',
        history: getHistoryForComm('silver', 1, [88500, 89200, 89900, 90100, 90500, 91000]),
        multiplier: 1
      };
    }
    if (t.includes('copper')) {
      const priceVal = (marketPriceService.getCommodityPrice('copper') || 780) * 1000;
      return { 
        name: 'Copper Cathodes / Wire Scrap', 
        avgPrice: priceVal, 
        unit: 'Tons', 
        source: 'Commodities API', 
        trend: 'up',
        history: getHistoryForComm('copper', 1000, [760000, 765000, 772000, 770000, 778000, 780000]),
        multiplier: 1
      };
    }
    if (t.includes('aluminium') || t.includes('aluminum')) {
      const priceVal = (marketPriceService.getCommodityPrice('aluminium') || 235) * 1000;
      return { 
        name: 'Aluminium Ingots (99.7% LME)', 
        avgPrice: priceVal, 
        unit: 'Tons', 
        source: 'Commodities API', 
        trend: 'stable',
        history: getHistoryForComm('aluminium', 1000, [234000, 236000, 235000, 233000, 235000, 235000]),
        multiplier: 1
      };
    }
    if (t.includes('wheat')) {
      const priceVal = (marketPriceService.getCommodityPrice('wheat') || 2450) * 10;
      return { 
        name: 'Wheat (Durum Grade A)', 
        avgPrice: priceVal, 
        unit: 'Tons', 
        source: 'API Ninjas Commodity API', 
        trend: 'stable',
        history: getHistoryForComm('wheat', 10, [24200, 24300, 24500, 24400, 24600, 24500]),
        multiplier: 1
      };
    }
    if (t.includes('maize') || t.includes('corn')) {
      const priceVal = marketPriceService.getCommodityPrice('maize_corn') || 21000;
      return { 
        name: 'Yellow Maize / Feed Corn', 
        avgPrice: priceVal, 
        unit: 'Tons', 
        source: 'API Ninjas Commodity API', 
        trend: 'stable',
        history: getHistoryForComm('maize_corn', 1, [20800, 20950, 21000, 21100, 21050, 21000]),
        multiplier: 1
      };
    }
    if (t.includes('paddy') || t.includes('rice')) {
      const priceVal = (marketPriceService.getCommodityPrice('rice') || 2200) * 10;
      return { 
        name: 'Basmati Paddy / Rice', 
        avgPrice: priceVal, 
        unit: 'Tons', 
        source: 'API Ninjas Commodity API', 
        trend: 'stable',
        history: getHistoryForComm('rice', 10, [21800, 21900, 22100, 22000, 22250, 22000]),
        multiplier: 1
      };
    }
    if (t.includes('coal') || t.includes('lignite')) {
      const priceVal = marketPriceService.getCommodityPrice('coal') || 8400;
      return { 
        name: 'Steam Coal (5500 GAR)', 
        avgPrice: priceVal, 
        unit: 'Tons', 
        source: 'API Ninjas Commodity API', 
        trend: 'down',
        history: getHistoryForComm('coal', 1, [8900, 8750, 8600, 8550, 8480, 8400]),
        multiplier: 1
      };
    }
    if (t.includes('oil') || t.includes('petroleum')) {
      const priceVal = marketPriceService.getCommodityPrice('crude_oil') || 6800;
      return { 
        name: 'Crude Oil (WTI Index)', 
        avgPrice: priceVal, 
        unit: 'Barrels', 
        source: 'API Ninjas Commodity API', 
        trend: 'down',
        history: getHistoryForComm('crude_oil', 1, [7200, 7100, 6950, 6890, 6840, 6800]),
        multiplier: 1
      };
    }
    if (t.includes('gas')) {
      const priceVal = marketPriceService.getCommodityPrice('natural_gas') || 210;
      return { 
        name: 'Natural Gas (Henry Hub)', 
        avgPrice: priceVal, 
        unit: 'MMBtu', 
        source: 'API Ninjas Commodity API', 
        trend: 'down',
        history: getHistoryForComm('natural_gas', 1, [240, 232, 225, 218, 212, 210]),
        multiplier: 1
      };
    }
    if (t.includes('computer') || t.includes('laptop') || t.includes('tablet') || t.includes('electronics')) {
      const priceVal = marketPriceService.getCommodityPrice('e_waste') || Math.round(basePrice * 1.38);
      return { 
        name: 'Refurbished IT Hardware Index', 
        avgPrice: priceVal, 
        unit: 'Units', 
        source: 'DataForSEO Product API', 
        trend: 'stable',
        history: getHistoryForComm('e_waste', 1, [basePrice * 1.35, basePrice * 1.36, basePrice * 1.38, basePrice * 1.37, basePrice * 1.39, basePrice * 1.38]),
        multiplier: 1
      };
    }
    if (t.includes('vehicle') || t.includes('car') || t.includes('truck') || t.includes('bus') || t.includes('transport')) {
      const priceVal = marketPriceService.getCommodityPrice('vehicle') || Math.round(basePrice * 1.28);
      return { 
        name: 'Commercial Vehicle Resale Index', 
        avgPrice: priceVal, 
        unit: 'Units', 
        source: 'Zenserp Shopping API', 
        trend: 'stable',
        history: getHistoryForComm('vehicle', 1, [basePrice * 1.25, basePrice * 1.26, basePrice * 1.27, basePrice * 1.28, basePrice * 1.29, basePrice * 1.28]),
        multiplier: 1
      };
    }
    if (t.includes('scrap') || t.includes('waste')) {
      const priceVal = marketPriceService.getCommodityPrice('industrial_scrap_index') || Math.round(basePrice * 1.32);
      return { 
        name: 'Industrial Scrap Metal Index', 
        avgPrice: priceVal, 
        unit: 'Tons', 
        source: 'Commodities API', 
        trend: 'up',
        history: getHistoryForComm('industrial_scrap_index', 1, [basePrice * 1.28, basePrice * 1.30, basePrice * 1.32, basePrice * 1.31, basePrice * 1.33, basePrice * 1.32]),
        multiplier: 1
      };
    }
    // Generic fallback based on starting price
    const fallbackPrice = marketPriceService.getCommodityPrice('default') || Math.round(basePrice * 1.35);
    return { 
      name: 'Estimated Market Valuation', 
      avgPrice: fallbackPrice, 
      unit: 'Units', 
      source: 'PriceAPI Consumer Index', 
      trend: 'stable',
      history: getHistoryForComm('default', 1, [basePrice * 1.30, basePrice * 1.32, basePrice * 1.35, basePrice * 1.34, basePrice * 1.36, basePrice * 1.35]),
      multiplier: 1
    };
  };


  const marketData = getMarketData(auction.title, auction.starting_price);

  // Check if we are using the Regression model or the basic market indexing
  const isRegression = isMetal && activeTab === 'regression';
  const selectedModel = METALLIC_MODELS[selectedModelId] || METALLIC_MODELS.scrap_steel;

  // Calculate predicted price
  const predictedPrice = isMetal
    ? predictPrice(selectedModelId, selectedGrade, selectedRegion, macroInputs, auction.title)
    : 0;

  // Generate regression history points based on variation in LME or USD_INR
  const getRegressionHistory = () => {
    const points: number[] = [];
    const baseLME = macroInputs.LME_Steel_Scrap_USD;
    for (let i = -3; i <= 2; i++) {
      const tempInputs = {
        ...macroInputs,
        LME_Steel_Scrap_USD: baseLME + i * 15
      };
      points.push(predictPrice(selectedModelId, selectedGrade, selectedRegion, tempInputs, auction.title));
    }
    return points;
  };
  const regressionHistory = getRegressionHistory();

  // Quantity calculations (Regression units match price directly, e.g. price per Ton and quantity in Tons)
  const isMT = !isRegression && (initialParsed.unit || '').toUpperCase().trim() === 'MT';
  const qtyMultiplier = 1; // 1 MT = 1 Metric Ton = 1 Ton
  const computedQty = quantity * qtyMultiplier;

  // Financial calculations
  const unitBidPrice = simulatedBid;
  const unitMarketPrice = isRegression ? predictedPrice : marketData.avgPrice;
  const displayUnit = isRegression ? selectedModel.targetUnit : (isMT ? 'Metric Ton' : marketData.unit);

  // Acquisition Cost calculations
  const rawAcquisitionCost = unitBidPrice * computedQty;
  const buyerPremium = showTaxes ? rawAcquisitionCost * 0.02 : 0; // 2% Buyer Premium
  const gstTax = showTaxes ? (rawAcquisitionCost + buyerPremium) * 0.18 : 0; // 18% GST on purchase
  const totalCost = rawAcquisitionCost + buyerPremium + gstTax;

  // Turnover / Sales projection
  const totalTurnover = unitMarketPrice * computedQty;

  // Net Profit & Profitability
  const netProfit = totalTurnover - totalCost;
  const profitabilityPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const discountRate = unitMarketPrice > 0 ? ((unitMarketPrice - unitBidPrice) / unitMarketPrice) * 100 : 0;

  // Helper to update individual macro variables
  const updateMacro = (key: keyof MacroInputs, value: number) => {
    setMacroInputs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Generate SVG chart path dynamically
  const generateSparkline = (points: number[]) => {
    if (points.length < 2) return '';
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const height = 40;
    const width = 120;
    const padding = 2;
    
    return points.map((p, index) => {
      const x = (index / (points.length - 1)) * (width - 2 * padding) + padding;
      const y = height - padding - ((p - min) / range) * (height - 2 * padding);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-white flex flex-col h-full font-sans transition-all hover:border-primary-500/30">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 to-slate-900 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center border border-primary-500/20 text-primary-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-200">Market Intelligence</h3>
            <span className="text-[10px] text-slate-400 font-medium">Real-Time Profit Analyst</span>
          </div>
        </div>
        
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-950 px-2.5 py-1 rounded border border-slate-850">
          PRO EDITION
        </span>
      </div>

      {/* Tabs for Metal products */}
      {isMetal && (
        <div className="flex border-b border-slate-800 bg-slate-950/20 p-1">
          <button
            onClick={() => setActiveTab('regression')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'regression'
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-205 border border-transparent'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> AI ML Forecast
          </button>
          <button
            onClick={() => setActiveTab('market')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'market'
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-205 border border-transparent'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Standard index
          </button>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col justify-between gap-6">
        {/* Tab 1: AI ML Prediction panel */}
        {isRegression ? (
          <div className="bg-slate-955/40 p-4 rounded-xl border border-slate-850/50 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary-400 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-primary-400 animate-pulse" /> Advanced ML Forecast
                </span>
                <h4 className="font-bold text-slate-100 text-sm leading-tight mt-0.5">{selectedModel.name}</h4>
              </div>
              
              {selectedModel.isPlaceholder && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded">
                  Baseline Draft
                </span>
              )}
            </div>

            {/* Model and Grade Selectors */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Active Model</label>
                <select
                  value={selectedModelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary-500/50 cursor-pointer"
                >
                  {Object.values(METALLIC_MODELS).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Target Grade</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary-500/50 cursor-pointer"
                >
                  {selectedModel.grades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Region Selector */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Market Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary-500/50 cursor-pointer"
                >
                  {selectedModel.regions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Model Target Unit</label>
                <div className="w-full bg-slate-950/40 border border-slate-850/50 text-slate-400 rounded-lg px-2.5 py-1.5 font-bold">
                  Per {selectedModel.targetUnit}
                </div>
              </div>
            </div>

            {/* Macroeconomic Drivers Toggle */}
            <div className="border-t border-slate-800/80 pt-3">
              <button
                onClick={() => setShowMacroSettings(!showMacroSettings)}
                className="text-[11px] font-bold text-slate-400 hover:text-primary-400 flex items-center justify-between w-full transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-slate-550" /> MACROECONOMIC PRICE DRIVERS
                </span>
                {showMacroSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showMacroSettings && (
                <div className="mt-3 space-y-3 bg-slate-950/40 p-3 rounded-lg border border-slate-850/60 text-[11px] max-h-56 overflow-y-auto custom-scrollbar">
                  {/* LME Steel Scrap USD */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>LME Steel Scrap:</span>
                      <span className="font-bold text-slate-200">${macroInputs.LME_Steel_Scrap_USD.toFixed(1)}/Ton</span>
                    </div>
                    <input
                      type="range"
                      min={200}
                      max={600}
                      step={5}
                      value={macroInputs.LME_Steel_Scrap_USD}
                      onChange={(e) => updateMacro('LME_Steel_Scrap_USD', parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                  </div>

                  {/* USD INR Rate */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>USD/INR Exchange Rate:</span>
                      <span className="font-bold text-slate-200">₹{macroInputs.USD_INR.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={75}
                      max={90}
                      step={0.05}
                      value={macroInputs.USD_INR}
                      onChange={(e) => updateMacro('USD_INR', parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                  </div>

                  {/* Domestic Iron Ore INR */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Domestic Iron Ore:</span>
                      <span className="font-bold text-slate-200">₹{macroInputs.Domestic_Iron_Ore_INR.toFixed(0)}/Ton</span>
                    </div>
                    <input
                      type="range"
                      min={3000}
                      max={8000}
                      step={50}
                      value={macroInputs.Domestic_Iron_Ore_INR}
                      onChange={(e) => updateMacro('Domestic_Iron_Ore_INR', parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                  </div>

                  {/* Domestic Coal INR */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Domestic Coal:</span>
                      <span className="font-bold text-slate-200">₹{macroInputs.Domestic_Coal_INR.toFixed(0)}/Ton</span>
                    </div>
                    <input
                      type="range"
                      min={5000}
                      max={15000}
                      step={100}
                      value={macroInputs.Domestic_Coal_INR}
                      onChange={(e) => updateMacro('Domestic_Coal_INR', parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                  </div>

                  {/* Construction Index */}
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Construction Health Index:</span>
                      <span className="font-bold text-slate-200">{macroInputs.Construction_Index.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={140}
                      step={0.5}
                      value={macroInputs.Construction_Index}
                      onChange={(e) => updateMacro('Construction_Index', parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                  </div>

                  {/* Monsoon season active */}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-900">
                    <span className="text-slate-400">Monsoon Season Active:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={macroInputs.Monsoon_Season === 1}
                        onChange={(e) => updateMacro('Monsoon_Season', e.target.checked ? 1 : 0)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-350 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-500 peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500 font-medium block">AI Forecast Rate</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg font-black text-sky-400">{formatPrice(unitMarketPrice, currency)}</span>
                  <span className="text-[10px] text-slate-400">/ {selectedModel.targetUnit}</span>
                </div>
              </div>

              {/* Sparkline chart for regression model */}
              <div className="flex flex-col items-center gap-1">
                <svg className="w-24 h-8 overflow-visible" viewBox="0 0 120 40">
                  <path
                    d={generateSparkline(regressionHistory)}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[9px] font-bold text-sky-400 tracking-wider">AI Trend</span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-medium block">Acquisition Discount</span>
                <span className={`font-extrabold ${discountRate > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {discountRate > 0 ? `${discountRate.toFixed(1)}% below forecast` : '0%'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Standard Index comparison column */
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850/50">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary-400">Live Valuation Feed</span>
                <h4 className="font-bold text-slate-100 text-sm leading-tight mt-0.5">{marketData.name}</h4>
              </div>
              
              <span className="text-[9px] font-bold text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                {marketData.source}
              </span>
            </div>

            <div className="flex items-end justify-between mt-4">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Avg Market Price</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-white">{formatPrice(unitMarketPrice, currency)}</span>
                  <span className="text-xs text-slate-400">/ {marketData.unit}</span>
                </div>
              </div>

              {/* Sparkline chart and trend */}
              <div className="flex flex-col items-end gap-1.5">
                <svg className="w-24 h-10 overflow-visible" viewBox="0 0 120 40">
                  <path
                    d={generateSparkline(marketData.history)}
                    fill="none"
                    stroke={marketData.trend === 'up' ? '#10b981' : marketData.trend === 'down' ? '#ef4444' : '#64748b'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  {marketData.trend === 'up' ? (
                    <span className="text-green-400 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> +4.2% MoM
                    </span>
                  ) : marketData.trend === 'down' ? (
                    <span className="text-red-400 flex items-center gap-0.5">
                      <TrendingDown className="w-3 h-3" /> -1.8% MoM
                    </span>
                  ) : (
                    <span className="text-slate-400">Stable Index</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-xs">
              <span className="text-slate-400">Acquisition Discount</span>
              <span className="font-extrabold text-green-400">
                {discountRate > 0 ? `${discountRate.toFixed(1)}% below market` : '0%'}
              </span>
            </div>
          </div>
        )}

        {/* Profitability projections */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calculator className="w-3.5 h-3.5 text-slate-500" />
              <span>Projected ROI Calculator</span>
            </div>
            
            <button 
              onClick={() => {
                setSimulatedBid(currentBid || auction.starting_price);
                setQuantity(initialParsed.qty);
              }}
              className="text-[10px] text-slate-500 hover:text-primary-400 transition-colors flex items-center gap-1"
              title="Reset Simulated Values"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Reset
            </button>
          </div>

          {/* Interactive Simulation Sliders / Inputs */}
          <div className="space-y-3 bg-slate-950/20 p-3.5 rounded-xl border border-slate-850/40">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Simulate Bid Amount ({currency})</span>
                <span className="font-extrabold text-primary-400 font-mono">{formatPrice(simulatedBid, currency)}</span>
              </div>
              <input
                type="range"
                min={auction.starting_price * 0.8}
                max={auction.starting_price * 1.8}
                step={auction.bid_increment || 500}
                value={simulatedBid}
                onChange={(e) => setSimulatedBid(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Quantity ({displayUnit})</span>
                <span className="font-extrabold text-primary-400">{quantity}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={Math.max(quantity * 2, 100)}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-14 bg-slate-900 border border-slate-800 text-white rounded text-center text-xs font-bold py-0.5 font-mono"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={showTaxes}
                onChange={(e) => setShowTaxes(e.target.checked)}
                className="rounded border-slate-800 text-primary-600 bg-slate-900 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="text-[10px] text-slate-400 font-medium">Include Buyer Premium & GST (approx. 20%)</span>
            </label>
          </div>
        </div>

        {/* Profitability Outputs */}
        <div className="bg-slate-950/60 p-4.5 rounded-xl border border-slate-850/80 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Total Cost</span>
              <span className="text-sm font-black text-slate-300 font-mono">{formatPrice(totalCost, currency)}</span>
            </div>
            
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Total Turnover</span>
              <span className="text-sm font-black text-white font-mono">{formatPrice(totalTurnover, currency)}</span>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Net Profitability</span>
              <span className={`text-lg font-black font-mono ${netProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netProfit > 0 ? '+' : ''}{formatPrice(netProfit, currency)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-medium block">Projected ROI</span>
              <span className={`text-sm font-black inline-flex items-center px-2 py-0.5 rounded font-mono ${netProfit > 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {profitabilityPercent > 0 ? '+' : ''}{profitabilityPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Profit status banner */}
          <div className={`p-2.5 rounded-lg flex items-center gap-2 text-xs font-semibold ${netProfit > 0 ? 'bg-green-500/5 border border-green-500/10 text-green-400' : 'bg-red-500/5 border border-red-500/10 text-red-400'}`}>
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              {netProfit > 100000 
                ? 'High ROI margin detected. Excellent bidding target!' 
                : netProfit > 0 
                  ? 'Profitable margins at this bid level.' 
                  : 'Acquisition costs exceed current market averages. High bid risk!'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
