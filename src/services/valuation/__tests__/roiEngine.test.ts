import { describe, it, expect } from 'vitest';
import { roiEngine } from '../roiEngine';
import { currencyEngine } from '../currencyEngine';
import { costEngine } from '../costEngine';
import { confidenceEngine } from '../confidenceEngine';
import { riskEngine } from '../riskEngine';
import { recommendationEngine } from '../recommendationEngine';
import { simulationEngine } from '../simulationEngine';
import { marketEngine } from '../marketEngine';
import { biddingEngine } from '../biddingEngine';

describe('costEngine', () => {
  it('correctly calculates GST, TCS, and total cost breakdown', () => {
    const costsInput = {
      currentBid: 1000000,
      gstPercent: 18,
      tcsPercent: 1,
      transportation: 10000,
      loading: 5000,
      unloading: 3000,
      otherFees: 2000
    };

    const calculated = costEngine.calculateCosts(costsInput);
    
    // GST = 18% of 1,000,000 = 180,000
    expect(calculated.gstAmount).toBe(180000);
    // TCS = 1% of (1,000,000 + 180,000) = 11,800
    expect(calculated.tcsAmount).toBe(11800);
    // Other expenses = 10,000 + 5,000 + 3,000 + 2,000 = 20,000
    expect(calculated.otherExpenses).toBe(20000);
    // Total cost = 1,000,000 + 180,000 + 11,800 + 20,000 = 1,211,800
    expect(calculated.totalCost).toBe(1211800);
  });

  it('calculates exact mathematical break-even bid price', () => {
    const costsInput = {
      currentBid: 0,
      gstPercent: 18,
      tcsPercent: 1,
      transportation: 80000,
      loading: 20000
    };
    const totalLotValue = 1500000;

    const breakEvenBid = costEngine.calculateBreakEven(totalLotValue, costsInput);

    // Formula: (1,500,000 - 100,000) / 1.1918 = 1,174,694
    expect(breakEvenBid).toBe(1174694);

    const costsAtBreakEven = costEngine.calculateCosts({
      ...costsInput,
      currentBid: breakEvenBid
    });
    expect(costsAtBreakEven.totalCost).toBe(totalLotValue);
  });
});

describe('currencyEngine', () => {
  it('converts USD to INR correctly', () => {
    const inrValue = currencyEngine.convert(100, 'USD', 'INR');
    expect(inrValue).toBe(8500);
  });

  it('converts INR to GBP correctly', () => {
    const gbpValue = currencyEngine.convert(108000, 'INR', 'GBP');
    expect(gbpValue).toBe(1000);
  });
});

describe('confidenceEngine', () => {
  it('computes weighted confidence score accurately', () => {
    const factors = {
      ocr: 80,
      material: 50,
      image: 85,
      seller: 50,
      history: 50,
      market: 70,
      weight: 50,
      description: 55
    };
    const confidence = confidenceEngine.calculateConfidence(factors);
    expect(confidence.overallScore).toBeGreaterThanOrEqual(50);
    expect(confidence.overallScore).toBeLessThanOrEqual(80);
  });
});

describe('riskEngine', () => {
  it('evaluates low risk parameters', () => {
    const lowRiskFactors = {
      priceVolatility: 20,
      marketTrend: 'up' as const,
      sellerReliability: 95,
      ocrConfidence: 98,
      photoQuality: 92,
      historicalError: 5,
      inspectionAvailable: true,
      categoryRisk: 15,
      transportRisk: 10,
      environmentalRisk: 10
    };
    const lowRisk = riskEngine.calculateRisk(lowRiskFactors);
    expect(lowRisk.level).toBe('Low Risk');
  });

  it('evaluates high risk parameters', () => {
    const highRiskFactors = {
      priceVolatility: 95,
      marketTrend: 'down' as const,
      sellerReliability: 10,
      ocrConfidence: 20,
      photoQuality: 10,
      historicalError: 85,
      inspectionAvailable: false,
      categoryRisk: 90,
      transportRisk: 95,
      environmentalRisk: 85
    };
    const highRisk = riskEngine.calculateRisk(highRiskFactors);
    expect(highRisk.level).toBe('High Risk');
    expect(highRisk.score).toBeGreaterThan(70);
  });
});

