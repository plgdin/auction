import { valuationPipeline } from './valuationPipeline';
import type { ValuationConfidence } from './confidenceEngine';
import type { ValuationRisk } from './riskEngine';
import type { ValuationRecommendation } from './recommendationEngine';
import type { ValuationBidding } from './biddingEngine';
import type { ValuationSimulation } from './simulationEngine';
import type { ValuationItem, ValuationCosts, ValuationOutput } from './types';

export const roiEngine = {
  async calculateValuation(
    rawItems: { sr: number; description: string; qty: string; unit: string; marketPrice?: string }[],
    costs: ValuationCosts,
    hasImages: boolean = false,
    location?: string
  ): Promise<ValuationOutput> {
    return valuationPipeline.execute(rawItems, costs, hasImages, location);
  },

  calculateValuationSync(
    rawItems: { sr: number; description: string; qty: string; unit: string; marketPrice?: string }[],
    costs: ValuationCosts,
    hasImages: boolean = false,
    location?: string
  ): ValuationOutput {
    return valuationPipeline.executeSync(rawItems, costs, hasImages, location);
  }
};

export type { ValuationItem, ValuationCosts, ValuationOutput };
export type { ValuationConfidence, ValuationRisk, ValuationRecommendation, ValuationBidding, ValuationSimulation };
