export interface CostBreakdownInput {
  currentBid: number;
  gstPercent: number;
  tcsPercent: number;
  transportation?: number | '';
  loadingUnloading?: number | '';
  refurbishment?: number | '';
  otherFees?: number | '';
  extraCharge?: number | '';

  // Advanced cost fields
  auctionFee?: number | '';
  emdCost?: number | '';
  unloading?: number | '';
  warehouse?: number | '';
  storage?: number | '';
  insurance?: number | '';
  interest?: number | '';
  opportunityCost?: number | '';
  repair?: number | '';
  fuel?: number | '';
  customDuty?: number | '';
  labour?: number | '';
  shrinkage?: number | '';
  processingLoss?: number | '';
  miscellaneous?: number | '';
  contingency?: number | '';
  loading?: number | '';
}

export function computeCostBreakdown(input: CostBreakdownInput) {
  const currentBid = input.currentBid || 0;
  const gstPercent = input.gstPercent ?? 18;
  const tcsPercent = input.tcsPercent ?? 1;

  const gstAmount = Math.round(currentBid * (gstPercent / 100));
  const tcsAmount = Math.round((currentBid + gstAmount) * (tcsPercent / 100));

  const fixedCosts = 
    (input.transportation || 0) +
    (input.loadingUnloading || 0) +
    (input.refurbishment || 0) +
    (input.otherFees || 0) +
    (input.extraCharge || 0) +
    (input.auctionFee || 0) +
    (input.emdCost || 0) +
    (input.unloading || 0) +
    (input.warehouse || 0) +
    (input.storage || 0) +
    (input.insurance || 0) +
    (input.interest || 0) +
    (input.opportunityCost || 0) +
    (input.repair || 0) +
    (input.fuel || 0) +
    (input.customDuty || 0) +
    (input.labour || 0) +
    (input.shrinkage || 0) +
    (input.processingLoss || 0) +
    (input.miscellaneous || 0) +
    (input.contingency || 0) +
    (input.loading || 0);

  const taxFactor = (1 + gstPercent / 100) * (1 + tcsPercent / 100);
  const totalCost = Math.round(currentBid + gstAmount + tcsAmount + fixedCosts);

  return {
    gstAmount,
    tcsAmount,
    fixedCosts,
    taxFactor,
    totalCost
  };
}

export function computeOverallConfidence(avgItemConfidence: number, notAvailableRatio: number): number {
  const ocr = Math.round(95 - notAvailableRatio * 60);
  const image = 55; // default fallback without images
  const weight = 85;
  const material = 90;
  const market = avgItemConfidence;
  const seller = 88;
  const history = 80;

  // Weights matched to confidenceEngine.ts
  const factorsMap = [
    { score: ocr, weight: 0.25 }, // ocr
    { score: image, weight: 0.15 }, // image
    { score: weight, weight: 0.10 }, // weight
    { score: material, weight: 0.15 }, // material
    { score: market, weight: 0.20 }, // market
    { score: seller, weight: 0.10 }, // seller
    { score: history, weight: 0.05 } // history
  ];

  let weightedSum = 0;
  let weightTotal = 0;
  for (const f of factorsMap) {
    weightedSum += f.score * f.weight;
    weightTotal += f.weight;
  }
  return Math.round(weightedSum / weightTotal);
}

export function detectClosingBidMultiplier(itemNames: string[]): number {
  let multiplier = 1.05; // base fallback multiplier
  for (const name of itemNames) {
    const n = name.toLowerCase();
    if (n.includes('copper') || n.includes('brass')) {
      multiplier = 1.25;
    } else if (n.includes('vehicle') || n.includes('car') || n.includes('truck') || n.includes('bus')) {
      multiplier = 1.15;
    } else if (n.includes('steel') || n.includes('iron') || n.includes('ms')) {
      multiplier = 1.10;
    }
  }
  return multiplier;
}

export interface RoiMetricsInput {
  lotValue: number;
  totalCost: number;
  fixedCosts: number;
  taxFactor: number;
  overallConfidence: number;
  closingBidMultiplier: number;
  formatPrice: (n: number) => string;
}

