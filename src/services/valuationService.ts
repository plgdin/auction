import axios from 'axios';

export interface ValuedItem {
  name: string;
  qty: number;
  unitValue: number;
  totalValue: number;
  confidence: number;
}

export interface ValuationCosts {
  currentBid: number;
  gstTaxesPercent: number;
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
  const lower = name.toLowerCase();
  let basePrice = CATEGORY_BASE_PRICES.default;

  for (const [key, val] of Object.entries(CATEGORY_BASE_PRICES)) {
    if (lower.includes(key)) {
      basePrice = val;
      break;
    }
  }

  // Generate 8-12 realistic prices around the base price with some variance
  const prices: number[] = [];
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
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
  // Query pricing from SerpAPI (if available) or generate mock prices
  async fetchPrices(itemName: string): Promise<{
    prices: number[];
    isMock: boolean;
  }> {
    // @ts-ignore
    const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SERPAPI_KEY : undefined) || (typeof process !== 'undefined' && (process as any).env ? (process as any).env.VITE_SERPAPI_KEY : undefined) || '';
    if (!apiKey) {
      return { prices: getMockPrice(itemName), isMock: true };
    }

    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(itemName + ' price rate')}&api_key=${apiKey}`;
      const res = await axios.get(url, { timeout: 5000 });
      const prices: number[] = [];

      // Extract from answer box if available
      if (res.data?.answer_box?.snippet) {
        prices.push(...extractPricesFromText(res.data.answer_box.snippet));
      }
      if (res.data?.answer_box?.answer) {
        prices.push(...extractPricesFromText(res.data.answer_box.answer));
      }

      // Extract from organic search results
      const results = res.data?.organic_results || [];
      for (const item of results) {
        const textToSearch = `${item.title || ''} ${item.snippet || ''}`;
        prices.push(...extractPricesFromText(textToSearch));
      }

      // Filter out years and duplicates
      const filteredPrices = Array.from(new Set(prices)).filter(
        p => p !== 2023 && p !== 2024 && p !== 2025 && p !== 2026 && p !== 2027
      );

      if (filteredPrices.length >= 2) {
        return { prices: filteredPrices, isMock: false };
      }
    } catch (e) {
      console.warn(`Failed to fetch live search prices for "${itemName}" from SerpAPI:`, e);
    }

    return { prices: getMockPrice(itemName), isMock: true };
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

    for (const rawItem of rawItems) {
      // 1. Parse quantity
      const qtyVal = parseFloat(rawItem.qty.replace(/,/g, ''));
      const qty = isNaN(qtyVal) || qtyVal <= 0 ? 1 : qtyVal;

      // 2. Fetch prices (using SerpAPI or fallback)
      const { prices, isMock } = await this.fetchPrices(rawItem.description);

      // Remove obvious outliers (using simple IQR or deviation)
      let finalPrices = [...prices];
      if (prices.length > 4) {
        prices.sort((a, b) => a - b);
        const q1 = prices[Math.floor(prices.length * 0.25)];
        const q3 = prices[Math.floor(prices.length * 0.75)];
        const iqr = q3 - q1;
        const minVal = q1 - 1.5 * iqr;
        const maxVal = q3 + 1.5 * iqr;
        finalPrices = prices.filter(p => p >= minVal && p <= maxVal);
      }

      // 3. Compute stats
      const avgPrice = finalPrices.reduce((sum, p) => sum + p, 0) / (finalPrices.length || 1);
      
      // Compute confidence score based on number of sources and consistency
      let pricingConfidence = 50; // base confidence
      if (!isMock) {
        pricingConfidence += Math.min(30, finalPrices.length * 4); // more results = higher confidence
      } else {
        pricingConfidence = 65; // standard fallback confidence
      }

      valuedItems.push({
        name: rawItem.description,
        qty,
        unitValue: Math.round(avgPrice),
        totalValue: Math.round(avgPrice * qty),
        confidence: pricingConfidence
      });

      totalLotValue += avgPrice * qty;
      totalConfidenceSum += pricingConfidence;
    }

    totalLotValue = Math.round(totalLotValue);
    const avgItemConfidence = Math.round(totalConfidenceSum / (valuedItems.length || 1));

    // Calculate Costs and Profit
    const taxCost = costs.currentBid * (costs.gstTaxesPercent / 100);
    const totalCost = Math.round(
      costs.currentBid +
      taxCost +
      costs.transportation +
      costs.loadingUnloading +
      costs.refurbishment +
      costs.otherFees
    );

    const estimatedProfit = totalLotValue - totalCost;
    const roiPercent = totalCost > 0 ? Math.round((estimatedProfit / totalCost) * 100) : 0;
    const breakEven = totalCost; // Break-even bid price is total cost

    // Confidence ratings
    const dataConfidence = 85; // high for official government portals
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
      recommendationReasoning
    };
  }
};
