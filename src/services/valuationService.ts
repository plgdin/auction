import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { formatPrice } from '../utils/currency';
import { marketPriceService } from './marketPriceService';
import { 
  DEFAULT_MACRO_INPUTS,  
  predictPrice, 
  detectModelId, 
  detectGrade 
} from '../utils/metalValuationModels';

export interface ValuedItem {
  name: string;
  qty: number;
  unitValue: number;
  totalValue: number;
  confidence: number;
  notAvailable?: boolean;
  priceSource?: string;
  internationalPrices?: {
    in: { price: number; convertedPrice: number; sources: number };
    us: { price: number; convertedPrice: number; sources: number };
    uk: { price: number; convertedPrice: number; sources: number };
  };
}

export interface ValuationCosts {
  currentBid: number | '';
  transportation: number | '';
  loadingUnloading: number | '';
  refurbishment: number | '';
  otherFees: number | '';
  extraCharge?: number | '';
  gstPercent?: number;
  tcsPercent?: number;
}

export interface ValuationOutput {
  items: ValuedItem[];
  totalLotValue: number;
  totalCost: number;
  estimatedProfit: number;
  roiPercent: number;
  breakEven: number;
  riskAnalysis: {
    dataConfidence: number;
    pricingConfidence: number;
    overallConfidence: number;
    riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
    reasoning: string;
  };
  recommendation: 'Strong Buy' | 'Buy' | 'Watch Carefully' | 'High Risk';
  recommendationReasoning: string;
  internationalTotals?: {
    in: number;
    us: number;
    uk: number;
  };
}

// Simple base price helper for realistic fallback valuation
export interface CommodityDef {
  name: string;
  keywords: string[];
  basePricePerKg?: number;
  basePricePerUnit?: number;
  minPrice: number;
  maxPrice: number;
  queryKeyword: string;
  unit?: string;
}

