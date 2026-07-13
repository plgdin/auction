import axios from 'axios';
import { marketPriceService } from './marketPriceService';
import { roiEngine } from './valuation/roiEngine';


import type { ValuationCosts, ValuationOutput } from './valuation/roiEngine';

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
    hasImages: boolean = false,
    location?: string
  ): Promise<ValuationOutput> {
    return roiEngine.calculateValuation(rawItems, costs as any, hasImages, location) as any;
  }
};
