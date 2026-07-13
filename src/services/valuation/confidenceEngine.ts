import { CONFIDENCE_WEIGHTS } from './roiConfig';

export interface ConfidenceFactors {
  ocr?: number;
  image?: number;
  weight?: number;
  material?: number;
  market?: number;
  seller?: number;
  history?: number;
  description?: number;
}

export interface ValuationConfidence {
  overallScore: number;
  breakdown: {
    ocr: number;
    image: number;
    weight: number;
    material: number;
    market: number;
    seller: number;
    history: number;
    description: number;
  };
}

export const confidenceEngine = {
  /**
   * Computes overall weighted confidence score based on individual components
   */
  calculateConfidence(factors: ConfidenceFactors): ValuationConfidence {
    // Standardize factors with sensible fallbacks if not provided
    const ocr = factors.ocr !== undefined ? factors.ocr : 90;
    const image = factors.image !== undefined ? factors.image : 85;
    const weight = factors.weight !== undefined ? factors.weight : 80;
    const material = factors.material !== undefined ? factors.material : 85;
    const market = factors.market !== undefined ? factors.market : 80;
    const seller = factors.seller !== undefined ? factors.seller : 80;
    const history = factors.history !== undefined ? factors.history : 75;
    const description = factors.description !== undefined ? factors.description : 85;

    // Apply weights from config
    let weightedSum = 0;
    let weightTotal = 0;

    const factorsMap = [
      { score: ocr, weight: CONFIDENCE_WEIGHTS.ocr },
      { score: image, weight: CONFIDENCE_WEIGHTS.image },
      { score: weight, weight: CONFIDENCE_WEIGHTS.weight },
      { score: material, weight: CONFIDENCE_WEIGHTS.material },
      { score: market, weight: CONFIDENCE_WEIGHTS.market },
      { score: seller, weight: CONFIDENCE_WEIGHTS.seller },
      { score: history, weight: CONFIDENCE_WEIGHTS.history }
    ];

    for (const f of factorsMap) {
      weightedSum += f.score * f.weight;
      weightTotal += f.weight;
    }

    const overallScore = Math.round(weightedSum / weightTotal);

    return {
      overallScore,
      breakdown: {
        ocr,
        image,
        weight,
        material,
        market,
        seller,
        history,
        description
      }
    };
  }
};