export const COMMODITIES: CommodityDef[] = [
  {
    name: 'immovable_property',
    keywords: ['flat', 'plot', 'land', 'building', 'office space', 'shop', 'showroom', 'immovable', 'residential', 'commercial space', 'vacant', 'registration', 'survey'],
    basePricePerUnit: 5000000,
    minPrice: 1000000,
    maxPrice: 200000000,
    queryKeyword: 'property flat price India',
    unit: 'Unit'
  },
  {
    name: 'heavy_vehicle_machinery',
    keywords: ['bus', 'buses', 'truck', 'rig', 'compressor', 'machinery', 'lorry', 'coach', 'forklift', 'dumper', 'tractor', 'loader', 'excavator'],
    basePricePerUnit: 350000,
    minPrice: 80000,
    maxPrice: 1000000,
    queryKeyword: 'scrap bus truck heavy machinery price India',
    unit: 'Unit'
  },
  {
    name: 'vehicle',
    keywords: ['car', 'jeep', 'armada', 'vehicle', 'ambulance', 'sumo', 'indigo', 'bolero', 'gypsy', 'omni', 'tempo', 'tonner', 'qualis', 'etios', 'sunny', 'four-wheeler', 'four wheeler'],
    basePricePerUnit: 150000,
    minPrice: 30000,
    maxPrice: 400000,
    queryKeyword: 'scrap car vehicle price India',
    unit: 'Unit'
  },
  {
    name: 'motorcycle',
    keywords: ['motorcycle', 'scooter', 'wheeler', 'enfield', 'bullet', 'bike', 'splendor', 'ct 100', 'discover', 'solo', 'jupiter', 'activa', 'boxer', 'two-wheeler', 'two wheeler', 'hero', 'tvs', 'bajaj', 'motocorp'],
    basePricePerUnit: 45000,
    minPrice: 10000,
    maxPrice: 100000,
    queryKeyword: 'scrap motorcycle bike price India',
    unit: 'Unit'
  },
  {
    name: 'transformer',
    keywords: ['transformer'],
    basePricePerUnit: 90000,
    minPrice: 40000,
    maxPrice: 250000,
    queryKeyword: 'scrap transformer price India',
    unit: 'Unit'
  },
  {
    name: 'copper',
    keywords: ['copper', 'cu'],
    basePricePerKg: 780,
    minPrice: 500,
    maxPrice: 1000,
    queryKeyword: 'copper scrap price per kg India',
    unit: 'kg'
  },
  {
    name: 'brass',
    keywords: ['brass'],
    basePricePerKg: 480,
    minPrice: 300,
    maxPrice: 700,
    queryKeyword: 'brass scrap price per kg India',
    unit: 'kg'
  },
  {
    name: 'aluminium',
    keywords: ['aluminium', 'aluminum', 'al', 'alu', 'alu.', 'allu', 'allu.'],
    basePricePerKg: 235,
    minPrice: 150,
    maxPrice: 350,
    queryKeyword: 'aluminium scrap price per kg India',
    unit: 'kg'
  },
  {
    name: 'steel_iron_ferrous',
    keywords: ['steel', 'iron', 'ferrous', 'pipe', 'angle', 'channel', 'structure', 'railway', 'ms scrap'],
    basePricePerKg: 38.5,
    minPrice: 25,
    maxPrice: 60,
    queryKeyword: 'ms scrap price per kg India',
    unit: 'kg'
  },
  {
    name: 'battery',
    keywords: ['battery', 'batteries', 'vrla', 'lead acid'],
    basePricePerKg: 120,
    minPrice: 80,
    maxPrice: 180,
    queryKeyword: 'scrap lead acid battery price India',
    unit: 'kg'
  },
  {
    name: 'lubricant_oil',
    keywords: ['oil', 'lubricant', 'lubricating', 'waste oil', 'petroleum'],
    basePricePerUnit: 85,
    minPrice: 50,
    maxPrice: 150,
    queryKeyword: 'waste engine oil price per liter India',
    unit: 'Liter'
  },
  {
    name: 'e_waste',
    keywords: ['e-waste', 'telecom', 'computer', 'laptop', 'switch', 'motherboard', 'electronic', 'smps', 'panel', 'it equipment'],
    basePricePerUnit: 14500,
    minPrice: 5000,
    maxPrice: 30000,
    queryKeyword: 'e-waste scrap price per kg India',
    unit: 'Unit'
  },
  {
    name: 'cable_wire',
    keywords: ['cable', 'wire'],
    basePricePerKg: 340,
    minPrice: 200,
    maxPrice: 500,
    queryKeyword: 'copper cable scrap price India',
    unit: 'kg'
  },
  {
    name: 'lead',
    keywords: ['lead'],
    basePricePerKg: 185,
    minPrice: 120,
    maxPrice: 250,
    queryKeyword: 'lead scrap price India',
    unit: 'kg'
  },
  {
    name: 'zinc',
    keywords: ['zinc'],
    basePricePerKg: 220,
    minPrice: 150,
    maxPrice: 300,
    queryKeyword: 'zinc scrap price India',
    unit: 'kg'
  },
  {
    name: 'wheat',
    keywords: ['wheat'],
    basePricePerUnit: 2450,
    minPrice: 1500,
    maxPrice: 3500,
    queryKeyword: 'wheat price per quintal India',
    unit: 'Quintal'
  },
  {
    name: 'rice',
    keywords: ['rice', 'paddy'],
    basePricePerUnit: 2200,
    minPrice: 1500,
    maxPrice: 3500,
    queryKeyword: 'rice paddy price per quintal India',
    unit: 'Quintal'
  },
  {
    name: 'coal',
    keywords: ['coal', 'lignite'],
    basePricePerUnit: 8400,
    minPrice: 4000,
    maxPrice: 15000,
    queryKeyword: 'coal price per ton India',
    unit: 'Ton'
  },
  {
    name: 'sand',
    keywords: ['sand', 'mine', 'stone', 'block'],
    basePricePerUnit: 4500,
    minPrice: 2000,
    maxPrice: 8000,
    queryKeyword: 'river sand stone price per ton India',
    unit: 'Ton'
  },
  {
    name: 'paper_wood',
    keywords: ['paper', 'record', 'records', 'wood', 'wooden', 'cardboard', 'timber', 'plywood'],
    basePricePerUnit: 15000,
    minPrice: 5000,
    maxPrice: 30000,
    queryKeyword: 'waste paper wood scrap price India',
    unit: 'Ton'
  },
  {
    name: 'misc_scrap',
    keywords: ['sweep', 'sweeping', 'dust', 'ash', 'sludge', 'garbage', 'misc'],
    basePricePerUnit: 3500,
    minPrice: 1000,
    maxPrice: 10000,
    queryKeyword: 'mixed scrap dust price India',
    unit: 'Ton'
  },
  {
    name: 'teak_timber',
    keywords: ['teak', 'teakwood', 'teak logs'],
    basePricePerUnit: 45000,
    minPrice: 20000,
    maxPrice: 90000,
    queryKeyword: 'teak wood timber price India',
    unit: 'Ton'
  },
  {
    name: 'sal_timber',
    keywords: ['sal', 'salwood', 'sal logs'],
    basePricePerUnit: 35000,
    minPrice: 15000,
    maxPrice: 70000,
    queryKeyword: 'sal wood timber price India',
    unit: 'Ton'
  },
  {
    name: 'general_timber',
    keywords: ['timber', 'logs', 'wood logs', 'species', 'kfd', 'cfd'],
    basePricePerUnit: 20000,
    minPrice: 8000,
    maxPrice: 40000,
    queryKeyword: 'scrap timber logs price India',
    unit: 'Ton'
  }
];

function hasWord(text: string, kw: string): boolean {
  if (kw.includes(' ')) {
    return text.includes(kw);
  }
  const regex = new RegExp(`\\b${kw}(?:s|es)?\\b`, 'i');
  return regex.test(text);
}

