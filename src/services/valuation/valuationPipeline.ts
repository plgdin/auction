import { matchCommodity } from '../valuationService';
import { marketPriceService } from '../marketPriceService';
import { detectModelId } from '../../utils/metalValuationModels';
import { currencyEngine } from './currencyEngine';
import { costEngine } from './costEngine';
import { marketEngine } from './marketEngine';
import { confidenceEngine } from './confidenceEngine';
import { riskEngine } from './riskEngine';
import { biddingEngine } from './biddingEngine';
import { simulationEngine } from './simulationEngine';
import { recommendationEngine } from './recommendationEngine';
import { safeRound, safeDivide, validateAndSanitizeItems, validateAndSanitizeCosts } from './inputValidator';
import type { ValuationCosts, ValuationOutput, ValuationItem } from './types';

// Logistics discount helper matching original valuationService logic
function getRegionalMultiplier(location?: string): { multiplier: number, discountReason?: string } {
  if (!location) return { multiplier: 1.0 };
  const loc = location.toLowerCase();
  
  if (
    loc.includes('assam') || loc.includes('nagaland') || loc.includes('manipur') || 
    loc.includes('tripura') || loc.includes('mizoram') || loc.includes('arunachal') || 
    loc.includes('sikkim') || loc.includes('jammu') || loc.includes('kashmir') ||
    loc.includes('andaman') || loc.includes('nicobar') || loc.includes('lakshadweep') ||
    loc.includes('leh') || loc.includes('ladakh')
  ) {
    return { multiplier: 0.90, discountReason: '10% remote region logistics discount' };
  }
  
  if (
    loc.includes('bihar') || loc.includes('jharkhand') || loc.includes('chhattisgarh') ||
    loc.includes('odisha') || loc.includes('orissa') || loc.includes('uttarakhand')
  ) {
    return { multiplier: 0.95, discountReason: '5% secondary region logistics discount' };
  }
  
  return { multiplier: 1.0 };
}

// Extract approx unit weight from description
function extractUnitWeight(description: string): number | null {
  const desc = (description || '').toLowerCase();
  
  // Pattern matching patterns like "APPROX WEIGHT : 120 GRAM PER 1 Nos", "10.5 kg each", etc.
  const weightRegex = /(?:approx\s*wt\.?|approx\s*weight|weight|wt\.?)\s*:?\s*([\d\.,]+)\s*(gram|g|kg|kilogram|ton|tonne|mt)(?:\s*per|\s*each|\s*\/|\b)/i;
  
  const match = desc.match(weightRegex);
  if (match) {
    const value = parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2].toLowerCase();
    if (!isNaN(value)) {
      if (unit === 'gram' || unit === 'g') {
        return value / 1000;
      } else if (unit === 'ton' || unit === 'tonne' || unit === 'mt') {
        return value * 1000;
      } else {
        return value; // kg
      }
    }
  }
  
  const altRegex = /\b([\d\.,]+)\s*(gram|g|kg|kilogram|ton|tonne|mt)\s*(?:each|per|\/)/i;
  const altMatch = desc.match(altRegex);
  if (altMatch) {
    const value = parseFloat(altMatch[1].replace(/,/g, ''));
    const unit = altMatch[2].toLowerCase();
    if (!isNaN(value)) {
      if (unit === 'gram' || unit === 'g') {
        return value / 1000;
      } else if (unit === 'ton' || unit === 'tonne' || unit === 'mt') {
        return value * 1000;
      } else {
        return value;
      }
    }
  }
  
  return null;
}

function getDefaultUnitWeight(commodityName: string, modelId: string | null): number {
  const comm = (commodityName || '').toLowerCase();
  const model = modelId ? modelId.toLowerCase() : '';
  
  if (comm === 'copper') return 0.5;
  if (comm === 'brass') return 0.5;
  if (comm === 'aluminium' || comm === 'aluminum') return 0.5;
  if (comm === 'lead') return 2.0;
  if (comm === 'zinc') return 1.0;
  
  if (comm === 'steel_iron_ferrous' || model === 'primary_steel' || model === 'scrap_steel') {
    return 5.0; // 5 kg
  }
  
  return 1.0;
}

