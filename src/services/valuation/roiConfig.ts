// ROI and Valuation Configuration Parameters

export const TAX_CONFIG = {
  defaultGstPercent: 18,
  defaultTcsPercent: 1,
};

export const CONFIDENCE_WEIGHTS = {
  ocr: 0.15,
  image: 0.15,
  weight: 0.15,
  material: 0.20,
  market: 0.15,
  seller: 0.10,
  history: 0.10,
};

export const RISK_WEIGHTS = {
  priceVolatility: 0.15,
  marketTrend: 0.10,
  sellerReliability: 0.15,
  ocrConfidence: 0.10,
  photoQuality: 0.10,
  historicalError: 0.10,
  inspectionAvailable: 0.10,
  categoryRisk: 0.10,
  transportRisk: 0.05,
  environmentalRisk: 0.05,
};

export const ROI_RECOMMENDATION_THRESHOLDS = {
  strongBuyRoiPercent: 40,
  buyRoiPercent: 20,
  avoidHighRiskThreshold: 70, // Risk score > 70 is High Risk
  avoidLowConfidenceThreshold: 50, // Confidence score < 50 is Low Confidence
  tightMarginThresholdPercent: 15,
};

export const BID_MARGINS = {
  idealRoiPercent: 25,
  maxRoiPercent: 10, // Margin of profit
  conservativeRoiPercent: 40,
  aggressiveRoiPercent: 15,
};

export const SIMULATION_CONFIG = {
  iterations: 5000,
  weightVariancePercent: 0.05, // +/- 5%
  marketPriceVolatilityPercent: 0.10, // +/- 10%
  transportCostVariancePercent: 0.15, // +15% / -5%
  recoveryRateVariancePercent: 0.10, // +/- 10%
};