describe('recommendationEngine', () => {
  it('recommends Avoid (Low Margin) when ROI < 10%', () => {
    const rec = recommendationEngine.generateRecommendation({
      roiPercent: 5,
      riskLevel: 'Medium Risk',
      riskScore: 40,
      overallConfidence: 80,
      marketTrend: 'flat',
      currentBid: 50000,
      totalLotValue: 100000,
      sourceCount: 2
    });
    expect(rec.status).toBe('Avoid (Low Margin)');
  });

  it('recommends Avoid (Overpriced) when current bid >= total lot value', () => {
    const rec = recommendationEngine.generateRecommendation({
      roiPercent: -20,
      riskLevel: 'Medium Risk',
      riskScore: 45,
      overallConfidence: 85,
      marketTrend: 'flat',
      currentBid: 120000,
      totalLotValue: 100000,
      sourceCount: 2
    });
    expect(rec.status).toBe('Avoid (Overpriced)');
  });

  it('recommends Insufficient Data when lot value <= 0', () => {
    const rec = recommendationEngine.generateRecommendation({
      roiPercent: 0,
      riskLevel: 'Medium Risk',
      riskScore: 50,
      overallConfidence: 0,
      marketTrend: 'flat',
      currentBid: 0,
      totalLotValue: 0
    });
    expect(rec.status).toBe('Insufficient Data');
  });

  it('gates Strong Buy: downgrades to Buy if sourceCount < 2', () => {
    const recSingleSource = recommendationEngine.generateRecommendation({
      roiPercent: 45,
      riskLevel: 'Low Risk',
      riskScore: 20,
      overallConfidence: 75,
      marketTrend: 'flat',
      currentBid: 50000,
      totalLotValue: 100000,
      sourceCount: 1
    });
    expect(recSingleSource.status).toBe('Buy');
    expect(recSingleSource.reasoning[0]).toContain('downgraded from Strong Buy due to single market source');

    const recMultiSource = recommendationEngine.generateRecommendation({
      roiPercent: 45,
      riskLevel: 'Low Risk',
      riskScore: 20,
      overallConfidence: 75,
      marketTrend: 'flat',
      currentBid: 50000,
      totalLotValue: 100000,
      sourceCount: 2
    });
    expect(recMultiSource.status).toBe('Strong Buy');
  });

  it('gates Buy: downgrades to Watch if overallConfidence < 55%', () => {
    const recLowConfidence = recommendationEngine.generateRecommendation({
      roiPercent: 25,
      riskLevel: 'Medium Risk',
      riskScore: 40,
      overallConfidence: 50,
      marketTrend: 'flat',
      currentBid: 50000,
      totalLotValue: 100000,
      sourceCount: 1
    });
    expect(recLowConfidence.status).toBe('Watch');
    expect(recLowConfidence.reasoning[0]).toContain('downgraded to Watch due to limited data verifiability');
  });
});

describe('marketEngine (honest 1-3 sources)', () => {
  it('returns honest source list with 1 baseline source for default commodities', () => {
    const res = marketEngine.resolvePriceSync('General Copper Cathode', 'Mumbai');
    expect(res.sources.length).toBeGreaterThanOrEqual(1);
    expect(res.sources[0].source).toBe('Admin Commodity Baseline');
    expect(res.weightedPrice).toBeGreaterThan(0);
    // 1 source caps confidence at 60%
    expect(res.confidence).toBeLessThanOrEqual(60);
  });
});

describe('biddingEngine', () => {
  it('returns 0 bids for data-poor / zero value lots', () => {
    const bids = biddingEngine.generateBidRecommendations(0, { currentBid: 0 });
    expect(bids.idealBid).toBe(0);
    expect(bids.maxBid).toBe(0);
    expect(bids.walkAwayPrice).toBe(0);
  });

  it('calculates maxBid targeting minAcceptableRoiPercent (10%)', () => {
    const bids = biddingEngine.generateBidRecommendations(100000, { currentBid: 0, gstPercent: 18, tcsPercent: 1 });
    expect(bids.maxBid).toBeGreaterThan(0);
    expect(bids.maxBid).toBeGreaterThan(bids.idealBid); // 10% ROI bid > 25% ROI bid
    expect(bids.idealBid).toBeGreaterThan(bids.conservativeBid); // 25% ROI bid > 40% ROI bid
  });
});

describe('simulationEngine', () => {
  it('runs Monte Carlo simulation without NaN outputs', () => {
    const sim = simulationEngine.runSimulation(750000, {
      currentBid: 500000,
      gstPercent: 18,
      tcsPercent: 1,
      transportation: 10000
    });
    expect(sim.expectedRoi).toBeGreaterThan(0);
    expect(sim.chanceOfProfit).toBeGreaterThan(50);
    expect(sim.bestRoi).toBeGreaterThan(sim.worstRoi);
  });
});

