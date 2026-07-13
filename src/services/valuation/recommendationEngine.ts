import { ROI_RECOMMENDATION_THRESHOLDS } from './roiConfig';

export interface RecommendationInputs {
  roiPercent: number;
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  riskScore: number;
  overallConfidence: number;
  marketTrend: 'up' | 'down' | 'flat';
  currentBid: number;
  totalLotValue: number;
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
    | 'Avoid (Overpriced)';
  reasoning: string[];
}

export const recommendationEngine = {
  /**
   * Generates highly explainable, detailed recommendation codes and justifications
   */
  generateRecommendation(inputs: RecommendationInputs): ValuationRecommendation {
    const { roiPercent, riskLevel, riskScore, overallConfidence, marketTrend, currentBid, totalLotValue } = inputs;
    const reasoning: string[] = [];

    // Rule 1: Overpriced
    if (totalLotValue > 0 && currentBid >= totalLotValue) {
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

    // Rule 6: Strong Buy
    if (riskLevel === 'Low Risk' && roiPercent >= ROI_RECOMMENDATION_THRESHOLDS.strongBuyRoiPercent) {
      reasoning.push(`High projected ROI (${roiPercent}%) combined with low risk parameters.`);
      return { status: 'Strong Buy', reasoning };
    }

    // Rule 7: Buy
    if (roiPercent >= ROI_RECOMMENDATION_THRESHOLDS.buyRoiPercent) {
      reasoning.push(`Good returns potential (${roiPercent}% ROI) with acceptable risk.`);
      return { status: 'Buy', reasoning };
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
