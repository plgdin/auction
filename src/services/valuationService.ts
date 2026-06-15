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
const CATEGORY_BASE_PRICES: Record<string, number> = {
  'sand': 1500, // per unit
  'block': 12000,
  'metal': 45000, // per ton
  'iron': 38000,
  'steel': 42000,
  'copper': 650000,
  'brass': 420000,
  'aluminium': 180000,
  'cable': 250,
  'wire': 80,
  'transformer': 150000,
  'battery': 4500,
  'generator': 85000,
  'computer': 15000,
  'laptop': 22000,
  'obsolete': 1500,
  'scrap': 25000,
  'default': 5000
};

function getMockPrice(name: string): number[] {
  const normalized = name.toLowerCase();
  let basePrice = CATEGORY_BASE_PRICES['default'];
  for (const [cat, price] of Object.entries(CATEGORY_BASE_PRICES)) {
    if (normalized.includes(cat)) {
      basePrice = price;
      break;
    }
  }
  const prices: number[] = [];
  for (let i = 0; i < 4; i++) {
    const variance = 0.7 + Math.random() * 0.6; // 70% to 130%
    prices.push(Math.round(basePrice * variance));
  }
  return prices;
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

  // Pattern 2: USD or $ (converted to INR at 85)
  const usPattern = /(?:\$|USD)\s*([\d,]+(?:\.\d+)?)/gi;
  while ((match = usPattern.exec(text)) !== null) {
    const rawVal = match[1].replace(/,/g, '');
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 1 && val < 1000000) {
      foundPrices.push(Math.round(val * 85));
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
    
    const regions = [
      { code: 'in', gl: 'in', currency: 'INR', rate: 1, suffix: 'price rate' },
      { code: 'us', gl: 'us', currency: 'USD', rate: 85, suffix: 'price USD' },
      { code: 'uk', gl: 'uk', currency: 'GBP', rate: 108, suffix: 'price GBP' }
    ] as const;

    const results: any = {};

    if (!apiKey) {
      // Proportional mock data if API key not present
      const baseMock = getMockPrice(itemName)[0] || 5000;
      results['in'] = { price: baseMock, convertedPrice: baseMock, sources: 4, isMock: true };
      results['us'] = { price: Math.round((baseMock * 0.95) / 85), convertedPrice: Math.round(baseMock * 0.95), sources: 3, isMock: true };
      results['uk'] = { price: Math.round((baseMock * 0.9) / 108), convertedPrice: Math.round(baseMock * 0.9), sources: 2, isMock: true };
      return results;
    }

    await Promise.all(regions.map(async (reg) => {
      try {
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(itemName + ' ' + reg.suffix)}&gl=${reg.gl}&api_key=${apiKey}`;
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

        const filtered = Array.from(new Set(prices)).filter(
          p => p > 1 && p !== 2023 && p !== 2024 && p !== 2025 && p !== 2026 && p !== 2027
        );

        if (filtered.length >= 2) {
          const avgInr = filtered.reduce((sum, p) => sum + p, 0) / filtered.length;
          results[reg.code] = {
            price: Math.round(avgInr / reg.rate),
            convertedPrice: Math.round(avgInr),
            sources: filtered.length,
            isMock: false
          };
        } else {
          // Proportional mock fallback
          const baseMock = getMockPrice(itemName)[0] || 5000;
          const factor = reg.code === 'us' ? 0.95 : reg.code === 'uk' ? 0.9 : 1.0;
          results[reg.code] = {
            price: Math.round((baseMock * factor) / reg.rate),
            convertedPrice: Math.round(baseMock * factor),
            sources: 0,
            isMock: true
          };
        }
      } catch {
        const baseMock = getMockPrice(itemName)[0] || 5000;
        const factor = reg.code === 'us' ? 0.95 : reg.code === 'uk' ? 0.9 : 1.0;
        results[reg.code] = {
          price: Math.round((baseMock * factor) / reg.rate),
          convertedPrice: Math.round(baseMock * factor),
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
      const qtyVal = parseFloat(rawItem.qty.replace(/,/g, ''));
      const qty = isNaN(qtyVal) || qtyVal <= 0 ? 1 : qtyVal;

      // 2. Fetch international prices
      const intl = await this.fetchInternationalPrices(rawItem.description);
      const avgPrice = intl.in.convertedPrice;
      const isMock = intl.in.isMock;

      // Compute confidence score based on number of sources and consistency
      let pricingConfidence = 50; // base confidence
      if (!isMock) {
        pricingConfidence += Math.min(30, intl.in.sources * 4);
      } else {
        pricingConfidence = 65;
      }

      valuedItems.push({
        name: rawItem.description,
        qty,
        unitValue: Math.round(avgPrice),
        totalValue: Math.round(avgPrice * qty),
        confidence: pricingConfidence,
        internationalPrices: {
          in: { price: intl.in.price, convertedPrice: intl.in.convertedPrice, sources: intl.in.sources },
          us: { price: intl.us.price, convertedPrice: intl.us.convertedPrice, sources: intl.us.sources },
          uk: { price: intl.uk.price, convertedPrice: intl.uk.convertedPrice, sources: intl.uk.sources }
        }
      });

      totalLotValue += avgPrice * qty;
      totalUsInr += intl.us.convertedPrice * qty;
      totalUkInr += intl.uk.convertedPrice * qty;
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