function getDefaultWeightPerUnit(commodityName: string, modelId: string | null): number {
  const comm = (commodityName || '').toLowerCase();
  const model = modelId ? modelId.toLowerCase() : '';
  
  if (model === 'cars_vehicles' || comm === 'vehicle') return 1500; // 1.5 Tons
  if (comm === 'heavy_vehicle_machinery') return 5000; // 5 Tons
  if (comm === 'transformer') return 1000; // 1 Ton
  if (comm === 'e_waste' || model === 'e_waste_electronics') return 10; // 10 kg
  if (comm === 'motorcycle') return 150; // 150 kg
  
  return 100;
}

/** Creates a safe zero-value output when the pipeline encounters a catastrophic error */
function createEmptyOutput(costs: ValuationCosts): ValuationOutput {
  return {
    items: [],
    totalLotValue: 0,
    totalCost: 0,
    estimatedProfit: 0,
    roiPercent: 0,
    breakEven: 0,
    costs,
    risk: { score: 50, level: 'Medium Risk', breakdown: { priceVolatility: 50, marketTrend: 50, sellerReliability: 50, ocrConfidence: 50, photoQuality: 50, historicalError: 50, inspectionAvailable: 50, categoryRisk: 50, transportRisk: 50, environmentalRisk: 50 }, reasoning: ['Insufficient data for risk assessment.'] },
    confidence: { overallScore: 0, breakdown: { ocr: 0, image: 0, weight: 0, material: 0, market: 0, seller: 0, history: 0, description: 0 } },
    recommendation: { status: 'Watch', reasoning: ['Unable to compute valuation — data may be incomplete.'] },
    bidding: { idealBid: 0, maxBid: 0, walkAwayPrice: 0, conservativeBid: 0, aggressiveBid: 0 },
    simulation: { expectedRoi: 0, worstRoi: 0, bestRoi: 0, chanceOfProfit: 0 },
    metadata: { calculatedAt: new Date().toISOString(), version: '2.1.0' },
    riskAnalysis: { dataConfidence: 0, pricingConfidence: 0, overallConfidence: 0, riskLevel: 'Medium Risk', reasoning: 'Insufficient data.' },
    recommendationReasoning: 'Unable to compute valuation.',
    internationalTotals: { in: 0, us: 0, uk: 0 }
  };
}