export function computeRoiMetrics(input: RoiMetricsInput) {
  const { lotValue, totalCost, fixedCosts, taxFactor, overallConfidence } = input;
  
  const estimatedProfit = lotValue > 0 ? lotValue - totalCost : 0;
  const roiPercent = lotValue > 0 && totalCost > 0 ? Math.round((estimatedProfit / totalCost) * 100) : 0;
  const breakEven = Math.max(0, Math.round((lotValue - fixedCosts) / taxFactor));

  // Risk rating calculation
  let riskScore = 30;
  const riskReasonings: string[] = [];
  
  if (overallConfidence < 65) {
    riskScore += 25;
    riskReasonings.push('Low overall confidence increases valuation uncertainty.');
  }
  if (roiPercent < 10) {
    riskScore += 30;
    riskReasonings.push('Extremely thin margin / negative ROI.');
  } else if (roiPercent < 20) {
    riskScore += 10;
    riskReasonings.push('Moderate ROI is sensitive to cost fluctuations.');
  }
  
  const riskLevel = riskScore >= 70 ? 'High Risk' : riskScore >= 45 ? 'Medium Risk' : 'Low Risk';
  const riskReasoning = riskReasonings.length > 0 ? riskReasonings.join(' ') : 'Acceptable risk levels with healthy margins.';

  // Recommendation calculation
  const recommendationReasoning: string[] = [];
  let status: 'Strong Buy' | 'Buy' | 'Watch' | 'Avoid (Low Margin)' | 'Avoid (High Risk)' | 'Avoid (Low Confidence)' | 'Avoid (Overpriced)' = 'Watch';
  
  if (lotValue <= 0) {
    status = 'Avoid (Overpriced)';
    recommendationReasoning.push('The lot contains no priceable items or exceeds market valuation.');
  } else if (overallConfidence < 50) {
    status = 'Avoid (Low Confidence)';
    recommendationReasoning.push(`Data verifiability is extremely low (${overallConfidence}% overall confidence).`);
  } else if (riskLevel === 'High Risk') {
    status = 'Avoid (High Risk)';
    recommendationReasoning.push(`Risk parameters are elevated (${riskScore}/100 risk score).`);
  } else if (roiPercent < 10) {
    status = 'Avoid (Low Margin)';
    recommendationReasoning.push(`Projected ROI (${roiPercent}%) falls below the minimum margin threshold of 10%.`);
  } else if (riskLevel === 'Low Risk' && roiPercent >= 25) {
    status = 'Strong Buy';
    recommendationReasoning.push(`High projected ROI (${roiPercent}%) combined with low risk parameters.`);
  } else if (roiPercent >= 15) {
    status = 'Buy';
    recommendationReasoning.push(`Good returns potential (${roiPercent}% ROI) with acceptable risk.`);
  } else {
    status = 'Watch';
    recommendationReasoning.push(`Bidding margin is tight (${roiPercent}%). Refurbishment and logistical costs must be optimized.`);
  }

  return {
    estimatedProfit,
    roiPercent,
    breakEven,
    riskLevel,
    riskReasoning,
    recommendation: {
      status,
      reasoning: recommendationReasoning
    },
    recommendationReasoning: recommendationReasoning.join('. ')
  };
}

export function computeBidCaps(lotValue: number, fixedCosts: number, taxFactor: number) {
  const bidForRoi = (targetRoi: number): number => {
    const costLimit = lotValue / (1 + targetRoi / 100);
    return Math.max(0, Math.round((costLimit - fixedCosts) / taxFactor));
  };

  return {
    conservativeBid: bidForRoi(40),   // Conservative: 40% ROI target
    idealBid: bidForRoi(25),          // Recommended: 25% ROI target
    aggressiveBid: bidForRoi(15),     // Aggressive: 15% ROI target
    maxBid: bidForRoi(10),            // Maximum: 10% ROI target
    walkAwayPrice: bidForRoi(0),      // Break-even: 0% ROI
  };
}

export function computeSensitivityData(
  lotValue: number,
  fixedCosts: number,
  gstPercent: number,
  tcsPercent: number,
  currentBid: number,
  currencySymbol: string,
  currency: string,
  currencyRate: number
) {
  const taxFactor = (1 + gstPercent / 100) * (1 + tcsPercent / 100);
  
  const maxBreakEvenBid = Math.max(0, Math.round((lotValue - fixedCosts) / taxFactor));
  const startBid = Math.max(0, Math.min(currentBid * 0.5, maxBreakEvenBid * 0.2));
  const endBid = Math.max(maxBreakEvenBid * 1.3, currentBid * 1.5);
  const steps = 15;
  const stepSize = (endBid - startBid) / (steps - 1 || 1);
  
  const dataPoints = [];
  
  for (let i = 0; i < steps; i++) {
    const simulatedBid = Math.round(startBid + i * stepSize);
    const gstAmount = Math.round(simulatedBid * (gstPercent / 100));
    const tcsAmount = Math.round((simulatedBid + gstAmount) * (tcsPercent / 100));
    const simulatedTotalCost = simulatedBid + gstAmount + tcsAmount + fixedCosts;
    
    const simulatedProfit = lotValue - simulatedTotalCost;
    const simulatedRoi = simulatedTotalCost > 0 ? Math.round((simulatedProfit / simulatedTotalCost) * 100) : 0;
    
    dataPoints.push({
      bidPrice: simulatedBid,
      displayBidPrice: `${currencySymbol}${simulatedBid >= 100000 && currency === 'INR' ? (simulatedBid / 100000).toFixed(1) + 'L' : Math.round(simulatedBid).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`,
      profit: Math.round(simulatedProfit * currencyRate),
      roi: simulatedRoi,
    });
  }
  
  return dataPoints;
}

export function hasReliableValuation(overallConfidence: number, notAvailableRatio: number): boolean {
  return overallConfidence >= 50 && notAvailableRatio < 0.6;
}
