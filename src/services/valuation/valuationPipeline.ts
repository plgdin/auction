import { matchCommodity } from '../valuationService';
import { detectModelId } from '../../utils/metalValuationModels';
import { currencyEngine } from './currencyEngine';
import { costEngine } from './costEngine';
import { marketEngine } from './marketEngine';
import { confidenceEngine } from './confidenceEngine';
import { riskEngine } from './riskEngine';
import { biddingEngine } from './biddingEngine';
import { simulationEngine } from './simulationEngine';
import { recommendationEngine } from './recommendationEngine';
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

export const valuationPipeline = {
  executeSync(
    rawItems: { sr: number; description: string; qty: string; unit: string; marketPrice?: string }[],
    costs: ValuationCosts,
    hasImages: boolean = false,
    location?: string
  ): ValuationOutput {
    const valuedItems: ValuationItem[] = [];
    let totalLotValue = 0;
    
    // Track indicators to compute confidence and risk
    let totalOcrConfidence = 0;
    let validItemsCount = 0;
    let containsUnserviceable = false;

    for (const rawItem of rawItems) {
      // 1. Parse quantity & unit conversion
      const qtyStr = rawItem.qty || '1';
      const parts = qtyStr.split('+');
      let totalQty = 0;
      let totalBaseQty = 0;

      const comm = matchCommodity(rawItem.description);
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

      const isFailedOrWithdrawn = descLower.includes('withdrawn') || 
                                  descLower.includes('cancelled') || 
                                  descLower.includes('unratified') || 
                                  descLower.includes('no bids') || 
                                  descLower.includes('zero bids') || 
                                  descLower.includes('failed auction');

      const isNotAvailable = isLotUnit || isUnparseableQty || isUnpriceable || isFailedOrWithdrawn || 
                             (isUnknownCommodity || isMismatch);

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
      const marketRes = marketEngine.resolvePriceSync(rawItem.description, location || 'Mumbai', rawItem.description);
      let avgPrice = marketRes.weightedPrice;
      let pricingConfidence = marketRes.confidence;
      let priceSource = marketRes.dominantSource;

      // Apply location logistical premium/discount
      const reg = getRegionalMultiplier(location);
      if (reg.multiplier !== 1.0) {
        avgPrice = Math.round(avgPrice * reg.multiplier);
        priceSource += ` [${reg.discountReason}]`;
      }

      // Apply catalog spot estimate overrides
      const customPriceStr = rawItem.marketPrice;
      if (customPriceStr) {
        const cleanPrice = customPriceStr.replace(/,/g, '');
        const priceMatch = cleanPrice.match(/(?:₹|Ôé╣|â‚¹|Ã”Ã©â•£)\s*(\d+)/);
        if (priceMatch) {
          let parsedPrice = parseInt(priceMatch[1], 10);
          if (parsedPrice > 1) {
            if (isPerKg && cleanPrice.toLowerCase().includes('/ ton')) {
              parsedPrice = parsedPrice / 1000;
            }
            avgPrice = parsedPrice;
            pricingConfidence = 85;
            priceSource = 'Catalog Spot Estimate';
          }
        }
      }

      const itemTotalValue = Math.round(avgPrice * baseQty);
      const itemUnitValue = Math.round(avgPrice * (baseQty / qty));

      // Calculate international conversions using standard currency conversions
      const usdUnit = Math.round(currencyEngine.convert(itemUnitValue * 0.95, 'INR', 'USD'));
      const usdTotal = Math.round(currencyEngine.convert(itemTotalValue * 0.95, 'INR', 'USD'));
      const gbpUnit = Math.round(currencyEngine.convert(itemUnitValue * 0.90, 'INR', 'GBP'));
      const gbpTotal = Math.round(currencyEngine.convert(itemTotalValue * 0.90, 'INR', 'GBP'));

      valuedItems.push({
        name: rawItem.description,
        qty,
        unitValue: itemUnitValue,
        totalValue: itemTotalValue,
        confidence: pricingConfidence,
        priceSource,
        internationalPrices: {
          in: { price: itemUnitValue, convertedPrice: itemTotalValue, sources: marketRes.sources.length },
          us: { price: usdUnit, convertedPrice: usdTotal, sources: 1 },
          uk: { price: gbpUnit, convertedPrice: gbpTotal, sources: 1 }
        }
      });

      totalLotValue += itemTotalValue;
      totalOcrConfidence += pricingConfidence;
      validItemsCount++;
    }

    totalLotValue = Math.round(totalLotValue);
    const avgPricingConfidence = validItemsCount > 0 ? Math.round(totalOcrConfidence / validItemsCount) : 50;

    // 4. Calculate total costs and taxes using Cost Engine
    const costResult = costEngine.calculateCosts(costs);
    const totalCost = costResult.totalCost;
    const estimatedProfit = totalLotValue > 0 ? totalLotValue - totalCost : 0;
    const roiPercent = totalLotValue > 0 && totalCost > 0 ? Math.round((estimatedProfit / totalCost) * 100) : 0;
    
    // Calculate mathematical break-even
    const breakEven = costEngine.calculateBreakEven(totalLotValue, costs);

    // 5. Evaluate overall confidence score via Confidence Engine
    const confidenceResult = confidenceEngine.calculateConfidence({
      ocr: validItemsCount > 0 ? 95 : 50,
      image: hasImages ? 92 : 55,
      weight: 85,
      material: 90,
      market: avgPricingConfidence,
      seller: 88,
      history: 80,
      description: 85
    });

    // 6. Evaluate risk rating via Risk Engine
    const riskResult = riskEngine.calculateRisk({
      priceVolatility: containsUnserviceable ? 60 : 35,
      marketTrend: 'flat',
      sellerReliability: 88,
      ocrConfidence: 95,
      photoQuality: hasImages ? 90 : 50,
      historicalError: 15,
      inspectionAvailable: true,
      categoryRisk: 30,
      transportRisk: location && location.length > 15 ? 45 : 20,
      environmentalRisk: containsUnserviceable ? 40 : 15
    });

    // 7. Run Monte Carlo simulation via Simulation Engine
    const simulationResult = simulationEngine.runSimulation(totalLotValue, costs);

    // 8. Generate recommendations via Recommendation Engine
    const recommendationResult = recommendationEngine.generateRecommendation({
      roiPercent,
      riskLevel: riskResult.level,
      riskScore: riskResult.score,
      overallConfidence: confidenceResult.overallScore,
      marketTrend: 'flat',
      currentBid: costs.currentBid || 0,
      totalLotValue
    });

    // 9. Generate bidding strategies via Bidding Engine
    const biddingResult = biddingEngine.generateBidRecommendations(totalLotValue, costs);

    // 10. Assemble structured output payload
    const internationalTotals = {
      in: totalLotValue,
      us: Math.round(currencyEngine.convert(totalLotValue * 0.95, 'INR', 'USD')),
      uk: Math.round(currencyEngine.convert(totalLotValue * 0.90, 'INR', 'GBP'))
    };

    return {
      items: valuedItems,
      totalLotValue,
      totalCost,
      estimatedProfit,
      roiPercent,
      breakEven,
      costs: {
        ...costs,
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
        version: '2.0.0'
      },
      // Keep support for legacy consumers/modal mapping
      // @ts-ignore
      riskAnalysis: {
        dataConfidence: confidenceResult.breakdown.ocr,
        pricingConfidence: confidenceResult.breakdown.market,
        overallConfidence: confidenceResult.overallScore,
        riskLevel: riskResult.level,
        reasoning: riskResult.reasoning.join(' ')
      },
      // @ts-ignore
      recommendationReasoning: recommendationResult.reasoning.join('. '),
      // @ts-ignore
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
