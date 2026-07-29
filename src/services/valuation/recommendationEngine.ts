import { ROI_RECOMMENDATION_THRESHOLDS, CONFIDENCE_GATES } from './roiConfig';

export interface RecommendationInputs {
  roiPercent: number;
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  riskScore: number;
  overallConfidence: number;
  marketTrend: 'up' | 'down' | 'flat';
  currentBid: number;
  totalLotValue: number;
  sourceCount?: number;
}

export interface ValuationRecommendation {
  status:
    | 'Strong Buy'
    | 'Buy'
    | 'Watch'
    | 'Avoid (Low Margin)'
    | 'Avoid (High Risk)'
    | 'Avoid (Low Confidence)'
    | 'Avoid (Market Downtrend)'
    | 'Avoid (Overpriced)'
    | 'Insufficient Data';
  reasoning: string[];
}

export const recommendationEngine = {
  /**
   * Generates highly explainable, detailed recommendation codes and justifications
   */
  generateRecommendation(inputs: RecommendationInputs): ValuationRecommendation {
    const { roiPercent, riskLevel, riskScore, overallConfidence, marketTrend, currentBid, totalLotValue, sourceCount = 1 } = inputs;
    const reasoning: string[] = [];

    // Rule 0: Insufficient Data (Cannot compute lot value)
    if (totalLotValue <= 0) {
      reasoning.push('Lot item specifications could not be priced or converted to measurable units. Do not place bids without manual verification.');
      return { status: 'Insufficient Data', reasoning };
    }

    // Rule 1: Overpriced
    if (currentBid >= totalLotValue) {
      reasoning.push('The current bid meets or exceeds the estimated market scrap value of the lot.');
      return { status: 'Avoid (Overpriced)', reasoning };
    }

    // Rule 2: Market Downtrend
    if (marketTrend === 'down') {
      reasoning.push('Associated commodity indices are currently in a persistent downtrend, representing downside risk.');
      return { status: 'Avoid (Market Downtrend)', reasoning };
    }

    // Rule 3: Low Confidence
    if (overallConfidence < ROI_RECOMMENDATION_THRESHOLDS.avoidLowConfidenceThreshold) {
      reasoning.push(`Data verifiability is extremely low (${overallConfidence}% overall confidence).`);
      return { status: 'Avoid (Low Confidence)', reasoning };
    }

    // Rule 4: High Risk
    if (riskScore >= ROI_RECOMMENDATION_THRESHOLDS.avoidHighRiskThreshold || riskLevel === 'High Risk') {
      reasoning.push(`Risk parameters are elevated (${riskScore}/100 risk score).`);
      return { status: 'Avoid (High Risk)', reasoning };
    }

    // Rule 5: Low Margin
    if (roiPercent < 10) {
      reasoning.push(`Projected ROI (${roiPercent}%) falls below the minimum margin threshold of 10%.`);
      return { status: 'Avoid (Low Margin)', reasoning };
    }

    // Rule 6: Strong Buy (Gated by minimum 2 independent data sources and 70% confidence)
    if (riskLevel === 'Low Risk' && roiPercent >= ROI_RECOMMENDATION_THRESHOLDS.strongBuyRoiPercent) {
      if (overallConfidence >= CONFIDENCE_GATES.strongBuyMinConfidence && sourceCount >= CONFIDENCE_GATES.strongBuyMinSources) {
        reasoning.push(`High projected ROI (${roiPercent}%) combined with low risk parameters and ${sourceCount} independent market sources.`);
        return { status: 'Strong Buy', reasoning };
      } else {
        // Downgrade to Buy due to single source or confidence threshold
        reasoning.push(`High projected ROI (${roiPercent}%) with low risk, but downgraded from Strong Buy due to single market source or moderate data confidence (${overallConfidence}%).`);
        return { status: 'Buy', reasoning };
      }
    }

    // Rule 7: Buy (Gated by minimum 55% overall confidence)
    if (roiPercent >= ROI_RECOMMENDATION_THRESHOLDS.buyRoiPercent) {
      if (overallConfidence >= CONFIDENCE_GATES.buyMinConfidence) {
        reasoning.push(`Good returns potential (${roiPercent}% ROI) with acceptable risk.`);
        return { status: 'Buy', reasoning };
      } else {
        reasoning.push(`Good projected returns (${roiPercent}% ROI), but downgraded to Watch due to limited data verifiability (${overallConfidence}% confidence).`);
        return { status: 'Watch', reasoning };
      }
    }

    // Rule 8: Watch / Proceed with Caution
    if (roiPercent < ROI_RECOMMENDATION_THRESHOLDS.tightMarginThresholdPercent) {
      reasoning.push(`Bidding margin is tight (${roiPercent}%). Refurbishment and logistical costs must be optimized.`);
    } else {
      reasoning.push('Decent margins but risk/confidence indicators suggest keeping bids within guidelines.');
    }

    return { status: 'Watch', reasoning };
  }
};