describe('MSTC Catalog Regression Suite', () => {
  it('prices Scrap Copper Wire correctly', async () => {
    const catalogItemA = [
      { sr: 1, description: 'Scrap Copper Wire purity 99% - Lot number 441', qty: '1200', unit: 'KG', marketPrice: '' }
    ];
    const costsA = { currentBid: 500000, gstPercent: 18, tcsPercent: 1, transportation: 20000, loading: 5000 };
    const valuationA = await roiEngine.calculateValuation(catalogItemA, costsA, true, 'Mumbai');

    expect(valuationA.totalLotValue).toBeGreaterThan(800000);
    expect(valuationA.roiPercent).toBeGreaterThan(0);
    expect(['Buy', 'Strong Buy', 'Watch']).toContain(valuationA.recommendation.status);
  });

  it('applies J&K regional discount for salvage bus', async () => {
    const catalogItemB = [
      { sr: 1, description: 'Condemned and salvage Tata School Bus', qty: '1', unit: 'Unit', marketPrice: '' }
    ];
    const costsB = { currentBid: 120000, gstPercent: 18, tcsPercent: 1, transportation: 45000, loading: 5000 };
    const valuationB = await roiEngine.calculateValuation(catalogItemB, costsB, false, 'Jammu & Kashmir');

    expect(valuationB.items[0].priceSource).toMatch(/J&K|logistics/);
  });

  it('marks unserviceable overpriced lot appropriately', async () => {
    const catalogItemC = [
      { sr: 1, description: 'Unserviceable and broken copper wire scrap sets', qty: '100', unit: 'KG' }
    ];
    const costsC = { currentBid: 200000, gstPercent: 18, tcsPercent: 1, transportation: 5000 };
    const valuationC = await roiEngine.calculateValuation(catalogItemC, costsC, false, 'Kolkata');

    expect(valuationC.recommendation.status).toMatch(/^Avoid/);
  });

  it('prices item with explicit market price override', async () => {
    const catalogItemF = [
      { sr: 1, description: 'SCRAP MOTOR PUMP SETS AND TRANSFORMERS LYING AT SITE', qty: '1', unit: 'LOT', marketPrice: '₹7,03,123' }
    ];
    const costsD = { currentBid: 1000, gstPercent: 18, tcsPercent: 1 };
    const valuationF = await roiEngine.calculateValuation(catalogItemF, costsD, false, 'Maharashtra');

    expect(valuationF.totalLotValue).toBe(703123);
    expect(valuationF.items[0].notAvailable).toBeFalsy();
  });
});

describe('Production Safety & NaN Resistance', () => {
  it('handles NaN/undefined/empty string input values gracefully', async () => {
    const rawItemsNaN = [
      { sr: NaN, description: 'Copper scrap wire', qty: 'NaN', unit: '', marketPrice: 'undefined' }
    ];
    const costsNaN = {
      currentBid: '' as any,
      gstPercent: NaN,
      tcsPercent: undefined as any,
      transportation: 'NaN' as any
    };
    const valuationNaN = await roiEngine.calculateValuation(rawItemsNaN, costsNaN, false, 'Delhi');

    expect(Number.isFinite(valuationNaN.totalLotValue)).toBeTruthy();
    expect(Number.isFinite(valuationNaN.totalCost)).toBeTruthy();
    expect(Number.isFinite(valuationNaN.estimatedProfit)).toBeTruthy();
    expect(Number.isFinite(valuationNaN.roiPercent)).toBeTruthy();
    expect(Number.isFinite(valuationNaN.breakEven)).toBeTruthy();
    expect(isNaN(valuationNaN.roiPercent)).toBeFalsy();
  });

  it('handles empty items array safely', async () => {
    const valuationEmpty = await roiEngine.calculateValuation([], { currentBid: 1000 }, false, 'Mumbai');
    expect(valuationEmpty.totalLotValue).toBe(0);
    expect(valuationEmpty.items).toHaveLength(0);
    expect(valuationEmpty.recommendation.status).toBe('Insufficient Data');
  });

  it('handles negative inputs safely', async () => {
    const rawItemsNegative = [
      { sr: -1, description: 'Copper wire', qty: '-10', unit: 'KG' }
    ];
    const costsNegative = {
      currentBid: -50000,
      gstPercent: -18,
      tcsPercent: -1,
      transportation: -1000
    };
    const valuationNegative = await roiEngine.calculateValuation(rawItemsNegative, costsNegative, false, 'Mumbai');

    expect(valuationNegative.costs.currentBid).toBe(0);
    expect(valuationNegative.totalCost).toBeGreaterThanOrEqual(0);
    expect(valuationNegative.roiPercent).toBe(0);
  });
});

