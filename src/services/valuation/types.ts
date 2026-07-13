import type { ValuationConfidence } from './confidenceEngine';
import type { ValuationRisk } from './riskEngine';
import type { ValuationRecommendation } from './recommendationEngine';
import type { ValuationBidding } from './biddingEngine';
import type { ValuationSimulation } from './simulationEngine';

export interface ValuationItem {
  name: string;
  qty: number;
  unitValue: number;
  totalValue: number;
  confidence: number;
  notAvailable?: boolean;
  priceSource?: string;
  internationalPrices?: Record<string, {
    price: number;
    convertedPrice: number;
    sources: number;
  }>;
}

export interface ValuationCosts {
  currentBid: number | '';
  gstPercent?: number;
  tcsPercent?: number;
  gstAmount?: number;
  tcsAmount?: number;
  auctionFee?: number | '';
  emdCost?: number | '';
  transportation?: number | '';
  loading?: number | '';
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
  extraCharge?: number | ''; // fallback compatibility
  loadingUnloading?: number | ''; // fallback compatibility
  refurbishment?: number | ''; // fallback compatibility
  otherFees?: number | ''; // fallback compatibility
}

export interface ValuationOutput {
  items: ValuationItem[];
  totalLotValue: number;
  totalCost: number;
  estimatedProfit: number;
  roiPercent: number;
  breakEven: number;
  costs: ValuationCosts;
  risk: ValuationRisk;
  confidence: ValuationConfidence;
  recommendation: ValuationRecommendation;
  bidding: ValuationBidding;
  simulation: ValuationSimulation;
  metadata: {
    calculatedAt: string;
    version: string;
  };
  // Legacy compatibility fields
  riskAnalysis?: {
    dataConfidence: number;
    pricingConfidence: number;
    overallConfidence: number;
    riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
    reasoning: string;
  };
  recommendationReasoning?: string;
  internationalTotals?: {
    in: number;
    us: number;
    uk: number;
  };
}
