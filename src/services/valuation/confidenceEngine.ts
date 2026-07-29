import { CONFIDENCE_WEIGHTS } from './roiConfig';
import { clamp } from './inputValidator';

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
   * Computes overall weighted confidence score based on individual components.
   * All factors are clamped to 0-100. Output is guaranteed to be a finite integer in 0-100.
   */
  calculateConfidence(factors: ConfidenceFactors): ValuationConfidence {
    // Standardize factors with sensible fallbacks if not provided, clamp to 0-100
    const ocr = clamp(factors.ocr !== undefined ? factors.ocr : 90, 0, 100);
    const image = clamp(factors.image !== undefined ? factors.image : 85, 0, 100);
    const weight = clamp(factors.weight !== undefined ? factors.weight : 80, 0, 100);
    const material = clamp(factors.material !== undefined ? factors.material : 85, 0, 100);
    const market = clamp(factors.market !== undefined ? factors.market : 80, 0, 100);
    const seller = clamp(factors.seller !== undefined ? factors.seller : 80, 0, 100);
    const history = clamp(factors.history !== undefined ? factors.history : 75, 0, 100);
    const description = clamp(factors.description !== undefined ? factors.description : 85, 0, 100);

    // Apply weights from config — include description factor
    let weightedSum = 0;
    let weightTotal = 0;

    const factorsMap = [
      { score: ocr, weight: CONFIDENCE_WEIGHTS.ocr },
      { score: image, weight: CONFIDENCE_WEIGHTS.image },
      { score: weight, weight: CONFIDENCE_WEIGHTS.weight },
      { score: material, weight: CONFIDENCE_WEIGHTS.material },
      { score: market, weight: CONFIDENCE_WEIGHTS.market },
      { score: seller, weight: CONFIDENCE_WEIGHTS.seller },
      { score: history, weight: CONFIDENCE_WEIGHTS.history },
      { score: description, weight: CONFIDENCE_WEIGHTS.description ?? 0.10 }
    ];

    for (const f of factorsMap) {
      weightedSum += f.score * f.weight;
      weightTotal += f.weight;
    }

    const overallScore = weightTotal > 0 ? clamp(Math.round(weightedSum / weightTotal), 0, 100) : 0;

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