export function matchCommodity(description: string): CommodityDef {
  const normalized = description.toLowerCase();
  
  // First, check dynamic commodities from marketPriceService
  const dynamicPrices = marketPriceService.getCommodityPrices();
  for (const c of dynamicPrices) {
    const keywords = c.keywords || [c.name.toLowerCase(), c.id.toLowerCase()];
    for (const kw of keywords) {
      if (hasWord(normalized, kw)) {
        const isPerKg = c.unit.toLowerCase() === 'kg' || c.unit.toLowerCase() === 'kgs';
        return {
          name: c.id,
          keywords: keywords,
          basePricePerKg: isPerKg ? c.currentPrice : undefined,
          basePricePerUnit: !isPerKg ? c.currentPrice : undefined,
          minPrice: c.currentPrice * 0.5,
          maxPrice: c.currentPrice * 2.0,
          queryKeyword: `${c.name} price India`,
          unit: c.unit
        };
      }
    }
  }

  // Fallback to static COMMODITIES list
  for (const comm of COMMODITIES) {
    for (const kw of comm.keywords) {
      if (hasWord(normalized, kw)) {
        return comm;
      }
    }
  }
  
  const defPrice = marketPriceService.getCommodityPrice('default') || 2500;
  return {
    name: 'default',
    keywords: [],
    basePricePerUnit: defPrice,
    minPrice: 500,
    maxPrice: 10000,
    queryKeyword: 'scrap metal price India'
  };
}

const extractPricesFromText = (text: string): number[] => {
  if (!text) return [];
  const foundPrices: number[] = [];
  
  // Pattern 1: Rupees (₹ or Rs or Rs. or INR)
  const ruPattern = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)/gi;
  let match;
  while ((match = ruPattern.exec(text)) !== null) {
    const rawVal = match[1].replace(/,/g, '');
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 1 && val < 50000000) {
      foundPrices.push(Math.round(val));
    }
  }

  // Pattern 2: USD or $
  const usPattern = /(?:\$|USD)\s*([\d,]+(?:\.\d+)?)/gi;
  while ((match = usPattern.exec(text)) !== null) {
    const rawVal = match[1].replace(/,/g, '');
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 1 && val < 1000000) {
      foundPrices.push(Math.round(val * 85));
    }
  }

  // Pattern 3: GBP or £
  const ukPattern = /(?:£|GBP)\s*([\d,]+(?:\.\d+)?)/gi;
  while ((match = ukPattern.exec(text)) !== null) {
    const rawVal = match[1].replace(/,/g, '');
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 1 && val < 1000000) {
      foundPrices.push(Math.round(val * 108));
    }
  }

  return foundPrices;
};

function getNormalizedText(text: string): string {
  let val = (text || '').toLowerCase();
  // Strip special chars/parenthesis
  val = val.replace(/[\(\)\/]/g, ' ');
  // Normalize e-waste before removing dashes/underscores to prevent matching generic 'waste'
  val = val.replace(/\be\s*[-_]?\s*waste\b/g, 'ewaste');
  val = val.replace(/[-_]/g, ' ');
  // Normalize synonyms
  val = val.replace(/\butensils?\b/g, 'bartan');
  val = val.replace(/\bpots?\b/g, 'bartan');
  val = val.replace(/\bcables?\b/g, 'wire');
  val = val.replace(/\bconductors?\b/g, 'wire');
  val = val.replace(/\bsteel\b/g, 'ms iron');
  val = val.replace(/\bms\b/g, 'ms iron');
  val = val.replace(/\bhms\b/g, 'ms scrap old');
  val = val.replace(/\bheavy melting\b/g, 'ms scrap old');
  val = val.replace(/\bcompressors?\b/g, 'compressor');
  val = val.replace(/\brefrigerators?\b/g, 'fridge');
  val = val.replace(/\bmotherboards?\b/g, 'pcb');
  val = val.replace(/\bdesktops?\b/g, 'desktop');
  val = val.replace(/\blaptops?\b/g, 'laptop');
  return val.replace(/\s+/g, ' ').trim();
}

function getLiveRateMatch(description: string, liveRates: any[], location?: string): any | null {
  if (!liveRates || liveRates.length === 0) return null;
  const descNormalized = getNormalizedText(description || '');
  const locNormalized = location ? getNormalizedText(location) : '';

  let bestMatch: any = null;
  let bestScore = 0;

  for (const rate of liveRates) {
    const metalTypeNormalized = getNormalizedText(rate.metal_type || '').replace(/_/g, ' ');
    const gradeNameNormalized = getNormalizedText(rate.grade_name || '');

    const metalWords = metalTypeNormalized.split(/\s+/).filter(w => w.length > 1);
    const gradeWords = gradeNameNormalized.replace(/[\(\)\/]/g, ' ').split(/\s+/).filter(w => w.length > 1);

    let score = 0;
    let matchesMetal = false;

    // Direct exact check
    if (descNormalized.includes(gradeNameNormalized)) {
      score += 40;
      if (descNormalized.includes(metalTypeNormalized)) {
        score += 25;
      }
    }

    // Token intersection check
    if (metalWords.length > 0) {
      const matchedMetalWords = metalWords.filter(w => descNormalized.includes(w));
      if (matchedMetalWords.length === metalWords.length) {
        matchesMetal = true;
        score += matchedMetalWords.length * 10;
      }
    } else {
      matchesMetal = true;
    }

    if (matchesMetal && gradeWords.length > 0) {
      const matchedGradeWords = gradeWords.filter(w => descNormalized.includes(w));
      score += matchedGradeWords.length * 15;

      if (matchedGradeWords.length === gradeWords.length) {
        score += 20;
      }
    }

    // Location boost
    if (locNormalized && gradeNameNormalized.includes(locNormalized)) {
      score += 50;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = rate;
    }
  }

  if (bestScore >= 25) {
    return bestMatch;
  }

  return null;
}

