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
    keywords: ['flat', 'plot', 'land', 'building', 'office space', 'shop', 'showroom', 'immovable', 'residential', 'commercial space'],
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
    keywords: ['aluminium', 'aluminum', 'al'],
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
    _hasImages: boolean = false
  ): Promise<ValuationOutput> {
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

      const isNotAvailable = isLotUnit || isUnparseableQty || isUnpriceable || isUnknownCommodity || isPricingDisabled;

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
      const modelId = detectModelId(rawItem.description);
      const dbPrice = marketPriceService.getCommodityPrice(comm.name);
      
      let avgPrice = 0;
      let pricingConfidence = 50;

      if (modelId) {
        const grade = detectGrade(rawItem.description, modelId);
        const predictedVal = predictPrice(modelId, grade, 'Mumbai', DEFAULT_MACRO_INPUTS, rawItem.description);
        if (dbPrice > 0) {
          avgPrice = (predictedVal + dbPrice) / 2;
          pricingConfidence = 90; // High consensus from ML prediction and admin entered price
        } else {
          avgPrice = predictedVal;
          pricingConfidence = 80; // ML predicted
        }
      } else {
        if (dbPrice > 0) {
          avgPrice = dbPrice;
          pricingConfidence = 95; // Supreme confidence from admin price override
        } else {
          const intl = await this.fetchInternationalPrices(rawItem.description);
          avgPrice = intl.in.convertedPrice || comm.basePricePerKg || comm.basePricePerUnit || 50;
          if (!intl.in.isMock) {
            pricingConfidence = Math.min(85, 50 + intl.in.sources * 5);
          } else {
            pricingConfidence = 60;
          }
        }
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
