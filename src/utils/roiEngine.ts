/**
 * Legacy ROI Engine — Thin delegation layer.
 * All computation delegates to the canonical engines in services/valuation/.
 * Function signatures are preserved for backward compatibility with MstcDetailsModal.
 */
import { costEngine } from '../services/valuation/costEngine';
import { confidenceEngine } from '../services/valuation/confidenceEngine';
import { riskEngine } from '../services/valuation/riskEngine';
import { recommendationEngine } from '../services/valuation/recommendationEngine';
import { biddingEngine } from '../services/valuation/biddingEngine';
import type { ValuationCosts } from '../services/valuation/types';
import { safeNumber, safeRound, safeDivide } from '../services/valuation/inputValidator';

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

/**
 * Delegates to costEngine.calculateCosts() — single source of truth for tax/cost math.
 */
export function computeCostBreakdown(input: CostBreakdownInput) {
  // Map CostBreakdownInput to ValuationCosts for the canonical engine
  const costs: ValuationCosts = {
    currentBid: input.currentBid,
    gstPercent: input.gstPercent,
    tcsPercent: input.tcsPercent,
    transportation: input.transportation,
    loading: input.loading,
    unloading: input.unloading,
    warehouse: input.warehouse,
    storage: input.storage,
    insurance: input.insurance,
    interest: input.interest,
    opportunityCost: input.opportunityCost,
    repair: input.repair,
    fuel: input.fuel,
    customDuty: input.customDuty,
    labour: input.labour,
    shrinkage: input.shrinkage,
    processingLoss: input.processingLoss,
    miscellaneous: input.miscellaneous,
    contingency: input.contingency,
    auctionFee: input.auctionFee,
    emdCost: input.emdCost,
    loadingUnloading: input.loadingUnloading,
    refurbishment: input.refurbishment,
    otherFees: input.otherFees,
    extraCharge: input.extraCharge,
  };

  const result = costEngine.calculateCosts(costs);

  const gstPercent = safeNumber(input.gstPercent, 18);
  const tcsPercent = safeNumber(input.tcsPercent, 1);
  const taxFactor = (1 + gstPercent / 100) * (1 + tcsPercent / 100);

  return {
    gstAmount: result.gstAmount,
    tcsAmount: result.tcsAmount,
    fixedCosts: result.otherExpenses,
    taxFactor,
    totalCost: result.totalCost
  };
}

/**
 * Delegates to confidenceEngine.calculateConfidence().
 */
export function computeOverallConfidence(avgItemConfidence: number, notAvailableRatio: number): number {
  const ocr = safeRound(95 - notAvailableRatio * 60);
  const result = confidenceEngine.calculateConfidence({
    ocr,
    image: 55,
    weight: 85,
    material: 90,
    market: avgItemConfidence,
    seller: 88,
    history: 80,
    description: 85
  });
  return result.overallScore;
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

/**
 * Delegates to riskEngine + recommendationEngine for consistent results.
 */
export function computeRoiMetrics(input: RoiMetricsInput) {
  const { lotValue, totalCost, fixedCosts, taxFactor, overallConfidence } = input;
  
  const estimatedProfit = lotValue > 0 ? lotValue - totalCost : 0;
  const roiPercent = lotValue > 0 && totalCost > 0 ? safeRound(safeDivide(estimatedProfit, totalCost, 0) * 100) : 0;
  const breakEven = Math.max(0, safeRound(safeDivide(lotValue - fixedCosts, taxFactor, 0)));

  // Delegate risk calculation to canonical engine
  const riskResult = riskEngine.calculateRisk({
    priceVolatility: overallConfidence < 65 ? 60 : 35,
    marketTrend: 'flat',
    sellerReliability: 88,
    ocrConfidence: 95,
    photoQuality: 50,
    historicalError: roiPercent < 10 ? 40 : 15,
    inspectionAvailable: true,
    categoryRisk: 30,
    transportRisk: 20,
    environmentalRisk: 15
  });

  // Delegate recommendation to canonical engine
  const recResult = recommendationEngine.generateRecommendation({
    roiPercent,
    riskLevel: riskResult.level,
    riskScore: riskResult.score,
    overallConfidence,
    marketTrend: 'flat',
    currentBid: totalCost,
    totalLotValue: lotValue
  });

  return {
    estimatedProfit,
    roiPercent,
    breakEven,
    riskLevel: riskResult.level,
    riskReasoning: riskResult.reasoning.join(' '),
    recommendation: {
      status: recResult.status,
      reasoning: recResult.reasoning
    },
    recommendationReasoning: recResult.reasoning.join('. ')
  };
}

/**
 * Delegates to biddingEngine.generateBidRecommendations().
 */
export function computeBidCaps(lotValue: number, fixedCosts: number, _taxFactor: number) {
  // Reverse-engineer a minimal ValuationCosts from the legacy inputs
  // taxFactor = (1 + gstRate) * (1 + tcsRate)
  // We assume standard 18% GST + 1% TCS
  const costs: ValuationCosts = {
    currentBid: 0, // Not used in bid cap calculation
    gstPercent: 18,
    tcsPercent: 1,
    // We need to pass fixedCosts as some expense field so costEngine.otherExpenses matches
    transportation: fixedCosts
  };

  const result = biddingEngine.generateBidRecommendations(lotValue, costs);

  return {
    conservativeBid: result.conservativeBid,
    idealBid: result.idealBid,
    aggressiveBid: result.aggressiveBid,
    maxBid: result.maxBid,
    walkAwayPrice: result.walkAwayPrice,
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
  
  const maxBreakEvenBid = Math.max(0, safeRound(safeDivide(lotValue - fixedCosts, taxFactor, 0)));
  const startBid = Math.max(0, Math.min(currentBid * 0.5, maxBreakEvenBid * 0.2));
  const endBid = Math.max(maxBreakEvenBid * 1.3, currentBid * 1.5);
  const steps = 15;
  const stepSize = safeDivide(endBid - startBid, steps - 1, 1);
  
  const dataPoints = [];
  
  for (let i = 0; i < steps; i++) {
    const simulatedBid = safeRound(startBid + i * stepSize);
    const gstAmount = safeRound(simulatedBid * (gstPercent / 100));
    const tcsAmount = safeRound((simulatedBid + gstAmount) * (tcsPercent / 100));
    const simulatedTotalCost = simulatedBid + gstAmount + tcsAmount + fixedCosts;
    
    // Add quadratic risk premium curve (representing diminishing margins at higher bid prices)
    const curveFactor = Math.pow(safeDivide(i, steps - 1, 0), 2) * (lotValue * 0.08);
    const simulatedProfit = lotValue - simulatedTotalCost - curveFactor;
    const simulatedRoi = simulatedTotalCost > 0 ? safeRound(safeDivide(simulatedProfit, simulatedTotalCost, 0) * 100) : 0;
    
    dataPoints.push({
      bidPrice: simulatedBid,
      displayBidPrice: `${currencySymbol}${simulatedBid >= 100000 && currency === 'INR' ? (simulatedBid / 100000).toFixed(1) + 'L' : Math.round(simulatedBid).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`,
      profit: safeRound(simulatedProfit * currencyRate),
      roi: simulatedRoi,
    });
  }
  
  return dataPoints;
}

export function hasReliableValuation(overallConfidence: number, notAvailableRatio: number): boolean {
  return overallConfidence >= 50 && notAvailableRatio < 0.6;
}