function getRegionalMultiplier(location?: string): { multiplier: number, discountReason?: string } {
  if (!location) return { multiplier: 1.0 };
  const loc = location.toLowerCase();
  
  // Remote / difficult logistics regions
  if (
    loc.includes('assam') || loc.includes('nagaland') || loc.includes('manipur') || 
    loc.includes('tripura') || loc.includes('mizoram') || loc.includes('arunachal') || 
    loc.includes('sikkim') || loc.includes('jammu') || loc.includes('kashmir') ||
    loc.includes('andaman') || loc.includes('nicobar') || loc.includes('lakshadweep') ||
    loc.includes('leh') || loc.includes('ladakh')
  ) {
    return { multiplier: 0.90, discountReason: '10% remote region logistics discount' };
  }
  
  // Secondary logistics regions
  if (
    loc.includes('bihar') || loc.includes('jharkhand') || loc.includes('chhattisgarh') ||
    loc.includes('odisha') || loc.includes('orissa') || loc.includes('uttarakhand')
  ) {
    return { multiplier: 0.95, discountReason: '5% secondary region logistics discount' };
  }
  
  return { multiplier: 1.0 };
}

function getCommodityMovingAverage(commodityId: string, days: number = 7): number {
  try {
    const logs = marketPriceService.getPriceHistoryLogs();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const relevantLogs = logs.filter(log => 
      log.commodityId === commodityId && 
      new Date(log.timestamp) >= cutoff
    );

    if (relevantLogs.length > 0) {
      const sum = relevantLogs.reduce((acc, log) => acc + log.price, 0);
      return Math.round(sum / relevantLogs.length);
    }
  } catch (e) {
    console.warn(`Failed to calculate moving average for ${commodityId}`, e);
  }
  return marketPriceService.getCommodityPrice(commodityId);
}

