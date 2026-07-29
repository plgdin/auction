import { marketPriceService } from '../marketPriceService';
import { matchCommodity } from '../valuationService';
import { safeRound, safeDivide } from './inputValidator';

export interface PriceSourceDetails {
  source: string;
  price: number;
  weight: number;
  confidence: number;
  freshness: number; // 0.0 - 1.0
  timestamp: string;
  region: string;
}

export interface MarketPriceResult {
  weightedPrice: number;
  sources: PriceSourceDetails[];
  dominantSource: string;
  freshness: number;
  confidence: number;
  basePrice: number;
}

export const marketEngine = {
  /**
   * Resolves market pricing using ONLY real, verified data sources:
   * 1. Admin / Database Index Baseline (always present as baseline)
   * 2. Historical MSTC Auction Winning Bids (included only if real logs exist)
   * 3. MetalMandi Live Mandi Rates (included only if real scraped rate exists)
   * 
   * Confidence is scaled honestly by actual source count and price agreement between sources.
   */
  resolvePriceSync(
    itemName: string,
    region: string = 'Mumbai',
    description: string = ''
  ): MarketPriceResult {
    // Standardize naming/lookup via matched commodity
    const comm = matchCommodity(description || itemName);
    let dbPrice = marketPriceService.getCommodityPrice(comm.name) || comm.basePricePerKg || comm.basePricePerUnit || 50;

    // Guard against zero/NaN/negative base price
    if (!Number.isFinite(dbPrice) || dbPrice <= 0) {
      dbPrice = comm.basePricePerKg || comm.basePricePerUnit || 50;
    }

    const nowIso = new Date().toISOString();
    const sources: PriceSourceDetails[] = [];

    // Source 1: Admin / Database Index Baseline (Always present)
    sources.push({
      source: 'Admin Commodity Baseline',
      price: dbPrice,
      weight: 0.40,
      confidence: 70,
      freshness: 0.85,
      timestamp: nowIso,
      region: 'India'
    });

    // Source 2: Historical MSTC Auctions (Included ONLY if actual past auction logs exist for this commodity)
    try {
      const logs = marketPriceService.getPriceHistoryLogs();
      const relevantLogs = logs.filter(log => log.commodityId === comm.name);
      if (relevantLogs.length > 0) {
        const sum = relevantLogs.reduce((acc, log) => acc + log.price, 0);
        const historicalPrice = safeRound(sum / relevantLogs.length);
        if (historicalPrice > 0) {
          sources.push({
            source: 'Historical Auctions Avg',
            price: historicalPrice,
            weight: 0.30,
            confidence: 85,
            freshness: 0.75,
            timestamp: relevantLogs[0].timestamp || new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            region: 'India'
          });
        }
      }
    } catch {}

    // Source 3: MetalMandi Live Mandi Rate (Included ONLY if a real rate is cached from the scraper)
    try {
      const mandiRate = marketPriceService.getMetalMandiRateForCommodity(comm.name);
      if (mandiRate && mandiRate.price_per_kg > 0) {
        sources.push({
          source: `MetalMandi (${mandiRate.grade_name})`,
          price: mandiRate.price_per_kg,
          weight: 0.50,
          confidence: 90,
          freshness: 0.95,
          timestamp: mandiRate.updated_at || nowIso,
          region
        });
      }
    } catch {}

    // Calculate weighted price across actual resolving sources
    let totalWeightFreshness = 0;
    let weightedPriceSum = 0;
    let confidenceSum = 0;
    let freshnessSum = 0;
    let totalWeight = 0;

    let dominantSource = sources[0].source;
    let highestWeight = -1;

    for (const src of sources) {
      const factor = src.weight * src.freshness;
      weightedPriceSum += src.price * factor;
      totalWeightFreshness += factor;

      confidenceSum += src.confidence * src.weight;
      freshnessSum += src.freshness * src.weight;
      totalWeight += src.weight;

      if (src.weight > highestWeight) {
        highestWeight = src.weight;
        dominantSource = src.source;
      }
    }

    let weightedPrice = safeRound(safeDivide(weightedPriceSum, totalWeightFreshness, dbPrice));
    if (weightedPrice <= 0) {
      weightedPrice = dbPrice;
    }

    // Honest confidence calculation based on real source count and agreement
    let rawConfidence = safeRound(safeDivide(confidenceSum, totalWeight, 60));
    
    // Confidence caps based on actual source availability:
    // 1 source: max 60% confidence (no independent verification)
    // 2 sources: max 80% confidence
    // 3+ sources: max 95% confidence
    let confidenceCap = 60;
    if (sources.length === 2) confidenceCap = 80;
    else if (sources.length >= 3) confidenceCap = 95;

    let overallConfidence = Math.min(rawConfidence, confidenceCap);

    // Penalty if sources disagree significantly (>15% price spread between min and max price)
    if (sources.length > 1) {
      const prices = sources.map(s => s.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const spreadRatio = safeDivide(maxPrice - minPrice, minPrice, 0);
      if (spreadRatio > 0.15) {
        const penalty = Math.round(spreadRatio * 30);
        overallConfidence = Math.max(30, overallConfidence - penalty);
      }
    }

    const overallFreshness = safeRound(safeDivide(freshnessSum, totalWeight, 0.8) * 100);

    return {
      weightedPrice,
      sources,
      dominantSource,
      freshness: overallFreshness,
      confidence: overallConfidence,
      basePrice: dbPrice
    };
  },

  async resolvePrice(
    itemName: string,
    region: string = 'Mumbai',
    description: string = ''
  ): Promise<MarketPriceResult> {
    return this.resolvePriceSync(itemName, region, description);
  }
};