export const valuationPipeline = {
  executeSync(
    rawItems: { sr: number; description: string; qty: string; unit: string; marketPrice?: string }[],
    costs: ValuationCosts,
    hasImages: boolean = false,
    location?: string
  ): ValuationOutput {
    try {
      return this._executeSyncCore(rawItems, costs, hasImages, location);
    } catch (err) {
      console.error('[ValuationPipeline] Catastrophic failure, returning safe empty output:', err);
      return createEmptyOutput(costs);
    }
  },

  /** Core pipeline logic — separated so the try/catch wrapper stays clean */
  _executeSyncCore(
    rawItems: { sr: number; description: string; qty: string; unit: string; marketPrice?: string }[],
    costs: ValuationCosts,
    hasImages: boolean = false,
    location?: string
  ): ValuationOutput {
    // Validate and sanitize inputs
    const { items: sanitizedItems } = validateAndSanitizeItems(rawItems);
    const sanitizedCosts = validateAndSanitizeCosts(costs);

    const valuedItems: ValuationItem[] = [];
    let totalLotValue = 0;
    
    // Track indicators to compute confidence and risk
    let totalOcrConfidence = 0;
    let validItemsCount = 0;
    let containsUnserviceable = false;
    let maxSourcesCount = 1;
    let primaryCategory = 'Metals';
    let longestDescLen = 0;

    for (const rawItem of sanitizedItems) {
      if ((rawItem.description || '').length > longestDescLen) {
        longestDescLen = (rawItem.description || '').length;
      }

      // 1. Parse quantity & unit conversion
      const qtyStr = rawItem.qty || '1';
      const parts = qtyStr.split('+');
      let totalQty = 0;
      let totalBaseQty = 0;

      const comm = matchCommodity(rawItem.description);
      const commConfig = marketPriceService.getCommodityPrices().find(c => c.id === comm.name);
      if (commConfig?.category) primaryCategory = commConfig.category;
      const isPerKg = comm.basePricePerKg !== undefined;

      for (const part of parts) {
        const cleanPart = part.replace(/,/g, '').trim();
        const partQty = parseFloat(cleanPart);
        if (isNaN(partQty) || partQty <= 0) continue;

        totalQty += partQty;

        const unitMatch = cleanPart.match(/[\d\.]+\s*([a-zA-Z][a-zA-Z\.]*)/);
        const partUnit = (unitMatch ? unitMatch[1] : rawItem.unit || '').toLowerCase().trim();

        let partBaseQty = partQty;
        if (isPerKg) {
          if (partUnit.includes('mt') || partUnit.includes('ton') || partUnit.includes('tonne')) {
            partBaseQty = partQty * 1000;
          }
        }
        totalBaseQty += partBaseQty;
      }

      const qty = totalQty > 0 ? totalQty : 1;
      let baseQty = totalBaseQty > 0 ? totalBaseQty : 1;

      // 2. Not Available / Unpriceable lot filters
      const descLower = (rawItem.description || '').toLowerCase();
      const cleanQty = qtyStr.replace(/,/g, '').trim();
      const parsedQty = parseFloat(cleanQty);
      const qtyLower = cleanQty.toLowerCase();
      const unitLower = (rawItem.unit || '').toLowerCase().trim();

      if (descLower.includes('unserviceable') || descLower.includes('damaged') || descLower.includes('broken')) {
        containsUnserviceable = true;
      }

      const isLotUnit = unitLower.includes('lot') || qtyLower.includes('lot') || unitLower === 'ls' || unitLower === 'lumpsum';
      const isUnparseableQty = isNaN(parsedQty) || parsedQty <= 0;
      
      const unpriceableWords = [
        'ship', 'boat', 'vessel', 'yacht', 'barge', 'ferry', 'tugboat', 'cruiser',
        'property', 'flat', 'plot', 'land', 'building', 'office space', 'shop', 'showroom', 'immovable'
      ];
      const isUnpriceable = unpriceableWords.some(word => {
        const regex = new RegExp(`\\b${word}(?:s|es)?\\b`, 'i');
        return regex.test(descLower);
      });
      
      const isUnknownCommodity = comm.name === 'default';
      const isDiscrete = unitLower.includes('no') || unitLower === 'ea' || unitLower.includes('unit') || unitLower.includes('set') || unitLower === 'pc' || unitLower === 'pcs' || unitLower.includes('item');
      const isWeight = unitLower.includes('kg') || unitLower.includes('mt') || unitLower.includes('ton') || unitLower.includes('tonne');
      
      const modelId = detectModelId(rawItem.description);
      const targetUnit = modelId ? (modelId === 'cars_vehicles' || modelId === 'e_waste_electronics' ? 'Units' : 'Tons') : (comm.unit === 'kg' || comm.unit === 'Ton' ? 'Tons' : 'Units');
      let isMismatch = (isDiscrete && targetUnit === 'Tons') || (isWeight && targetUnit === 'Units');

      if (isMismatch) {
        if (isDiscrete && targetUnit === 'Tons') {
          const parsedWeight = extractUnitWeight(rawItem.description);
          const unitWeight = parsedWeight !== null ? parsedWeight : getDefaultUnitWeight(comm.name, modelId);
          baseQty = qty * unitWeight;
          isMismatch = false;
        } else if (isWeight && targetUnit === 'Units') {
          let totalWeightKg = baseQty;
          if (unitLower.includes('mt') || unitLower.includes('ton') || unitLower.includes('tonne')) {
            totalWeightKg = qty * 1000;
          }
          const weightPerUnit = getDefaultWeightPerUnit(comm.name, modelId);
          baseQty = totalWeightKg / weightPerUnit;
          isMismatch = false;
        }
      }

      // Check for catalog spot estimate / explicit market price overrides first
      let hasExplicitMarketPrice = false;
      let explicitPrice = 0;
      const customPriceStr = rawItem.marketPrice;
      if (customPriceStr) {
        const cleanPrice = customPriceStr.replace(/,/g, '').trim();
        const priceMatch = cleanPrice.match(/(?:₹|Ôé╣|â‚¹|Ã”Ã©â•£|rs\.?|inr)?\s*([\d\.]+)/i);
        if (priceMatch) {
          let parsedPrice = parseFloat(priceMatch[1]);
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            if (isPerKg && cleanPrice.toLowerCase().includes('/ ton')) {
              parsedPrice = parsedPrice / 1000;
            }
            explicitPrice = Math.round(parsedPrice);
            hasExplicitMarketPrice = true;
          }
        }
      }

      const isFailedOrWithdrawn = descLower.includes('withdrawn') || 
                                  descLower.includes('cancelled') || 
                                  descLower.includes('unratified') || 
                                  descLower.includes('no bids') || 
                                  descLower.includes('zero bids') || 
                                  descLower.includes('failed auction');

      const isNotAvailable = isFailedOrWithdrawn || 
                            (!hasExplicitMarketPrice && (isLotUnit || isUnparseableQty || isUnpriceable || (isUnknownCommodity || isMismatch)));

      if (isNotAvailable) {
        valuedItems.push({
          name: rawItem.description,
          qty,
          unitValue: 0,
          totalValue: 0,
          confidence: 0,
          notAvailable: true,
          priceSource: 'Unpriceable Item Spec',
          internationalPrices: {
            in: { price: 0, convertedPrice: 0, sources: 0 },
            us: { price: 0, convertedPrice: 0, sources: 0 },
            uk: { price: 0, convertedPrice: 0, sources: 0 }
          }
        });
        continue;
      }

      // 3. Resolve market pricing via Market Pricing Engine (Sync)
      let avgPrice = 0;
      let pricingConfidence = 0;
      let priceSource = '';
      let sourcesCount = 1;

      if (hasExplicitMarketPrice) {
        avgPrice = explicitPrice;
        pricingConfidence = 85;
        priceSource = 'Catalog Spot Estimate';
        sourcesCount = 1;
      } else {
        const marketRes = marketEngine.resolvePriceSync(rawItem.description, location || 'Mumbai', rawItem.description);
        avgPrice = marketRes.weightedPrice;
        pricingConfidence = marketRes.confidence;
        priceSource = marketRes.dominantSource;
        sourcesCount = marketRes.sources?.length || 1;

        if (sourcesCount > maxSourcesCount) {
          maxSourcesCount = sourcesCount;
        }

        // Apply location logistical premium/discount
        const reg = getRegionalMultiplier(location);
        if (reg.multiplier !== 1.0) {
          avgPrice = Math.round(avgPrice * reg.multiplier);
          priceSource += ` [${reg.discountReason}]`;
        }
      }

      const itemTotalValue = safeRound(avgPrice * baseQty);
      const itemUnitValue = safeRound(avgPrice * safeDivide(baseQty, qty, 1));

      // Calculate international conversions using standard currency conversions
      const usdUnit = safeRound(currencyEngine.convert(itemUnitValue * 0.95, 'INR', 'USD'));
      const usdTotal = safeRound(currencyEngine.convert(itemTotalValue * 0.95, 'INR', 'USD'));
      const gbpUnit = safeRound(currencyEngine.convert(itemUnitValue * 0.90, 'INR', 'GBP'));
      const gbpTotal = safeRound(currencyEngine.convert(itemTotalValue * 0.90, 'INR', 'GBP'));

      valuedItems.push({
        name: rawItem.description,
        qty,
        unitValue: itemUnitValue,
        totalValue: itemTotalValue,
        confidence: pricingConfidence,
        priceSource,
        internationalPrices: {
          in: { price: itemUnitValue, convertedPrice: itemTotalValue, sources: sourcesCount },
          us: { price: usdUnit, convertedPrice: usdTotal, sources: 1 },
          uk: { price: gbpUnit, convertedPrice: gbpTotal, sources: 1 }
        }
      });

      totalLotValue += itemTotalValue;
      totalOcrConfidence += pricingConfidence;
      validItemsCount++;
    }

    totalLotValue = safeRound(totalLotValue);
    const avgPricingConfidence = validItemsCount > 0 ? safeRound(safeDivide(totalOcrConfidence, validItemsCount, 50)) : 50;

    // 4. Calculate total costs and taxes using Cost Engine
    const costResult = costEngine.calculateCosts(sanitizedCosts);
    const totalCost = costResult.totalCost;
    const estimatedProfit = totalLotValue > 0 ? totalLotValue - totalCost : 0;
    const roiPercent = totalLotValue > 0 && totalCost > 0 ? safeRound(safeDivide(estimatedProfit, totalCost, 0) * 100) : 0;
    
    // Calculate mathematical break-even
    const breakEven = costEngine.calculateBreakEven(totalLotValue, sanitizedCosts);

    // Derive category baseline risk
    let categoryRiskScore = 25; // Metals
    if (primaryCategory === 'Agriculture' || primaryCategory === 'Energy') categoryRiskScore = 35;
    else if (primaryCategory === 'Vehicles') categoryRiskScore = 45;
    else if (primaryCategory === 'Electronics') categoryRiskScore = 55;
    else if (primaryCategory === 'Property' || primaryCategory === 'Others') categoryRiskScore = 60;

    const descConfidence = longestDescLen > 100 ? 75 : longestDescLen > 30 ? 55 : 35;

    // 5. Evaluate overall confidence score via Confidence Engine (honest assumptions)
    const confidenceResult = confidenceEngine.calculateConfidence({
      ocr: validItemsCount > 0 ? 80 : 40,
      image: hasImages ? 85 : 45,
      weight: 50, // assumed: no weight sensor signal
      material: 50, // assumed: keyword-based matching
      market: avgPricingConfidence, // honest, from market engine
      seller: 50, // assumed: no seller history table yet
      history: 50, // assumed baseline
      description: descConfidence
    });

    // 6. Evaluate risk rating via Risk Engine (honest assumptions)
    const riskResult = riskEngine.calculateRisk({
      priceVolatility: containsUnserviceable ? 65 : 35,
      marketTrend: 'flat',
      sellerReliability: 50, // assumed baseline
      ocrConfidence: avgPricingConfidence,
      photoQuality: hasImages ? 85 : 45,
      historicalError: 35, // assumed baseline error
      inspectionAvailable: false, // assumed worst case (not inspected)
      categoryRisk: categoryRiskScore,
      transportRisk: location && location.length > 15 ? 45 : 20,
      environmentalRisk: containsUnserviceable ? 50 : 15
    });

    // 7. Run Monte Carlo simulation via Simulation Engine
    const simulationResult = simulationEngine.runSimulation(totalLotValue, sanitizedCosts);

    // 8. Generate recommendations via Recommendation Engine (with source count & confidence gates)
    const recommendationResult = recommendationEngine.generateRecommendation({
      roiPercent,
      riskLevel: riskResult.level,
      riskScore: riskResult.score,
      overallConfidence: confidenceResult.overallScore,
      marketTrend: 'flat',
      currentBid: sanitizedCosts.currentBid,
      totalLotValue,
      sourceCount: maxSourcesCount
    });

    // 9. Generate bidding strategies via Bidding Engine
    const biddingResult = biddingEngine.generateBidRecommendations(totalLotValue, sanitizedCosts);

    // 10. Assemble structured output payload
    const internationalTotals = {
      in: totalLotValue,
      us: safeRound(currencyEngine.convert(totalLotValue * 0.95, 'INR', 'USD')),
      uk: safeRound(currencyEngine.convert(totalLotValue * 0.90, 'INR', 'GBP'))
    };

    return {
      items: valuedItems,
      totalLotValue,
      totalCost,
      estimatedProfit,
      roiPercent,
      breakEven,
      costs: {
        ...sanitizedCosts,
        gstAmount: costResult.gstAmount,
        tcsAmount: costResult.tcsAmount
      },
      risk: riskResult,
      confidence: confidenceResult,
      recommendation: recommendationResult,
      bidding: biddingResult,
      simulation: simulationResult,
      metadata: {
        calculatedAt: new Date().toISOString(),
        version: '2.1.0'
      },
      // Legacy compatibility fields — properly typed, no @ts-ignore needed
      riskAnalysis: {
        dataConfidence: confidenceResult.breakdown.ocr,
        pricingConfidence: confidenceResult.breakdown.market,
        overallConfidence: confidenceResult.overallScore,
        riskLevel: riskResult.level,
        reasoning: riskResult.reasoning.join(' ')
      },
      recommendationReasoning: recommendationResult.reasoning.join('. '),
      internationalTotals
    };
  },

  async execute(
    rawItems: { sr: number; description: string; qty: string; unit: string; marketPrice?: string }[],
    costs: ValuationCosts,
    hasImages: boolean = false,
    location?: string
  ): Promise<ValuationOutput> {
    return this.executeSync(rawItems, costs, hasImages, location);
  }
};
