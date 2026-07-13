import { RISK_WEIGHTS, ROI_RECOMMENDATION_THRESHOLDS } from './roiConfig';

export interface RiskFactors {
  priceVolatility?: number; // 0-100 risk, higher = volatile
  marketTrend?: 'up' | 'down' | 'flat'; // up reduces risk, down increases
  sellerReliability?: number; // 0-100 score, higher = reliable
  ocrConfidence?: number; // 0-100, higher = clear
  photoQuality?: number; // 0-100, higher = clear
  historicalError?: number; // 0-100, prediction error
  inspectionAvailable?: boolean;
  categoryRisk?: number; // 0-100, commodity category baseline
  transportRisk?: number; // 0-100, logistics/remote discount
  environmentalRisk?: number; // 0-100, scrap processing risk
}

export interface ValuationRisk {
  score: number; // 0-100
  level: 'Low Risk' | 'Medium Risk' | 'High Risk';
  breakdown: {
    priceVolatility: number;
    marketTrend: number;
    sellerReliability: number;
    ocrConfidence: number;
    photoQuality: number;
    historicalError: number;
    inspectionAvailable: number;
    categoryRisk: number;
    transportRisk: number;
    environmentalRisk: number;
  };
  reasoning: string[];
}

export const riskEngine = {
  /**
   * Evaluates various risk inputs and returns a weighted risk rating
   */
  calculateRisk(factors: RiskFactors): ValuationRisk {
    // 1. Establish individual risk components (0-100, where 100 is maximum risk)
    const priceVolatility = factors.priceVolatility !== undefined ? factors.priceVolatility : 35;
    
    let marketTrendRisk = 50; // flat
    if (factors.marketTrend === 'up') marketTrendRisk = 20;
    else if (factors.marketTrend === 'down') marketTrendRisk = 80;

    const sellerReliabilityScore = factors.sellerReliability !== undefined ? factors.sellerReliability : 85;
    const sellerReliabilityRisk = 100 - sellerReliabilityScore; // low reliability = high risk

    const ocrConf = factors.ocrConfidence !== undefined ? factors.ocrConfidence : 90;
    const ocrRisk = 100 - ocrConf;

    const photoQ = factors.photoQuality !== undefined ? factors.photoQuality : 80;
    const photoRisk = 100 - photoQ;

    const historicalError = factors.historicalError !== undefined ? factors.historicalError : 20;

    const inspectionRisk = factors.inspectionAvailable === true ? 15 : 65; // missing physical inspection adds risk

    const categoryRisk = factors.categoryRisk !== undefined ? factors.categoryRisk : 30;
    const transportRisk = factors.transportRisk !== undefined ? factors.transportRisk : 20;
    const environmentalRisk = factors.environmentalRisk !== undefined ? factors.environmentalRisk : 15;

    // 2. Compute weighted score
    let weightedSum = 0;
    let weightTotal = 0;

    const risksMap = [
      { score: priceVolatility, weight: RISK_WEIGHTS.priceVolatility, name: 'priceVolatility' },
      { score: marketTrendRisk, weight: RISK_WEIGHTS.marketTrend, name: 'marketTrend' },
      { score: sellerReliabilityRisk, weight: RISK_WEIGHTS.sellerReliability, name: 'sellerReliability' },
      { score: ocrRisk, weight: RISK_WEIGHTS.ocrConfidence, name: 'ocrConfidence' },
      { score: photoRisk, weight: RISK_WEIGHTS.photoQuality, name: 'photoQuality' },
      { score: historicalError, weight: RISK_WEIGHTS.historicalError, name: 'historicalError' },
      { score: inspectionRisk, weight: RISK_WEIGHTS.inspectionAvailable, name: 'inspectionAvailable' },
      { score: categoryRisk, weight: RISK_WEIGHTS.categoryRisk, name: 'categoryRisk' },
      { score: transportRisk, weight: RISK_WEIGHTS.transportRisk, name: 'transportRisk' },
      { score: environmentalRisk, weight: RISK_WEIGHTS.environmentalRisk, name: 'environmentalRisk' },
    ];

    for (const r of risksMap) {
      weightedSum += r.score * r.weight;
      weightTotal += r.weight;
    }

    const score = Math.round(weightedSum / weightTotal);

    // 3. Determine Risk Level
    let level: 'Low Risk' | 'Medium Risk' | 'High Risk' = 'Medium Risk';
    if (score > ROI_RECOMMENDATION_THRESHOLDS.avoidHighRiskThreshold) {
      level = 'High Risk';
    } else if (score < 35) {
      level = 'Low Risk';
    }

    // 4. Generate explainable reasoning comments
    const reasoning: string[] = [];
    if (priceVolatility > 50) reasoning.push('High volatility in global spot/index pricing.');
    if (factors.marketTrend === 'down') reasoning.push('Market commodity index is in a downtrend.');
    if (sellerReliabilityScore < 70) reasoning.push(`Low seller reliability score (${sellerReliabilityScore}%).`);
    if (factors.inspectionAvailable !== true) reasoning.push('Physical catalog site inspection is not available.');
    if (transportRisk > 40) reasoning.push('Remote region logistics transit risk.');
    if (ocrRisk > 30) reasoning.push('Low OCR extraction confidence for item specs.');
    if (reasoning.length === 0) {
      reasoning.push('Manageable volatility with stable seller history and logistics.');
    }

    return {
      score,
      level,
      breakdown: {
        priceVolatility,
        marketTrend: marketTrendRisk,
        sellerReliability: sellerReliabilityRisk,
        ocrConfidence: ocrRisk,
        photoQuality: photoRisk,
        historicalError,
        inspectionAvailable: inspectionRisk,
        categoryRisk,
        transportRisk,
        environmentalRisk
      },
      reasoning
    };
  }
};