export const valuationService = {
  async getLiveScrapValue(metalType: string, grade: string, weightInKg: number): Promise<number> {
    const liveRates = await marketPriceService.fetchMetalMandiRates();
    const match = liveRates.find(
      r => r.metal_type === metalType.toLowerCase() && 
      r.grade_name.toLowerCase().includes(grade.toLowerCase())
    );
    
    if (match && match.price_per_kg > 0) {
      return match.price_per_kg * weightInKg;
    }
    
    console.warn(`Live rate missing for ${metalType} (${grade}), utilizing baseline valuation models.`);
    const comm = matchCommodity(metalType);
    const basePrice = marketPriceService.getCommodityPrice(comm.name) || comm.basePricePerKg || 38.5;
    return basePrice * weightInKg;
  },
  // Query international pricing from SerpAPI (if available) or generate mock prices
  async fetchInternationalPrices(itemName: string): Promise<{
    in: { price: number; convertedPrice: number; sources: number; isMock: boolean };
    us: { price: number; convertedPrice: number; sources: number; isMock: boolean };
    uk: { price: number; convertedPrice: number; sources: number; isMock: boolean };
  }> {
    // @ts-ignore
    const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SERPAPI_KEY : undefined) || (typeof process !== 'undefined' && (process as any).env ? (process as any).env.VITE_SERPAPI_KEY : undefined) || '';
    const comm = matchCommodity(itemName);
    const customPrice = marketPriceService.getCommodityPrice(comm.name);
    const isPerKg = comm.basePricePerKg !== undefined;
    const baseVal = customPrice || comm.basePricePerKg || comm.basePricePerUnit || 50;

    const regions = [
      { code: 'in', name: 'India', rate: 1, suffix: 'price India' },
      { code: 'us', name: 'USA', rate: 85, suffix: 'price USA' },
      { code: 'uk', name: 'UK', rate: 108, suffix: 'price UK' }
    ] as const;

    const results: any = {};

    if (!apiKey) {
      // Proportional mock data if API key not present
      const baseMock = baseVal;
      results['in'] = { price: baseMock, convertedPrice: baseMock, sources: 4, isMock: true };
      results['us'] = { price: Math.round((baseMock * 0.95) / 85), convertedPrice: Math.round(baseMock * 0.95), sources: 3, isMock: true };
      results['uk'] = { price: Math.round((baseMock * 0.9) / 108), convertedPrice: Math.round(baseMock * 0.9), sources: 2, isMock: true };
      return results;
    }

    await Promise.all(regions.map(async (reg) => {
      try {
        let query = comm.queryKeyword;
        if (reg.code === 'us') {
          query = query.replace('India', 'USA');
        } else if (reg.code === 'uk') {
          query = query.replace('India', 'UK');
        }
        
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&gl=${reg.code}&api_key=${apiKey}`;
        const res = await axios.get(url, { timeout: 4000 });
        const prices: number[] = [];

        if (res.data?.answer_box?.snippet) {
          prices.push(...extractPricesFromText(res.data.answer_box.snippet));
        }
        if (res.data?.answer_box?.answer) {
          prices.push(...extractPricesFromText(res.data.answer_box.answer));
        }

        const organic = res.data?.organic_results || [];
        for (const item of organic) {
          const text = `${item.title || ''} ${item.snippet || ''}`;
          prices.push(...extractPricesFromText(text));
        }

        const filtered = Array.from(new Set(prices)).map(p => {
          if (isPerKg && p >= comm.minPrice * 1000 && p <= comm.maxPrice * 1000) {
            return p / 1000;
          }
          return p;
        }).filter(p => p >= comm.minPrice && p <= comm.maxPrice);

        if (filtered.length >= 1) {
          const avgInr = filtered.reduce((sum, p) => sum + p, 0) / filtered.length;
          results[reg.code] = {
            price: Math.round(avgInr / reg.rate),
            convertedPrice: Math.round(avgInr),
            sources: filtered.length,
            isMock: false
          };
        } else {
          // Proportional fallback
          const factor = reg.code === 'us' ? 0.95 : reg.code === 'uk' ? 0.9 : 1.0;
          results[reg.code] = {
            price: Math.round((baseVal * factor) / reg.rate),
            convertedPrice: Math.round(baseVal * factor),
            sources: 0,
            isMock: true
          };
        }
      } catch {
        const factor = reg.code === 'us' ? 0.95 : reg.code === 'uk' ? 0.9 : 1.0;
        results[reg.code] = {
          price: Math.round((baseVal * factor) / reg.rate),
          convertedPrice: Math.round(baseVal * factor),
          sources: 0,
          isMock: true
        };
      }
    }));

    return results;
  },

  // Perform full lot analysis and calculation
  async calculateValuation(
    rawItems: { sr: number; description: string; qty: string; unit: string }[],
    costs: ValuationCosts,
    _hasImages: boolean = false,
    location?: string
  ): Promise<ValuationOutput> {
    // Ensure we have the latest global market indices from Supabase before matching
    await marketPriceService.fetchCommodityPrices();

    // Pre-fetch live MetalMandi rates for real-time spot lookup
    const liveRates = await marketPriceService.fetchMetalMandiRates();

    const valuedItems: ValuedItem[] = [];
    let totalLotValue = 0;
    let totalConfidenceSum = 0;
    
    let totalUsInr = 0;
    let totalUkInr = 0;
    for (const rawItem of rawItems) {
      // 1. Parse quantity
      const qtyStr = rawItem.qty || '1';
      const parts = qtyStr.split('+');
      let totalQty = 0;
      let totalBaseQty = 0;

      const comm = matchCommodity(rawItem.description);
      const isPerKg = comm.basePricePerKg !== undefined;

      for (const part of parts) {
        const cleanPart = part.replace(/,/g, '').trim();
        const partQty = parseFloat(cleanPart);
        if (isNaN(partQty) || partQty <= 0) continue;

        totalQty += partQty;

        const unitMatch = cleanPart.match(/[\d\.]+\s*([a-zA-Z][a-zA-Z\.]*)/);
        const partUnit = (unitMatch ? unitMatch[1] : rawItem.unit || '').toLowerCase().trim();

        let partBaseQty = partQty;
        if (isPerKg) {
          if (partUnit.includes('mt') || partUnit.includes('ton') || partUnit.includes('tonne')) {
            partBaseQty = partQty * 1000;
          }
        }
        totalBaseQty += partBaseQty;
      }

      const qty = totalQty > 0 ? totalQty : 1;
      const baseQty = totalBaseQty > 0 ? totalBaseQty : 1;

      // Check if item should not be estimated (isNotAvailable)
      const descLower = (rawItem.description || '').toLowerCase();
      const cleanQty = qtyStr.replace(/,/g, '').trim();
      const parsedQty = parseFloat(cleanQty);
      const qtyLower = cleanQty.toLowerCase();
      const unitLower = (rawItem.unit || '').toLowerCase().trim();

      const isLotUnit = unitLower.includes('lot') || qtyLower.includes('lot') || unitLower === 'ls' || unitLower === 'lumpsum';
      const isUnparseableQty = isNaN(parsedQty) || parsedQty <= 0;
      
      const unpriceableWords = [
        'ship', 'boat', 'vessel', 'yacht', 'barge', 'ferry', 'tugboat', 'cruiser',
        'property', 'flat', 'plot', 'land', 'building', 'office space', 'shop', 'showroom', 'immovable'
      ];
      const isUnpriceable = unpriceableWords.some(word => descLower.includes(word));
      const isUnknownCommodity = comm.name === 'default';
      const isPricingDisabled = marketPriceService.isCommodityPricingDisabled(comm.name);

      const isDiscrete = unitLower.includes('no') || unitLower === 'ea' || unitLower.includes('unit') || unitLower.includes('set') || unitLower === 'pc' || unitLower === 'pcs';
      const isWeight = unitLower.includes('kg') || unitLower.includes('mt') || unitLower.includes('ton');
      
      const modelId = detectModelId(rawItem.description);
      const targetUnit = modelId ? (modelId === 'cars_vehicles' || modelId === 'e_waste_electronics' ? 'Units' : 'Tons') : (comm.unit === 'kg' || comm.unit === 'Ton' ? 'Tons' : 'Units');
      
      const isMismatch = (isDiscrete && targetUnit === 'Tons') || (isWeight && targetUnit === 'Units');

      // Purge failed, unratified, withdrawn lots, or listings with zero bids to filter outliers
      const isFailedOrWithdrawn = descLower.includes('withdrawn') || 
                                  descLower.includes('cancelled') || 
                                  descLower.includes('unratified') || 
                                  descLower.includes('no bids') || 
                                  descLower.includes('zero bids') || 
                                  descLower.includes('failed auction');

      // If we have a direct live rate match from MetalMandi, bypass heuristic mismatches
      const hasLiveRate = !!getLiveRateMatch(rawItem.description, liveRates);

      const isNotAvailable = isLotUnit || isUnparseableQty || isUnpriceable || isFailedOrWithdrawn || 
                             (!hasLiveRate && (isUnknownCommodity || isPricingDisabled || isMismatch));

      if (isNotAvailable) {
        valuedItems.push({
          name: rawItem.description,
          qty,
          unitValue: 0,
          totalValue: 0,
          confidence: 0,
          notAvailable: true,
          internationalPrices: {
            in: { price: 0, convertedPrice: 0, sources: 0 },
            us: { price: 0, convertedPrice: 0, sources: 0 },
            uk: { price: 0, convertedPrice: 0, sources: 0 }
          }
        });
        continue;
      }

      // 2. Determine price and confidence
      const dbPrice = marketPriceService.getCommodityPrice(comm.name);
      
      let avgPrice = 0;
      let pricingConfidence = 50;
      let priceSource = 'Baseline';

      // Rework exact metal prices like zinc, aluminium, lead, copper to pull from MCX (admin commodity index)
      const hasSpecificScrapWord = [
        'wire', 'cable', 'armature', 'bhatti', 'purja', 'jali', 'comp', 'compressor', 'fridge', 
        'refrigerator', 'washing', 'geyser', 'pcb', 'board', 'motherboard', 'chip', 'magnet', 
        'battery', 'batteries', 'utensil', 'bartan', 'sheet', 'cast iron', 'hms', 'slug', 'dross', 
        'slime', 'ash', 'sludge', 'dust', 'sweeping', 'fitting', 'anaconda', 'dhada', 'wheel', 
        'brake', 'shoe', 'shredded', 'boring', 'turning', 'melting', 'heavy melting', 'plate', 
        'structure', 'old', 'new', 'mix', 'mixed', 'alloy'
      ].some(word => descLower.includes(word));

      const isExactZinc = descLower.includes('zinc') && !hasSpecificScrapWord;
      const isExactAluminium = (descLower.includes('aluminium') || descLower.includes('aluminum')) && !hasSpecificScrapWord;
      const isExactLead = descLower.includes('lead') && !hasSpecificScrapWord;
      const isExactCopper = (descLower.includes('copper') || descLower.includes(' cathodes') || descLower.includes('pure copper')) && !hasSpecificScrapWord;

      if (isExactZinc && marketPriceService.getCommodityPrice('zinc') > 0) {
        const spot = marketPriceService.getCommodityPrice('zinc');
        const ma = getCommodityMovingAverage('zinc', 7);
        avgPrice = Math.round(spot * 0.7 + ma * 0.3); // Weighted blend
        pricingConfidence = 95;
        priceSource = `MCX Index (7D MA: ₹${ma})`;
      } else if (isExactAluminium && marketPriceService.getCommodityPrice('aluminium') > 0) {
        const spot = marketPriceService.getCommodityPrice('aluminium');
        const ma = getCommodityMovingAverage('aluminium', 7);
        avgPrice = Math.round(spot * 0.7 + ma * 0.3);
        pricingConfidence = 95;
        priceSource = `MCX Index (7D MA: ₹${ma})`;
      } else if (isExactLead && marketPriceService.getCommodityPrice('lead') > 0) {
        const spot = marketPriceService.getCommodityPrice('lead');
        const ma = getCommodityMovingAverage('lead', 7);
        avgPrice = Math.round(spot * 0.7 + ma * 0.3);
        pricingConfidence = 95;
        priceSource = `MCX Index (7D MA: ₹${ma})`;
      } else if (isExactCopper && marketPriceService.getCommodityPrice('copper') > 0) {
        const spot = marketPriceService.getCommodityPrice('copper');
        const ma = getCommodityMovingAverage('copper', 7);
        avgPrice = Math.round(spot * 0.7 + ma * 0.3);
        pricingConfidence = 95;
        priceSource = `MCX Index (7D MA: ₹${ma})`;
      } else {
        // Attempt real-time spot rate lookup first from MetalMandi using keywords and location boost
        const liveRateMatch = getLiveRateMatch(rawItem.description, liveRates, location);

        if (liveRateMatch && liveRateMatch.price_per_kg > 0) {
          avgPrice = liveRateMatch.price_per_kg;
          pricingConfidence = 98; // Highest confidence from real-time spot market feed
          priceSource = `MetalMandi (${liveRateMatch.metal_type} - ${liveRateMatch.grade_name})`;
        } else if (modelId) {
          const grade = detectGrade(rawItem.description, modelId);
          const predictedVal = predictPrice(modelId, grade, 'Mumbai', DEFAULT_MACRO_INPUTS, rawItem.description);
          
          let normalizedPredictedVal = predictedVal;
          const targetUnit = modelId === 'cars_vehicles' || modelId === 'e_waste_electronics' ? 'Units' : 'Tons';
          
          // Convert prediction to Per KG if the commodity operates in KG
          if (targetUnit === 'Tons' && isPerKg) {
            normalizedPredictedVal = predictedVal / 1000;
          }

          if (dbPrice > 0) {
            avgPrice = (normalizedPredictedVal + dbPrice) / 2;
            pricingConfidence = 90; // High consensus from ML prediction and admin entered price
            priceSource = `ML Model + Admin Index`;
          } else {
            avgPrice = normalizedPredictedVal;
            pricingConfidence = 80; // ML predicted
            priceSource = `ML Model (${modelId})`;
          }
        } else {
          if (dbPrice > 0) {
            avgPrice = dbPrice;
            pricingConfidence = 95; // Supreme confidence from admin price override
            priceSource = 'Admin Pricing Index';
          } else {
            const intl = await this.fetchInternationalPrices(rawItem.description);
            avgPrice = intl.in.convertedPrice || comm.basePricePerKg || comm.basePricePerUnit || 50;
            priceSource = intl.in.isMock ? 'Baseline' : 'International Index';
            if (!intl.in.isMock) {
              pricingConfidence = Math.min(85, 50 + intl.in.sources * 5);
            } else {
              pricingConfidence = 60;
            }
          }
        }
      }

      // Apply regional premium/discount location multiplier
      const reg = getRegionalMultiplier(location);
      if (reg.multiplier !== 1.0) {
        avgPrice = Math.round(avgPrice * reg.multiplier);
        priceSource += ` [${reg.discountReason}]`;
      }

      const customPriceStr = (rawItem as any).marketPrice;
      if (customPriceStr && !modelId && dbPrice <= 0) {
        const cleanPrice = customPriceStr.replace(/,/g, '');
        const priceMatch = cleanPrice.match(/₹\s*(\d+)/);
        if (priceMatch) {
          let parsedPrice = parseInt(priceMatch[1], 10);
          if (parsedPrice > 1) {
            if (isPerKg && cleanPrice.toLowerCase().includes('/ ton')) {
              parsedPrice = parsedPrice / 1000;
            }
            avgPrice = parsedPrice;
            pricingConfidence = 85;
            priceSource = 'Catalog Spot Estimate';
          }
        }
      }

      const itemTotalValue = Math.round(avgPrice * baseQty);
      const itemUnitValue = Math.round(avgPrice * (baseQty / qty));

      valuedItems.push({
        name: rawItem.description,
        qty,
        unitValue: itemUnitValue,
        totalValue: itemTotalValue,
        confidence: pricingConfidence,
        priceSource,
        internationalPrices: {
          in: { 
            price: itemUnitValue, 
            convertedPrice: itemTotalValue, 
            sources: modelId ? 2 : (dbPrice > 0 ? 3 : 1) 
          },
          us: { 
            price: Math.round((itemUnitValue * 0.95) / 85), 
            convertedPrice: Math.round(itemTotalValue * 0.95), 
            sources: 1
          },
          uk: { 
            price: Math.round((itemUnitValue * 0.9) / 108), 
            convertedPrice: Math.round(itemTotalValue * 0.9), 
            sources: 1
          }
        }
      });

      totalLotValue += itemTotalValue;
      totalUsInr += itemTotalValue * 0.95;
      totalUkInr += itemTotalValue * 0.90;
      totalConfidenceSum += pricingConfidence;
    }

    totalLotValue = Math.round(totalLotValue);
    const avgItemConfidence = Math.round(totalConfidenceSum / (valuedItems.filter(v => !v.notAvailable).length || 1));

    // Calculate Costs and Profit
    const totalCost = Math.round(
      (costs.currentBid || 0) +
      (costs.transportation || 0) +
      (costs.loadingUnloading || 0) +
      (costs.refurbishment || 0) +
      (costs.otherFees || 0) +
      (costs.extraCharge || 0)
    );

    if (totalLotValue <= 0) {
      return {
        items: valuedItems,
        totalLotValue: 0,
        totalCost,
        estimatedProfit: 0,
        roiPercent: 0,
        breakEven: totalCost,
        riskAnalysis: {
          dataConfidence: 0,
          pricingConfidence: 0,
          overallConfidence: 0,
          riskLevel: 'High Risk',
          reasoning: 'Pricing estimation is not available for the items in this lot. Unable to calculate profit/risk parameters.'
        },
        recommendation: 'Watch Carefully',
        recommendationReasoning: 'Pricing data not available for this lot. Manual offline valuation is recommended before bidding.',
        internationalTotals: {
          in: 0,
          us: 0,
          uk: 0
        }
      };
    }

    const estimatedProfit = totalLotValue - totalCost;
    const roiPercent = totalCost > 0 ? Math.round((estimatedProfit / totalCost) * 100) : 0;
    const breakEven = totalCost;

    // Confidence ratings
    const dataConfidence = 85; 
    const pricingConfidence = avgItemConfidence;
    const overallConfidence = Math.round((dataConfidence + pricingConfidence) / 2);

    // Determine Risk Level
    let riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk' = 'Medium Risk';
    let riskReasoning = '';
    
    if (overallConfidence < 55) {
      riskLevel = 'High Risk';
      riskReasoning = 'High risk due to limited matching pricing points.';
    } else if (roiPercent < 10) {
      riskLevel = 'High Risk';
      riskReasoning = 'High risk because the estimated return on investment is extremely low or negative.';
    } else if (overallConfidence >= 75 && roiPercent >= 30) {
      riskLevel = 'Low Risk';
      riskReasoning = 'Low risk due to robust catalog details, high verification confidence, and strong margins.';
    } else {
      riskLevel = 'Medium Risk';
      riskReasoning = 'Medium risk. Solid margins but watch out for transport logistics costs and potential quality variations.';
    }

    // Determine dynamic multiplier based on dominant commodity type
    let closingBidMultiplier = marketPriceService.getCommodityMultiplier('default');
    let metalCount = 0;
    let vehicleCount = 0;
    let ewasteCount = 0;
    valuedItems.forEach(item => {
      const desc = (item.name || '').toLowerCase();
      if (desc.includes('steel') || desc.includes('iron') || desc.includes('copper') || desc.includes('metal') || desc.includes('brass')) {
        metalCount++;
      } else if (desc.includes('vehicle') || desc.includes('car') || desc.includes('bus') || desc.includes('truck') || desc.includes('motorcycle')) {
        vehicleCount++;
      } else if (desc.includes('computer') || desc.includes('laptop') || desc.includes('battery') || desc.includes('e-waste') || desc.includes('electronic')) {
        ewasteCount++;
      }
    });
    
    const totalItemsCount = valuedItems.length || 1;
    if (metalCount / totalItemsCount > 0.5) {
      closingBidMultiplier = marketPriceService.getCommodityMultiplier('steel_iron_ferrous');
    } else if (vehicleCount / totalItemsCount > 0.5) {
      closingBidMultiplier = marketPriceService.getCommodityMultiplier('vehicle');
    } else if (ewasteCount / totalItemsCount > 0.5) {
      closingBidMultiplier = marketPriceService.getCommodityMultiplier('e_waste');
    }

    // Recommendation Engine
    let recommendation: ValuationOutput['recommendation'] = 'Watch Carefully';
    let recommendationReasoning = '';

    if (riskLevel === 'Low Risk' && roiPercent >= 40) {
      recommendation = 'Strong Buy';
      recommendationReasoning = `Excellent bidding opportunity with a high projected ROI of ${roiPercent}%. Data verification is strong.`;
    } else if (roiPercent >= 20 && riskLevel !== 'High Risk') {
      recommendation = 'Buy';
      recommendationReasoning = `Solid potential returns (${roiPercent}% ROI) with manageable risk levels. Recommended to place bids up to ${formatPrice(Math.round(totalLotValue * closingBidMultiplier), useAppStore.getState().currency)}.`;
    } else if (riskLevel === 'High Risk' || roiPercent < 0) {
      recommendation = 'High Risk';
      recommendationReasoning = `Not recommended. The projected ROI is negative or extremely low (${roiPercent}%), making it likely unprofitable.`;
    } else if (roiPercent < 15) {
      recommendation = 'High Risk';
      recommendationReasoning = `Bidding margin is tight. Proceed only if loading/refurbishment costs can be optimized.`;
    } else {
      recommendation = 'Watch Carefully';
      recommendationReasoning = `Decent margins but confidence is moderate. Monitor bidding action closely and do not exceed the break-even value of ${formatPrice(breakEven, useAppStore.getState().currency)}.`;
    }


    return {
      items: valuedItems,
      totalLotValue,
      totalCost,
      estimatedProfit,
      roiPercent,
      breakEven,
      riskAnalysis: {
        dataConfidence,
        pricingConfidence,
        overallConfidence,
        riskLevel,
        reasoning: riskReasoning
      },
      recommendation,
      recommendationReasoning,
      internationalTotals: {
        in: totalLotValue,
        us: Math.round(totalUsInr),
        uk: Math.round(totalUkInr)
      }
    };
  }
};
