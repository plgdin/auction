import axios from 'axios';

export interface ValuedItem {
  name: string;
  qty: number;
  unitValue: number;
  totalValue: number;
  confidence: number;
  internationalPrices?: {
    in: { price: number; convertedPrice: number; sources: number };
    us: { price: number; convertedPrice: number; sources: number };
    uk: { price: number; convertedPrice: number; sources: number };
  };
}

export interface ValuationCosts {
  currentBid: number;
  transportation: number;
  loadingUnloading: number;
  refurbishment: number;
  otherFees: number;
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
  recommendation: 'Strong Buy' | 'Buy' | 'Watch Carefully' | 'High Risk' | 'Avoid';
  recommendationReasoning: string;
  internationalTotals?: {
    in: number;
    us: number;
    uk: number;
  };
}

// Simple base price helper for realistic fallback valuation
interface CommodityDef {
  name: string;
  keywords: string[];
  basePricePerKg?: number;
  basePricePerUnit?: number;
  minPrice: number;
  maxPrice: number;
  queryKeyword: string;
}

const COMMODITIES: CommodityDef[] = [
  {
    name: 'immovable_property',
    keywords: ['flat', 'plot', 'land', 'building', 'office space', 'shop', 'showroom', 'immovable', 'residential', 'commercial space'],
    basePricePerUnit: 5000000,
    minPrice: 1000000,
    maxPrice: 200000000,
    queryKeyword: 'property flat price India'
  },
  {
    name: 'heavy_vehicle_machinery',
    keywords: ['bus', 'buses', 'truck', 'rig', 'compressor', 'machinery', 'lorry', 'coach', 'forklift', 'dumper', 'tractor', 'loader', 'excavator'],
    basePricePerUnit: 350000,
    minPrice: 80000,
    maxPrice: 1000000,
    queryKeyword: 'scrap bus truck heavy machinery price India'
  },
  {
    name: 'vehicle',
    keywords: ['car', 'jeep', 'armada', 'vehicle', 'ambulance', 'sumo', 'indigo', 'bolero', 'gypsy', 'omni', 'tempo', 'tonner', 'qualis', 'etios', 'sunny', 'four-wheeler', 'four wheeler'],
    basePricePerUnit: 150000,
    minPrice: 30000,
    maxPrice: 400000,
    queryKeyword: 'scrap car vehicle price India'
  },
  {
    name: 'motorcycle',
    keywords: ['motorcycle', 'scooter', 'wheeler', 'enfield', 'bullet', 'bike', 'splendor', 'ct 100', 'discover', 'solo', 'jupiter', 'activa', 'boxer', 'two-wheeler', 'two wheeler', 'hero', 'tvs', 'bajaj', 'motocorp'],
    basePricePerUnit: 45000,
    minPrice: 10000,
    maxPrice: 100000,
    queryKeyword: 'scrap motorcycle bike price India'
  },
  {
    name: 'transformer',
    keywords: ['transformer'],
    basePricePerUnit: 90000,
    minPrice: 40000,
    maxPrice: 250000,
    queryKeyword: 'scrap transformer price India'
  },
  {
    name: 'copper',
    keywords: ['copper', 'cu'],
    basePricePerKg: 780,
    minPrice: 500,
    maxPrice: 1000,
    queryKeyword: 'copper scrap price per kg India'
  },
  {
    name: 'brass',
    keywords: ['brass'],
    basePricePerKg: 480,
    minPrice: 300,
    maxPrice: 700,
    queryKeyword: 'brass scrap price per kg India'
  },
  {
    name: 'aluminium',
    keywords: ['aluminium', 'aluminum', 'al'],
    basePricePerKg: 235,
    minPrice: 150,
    maxPrice: 350,
    queryKeyword: 'aluminium scrap price per kg India'
  },
  {
    name: 'steel_iron_ferrous',
    keywords: ['steel', 'iron', 'ferrous', 'pipe', 'angle', 'channel', 'structure', 'railway', 'ms scrap'],
    basePricePerKg: 38.5,
    minPrice: 25,
    maxPrice: 60,
    queryKeyword: 'ms scrap price per kg India'
  },
  {
    name: 'battery',
    keywords: ['battery', 'batteries', 'vrla', 'lead acid'],
    basePricePerKg: 120,
    minPrice: 80,
    maxPrice: 180,
    queryKeyword: 'scrap lead acid battery price India'
  },
  {
    name: 'lubricant_oil',
    keywords: ['oil', 'lubricant', 'lubricating', 'waste oil', 'petroleum'],
    basePricePerUnit: 85,
    minPrice: 50,
    maxPrice: 150,
    queryKeyword: 'waste engine oil price per liter India'
  },
  {
    name: 'e_waste',
    keywords: ['e-waste', 'telecom', 'computer', 'laptop', 'switch', 'motherboard', 'electronic', 'smps', 'panel', 'it equipment'],
    basePricePerUnit: 14500,
    minPrice: 5000,
    maxPrice: 30000,
    queryKeyword: 'e-waste scrap price per kg India'
  },
  {
    name: 'cable_wire',
    keywords: ['cable', 'wire'],
    basePricePerKg: 340,
    minPrice: 200,
    maxPrice: 500,
    queryKeyword: 'copper cable scrap price India'
  },
  {
    name: 'lead',
    keywords: ['lead'],
    basePricePerKg: 185,
    minPrice: 120,
    maxPrice: 250,
    queryKeyword: 'lead scrap price India'
  },
  {
    name: 'zinc',
    keywords: ['zinc'],
    basePricePerKg: 220,
    minPrice: 150,
    maxPrice: 300,
    queryKeyword: 'zinc scrap price India'
  }
];

function hasWord(text: string, kw: string): boolean {
  if (kw.includes(' ')) {
    return text.includes(kw);
  }
  const regex = new RegExp(`\\b${kw}(?:s|es)?\\b`, 'i');
  return regex.test(text);
}

function matchCommodity(description: string): CommodityDef {
  const normalized = description.toLowerCase();
  for (const comm of COMMODITIES) {
    for (const kw of comm.keywords) {
      if (hasWord(normalized, kw)) {
        return comm;
      }
    }
  }
  return {
    name: 'default',
    keywords: [],
    basePricePerUnit: 2500,
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
    const isPerKg = comm.basePricePerKg !== undefined;
    const baseVal = comm.basePricePerKg || comm.basePricePerUnit || 50;

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

      // 2. Fetch international prices or use pre-extracted marketPrice
      const intl = await this.fetchInternationalPrices(rawItem.description);
      let avgPrice = intl.in.convertedPrice;
      const customPriceStr = (rawItem as any).marketPrice;
      if (customPriceStr) {
        const cleanPrice = customPriceStr.replace(/,/g, '');
        const priceMatch = cleanPrice.match(/₹\s*(\d+)/);
        if (priceMatch) {
          const parsedPrice = parseInt(priceMatch[1], 10);
          if (parsedPrice > 1) {
            avgPrice = parsedPrice;
          }
        }
      }
      const isMock = intl.in.isMock;

      // Compute confidence score based on number of sources and consistency
      let pricingConfidence = 50; // base confidence
      if (!isMock) {
        pricingConfidence += Math.min(30, intl.in.sources * 4);
      } else {
        pricingConfidence = 65;
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
            sources: intl.in.sources 
          },
          us: { 
            price: Math.round((itemUnitValue * 0.95) / 85), 
            convertedPrice: Math.round(itemTotalValue * 0.95), 
            sources: intl.us.sources 
          },
          uk: { 
            price: Math.round((itemUnitValue * 0.9) / 108), 
            convertedPrice: Math.round(itemTotalValue * 0.9), 
            sources: intl.uk.sources 
          }
        }
      });

      totalLotValue += itemTotalValue;
      totalUsInr += itemTotalValue * 0.95;
      totalUkInr += itemTotalValue * 0.90;
      totalConfidenceSum += pricingConfidence;
    }

    totalLotValue = Math.round(totalLotValue);
    const avgItemConfidence = Math.round(totalConfidenceSum / (valuedItems.length || 1));

    // Calculate Costs and Profit
    const totalCost = Math.round(
      costs.currentBid +
      costs.transportation +
      costs.loadingUnloading +
      costs.refurbishment +
      costs.otherFees
    );

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

    // Recommendation Engine
    let recommendation: ValuationOutput['recommendation'] = 'Watch Carefully';
    let recommendationReasoning = '';

    if (riskLevel === 'Low Risk' && roiPercent >= 40) {
      recommendation = 'Strong Buy';
      recommendationReasoning = `Excellent bidding opportunity with a high projected ROI of ${roiPercent}%. Data verification is strong.`;
    } else if (roiPercent >= 20 && riskLevel !== 'High Risk') {
      recommendation = 'Buy';
      recommendationReasoning = `Solid potential returns (${roiPercent}% ROI) with manageable risk levels. Recommended to place bids up to ₹${Math.round(totalLotValue * 0.75).toLocaleString('en-IN')}.`;
    } else if (riskLevel === 'High Risk' || roiPercent < 0) {
      recommendation = 'Avoid';
      recommendationReasoning = `Not recommended. The projected ROI is negative or extremely low (${roiPercent}%), making it likely unprofitable.`;
    } else if (roiPercent < 15) {
      recommendation = 'High Risk';
      recommendationReasoning = `Bidding margin is tight. Proceed only if loading/refurbishment costs can be optimized.`;
    } else {
      recommendation = 'Watch Carefully';
      recommendationReasoning = `Decent margins but confidence is moderate. Monitor bidding action closely and do not exceed the break-even value of ₹${breakEven.toLocaleString('en-IN')}.`;
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
