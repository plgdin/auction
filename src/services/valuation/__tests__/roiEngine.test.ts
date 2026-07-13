import { roiEngine } from '../roiEngine';
import { currencyEngine } from '../currencyEngine';
import { costEngine } from '../costEngine';
import { confidenceEngine } from '../confidenceEngine';
import { riskEngine } from '../riskEngine';
import { recommendationEngine } from '../recommendationEngine';
import { simulationEngine } from '../simulationEngine';

// Assert helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`  ✓ Passed: ${message}`);
}

export async function runRoiEngineTests(): Promise<boolean> {
  let success = true;

  // 1. Cost & Tax Engine Unit Tests
  console.log('\n--- Running Cost & Tax Engine Tests ---');
  try {
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
    
    // Assert GST is 18% of bid (1,000,000 * 0.18 = 180,000)
    assert(calculated.gstAmount === 180000, `GST amount should be 180,000, got ${calculated.gstAmount}`);

    // Assert TCS is 1% of (Bid + GST) = 1,180,000 * 0.01 = 11,800
    assert(calculated.tcsAmount === 11800, `TCS amount should be 11,800, got ${calculated.tcsAmount}`);

    // Assert other expenses sum is 20,000
    assert(calculated.otherExpenses === 20000, `Other expenses should be 20,000, got ${calculated.otherExpenses}`);

    // Assert total cost is 1,000,000 + 180,000 + 11,800 + 20,000 = 1,211,800
    assert(calculated.totalCost === 1211800, `Total cost should be 1,211,800, got ${calculated.totalCost}`);

  } catch (err: any) {
    console.error('Cost Engine Unit Tests Failed:', err.message);
    success = false;
  }

  // 2. Break-Even Unit Tests (True Mathematical Break-Even)
  console.log('\n--- Running Break-Even Mathematical Tests ---');
  try {
    const costsInput = {
      currentBid: 0, // not used in break-even math itself
      gstPercent: 18,
      tcsPercent: 1,
      transportation: 80000,
      loading: 20000
    };
    const totalLotValue = 1500000;

    const breakEvenBid = costEngine.calculateBreakEven(totalLotValue, costsInput);

    // Verify break-even bid:
    // (1,500,000 lot value - 100,000 other expenses) / (1 + 0.18 + 0.01 + 0.18*0.01)
    // = 1,400,000 / 1.1918 = 1,174,694
    assert(breakEvenBid === 1174694, `Break-even bid should be 1,174,694, got ${breakEvenBid}`);

    // Verify that at break-even bid, total cost equals total lot value
    const calculatedCostsAtBreakEven = costEngine.calculateCosts({
      ...costsInput,
      currentBid: breakEvenBid
    });
    assert(calculatedCostsAtBreakEven.totalCost === totalLotValue, `Total cost at break-even (${calculatedCostsAtBreakEven.totalCost}) should equal lot value (${totalLotValue})`);

  } catch (err: any) {
    console.error('Break-Even Unit Tests Failed:', err.message);
    success = false;
  }

  // 3. Currency Conversion Engine Tests
  console.log('\n--- Running Currency Engine Tests ---');
  try {
    // USD to INR: 100 USD * 85 = 8,500 INR
    const inrValue = currencyEngine.convert(100, 'USD', 'INR');
    assert(inrValue === 8500, `100 USD to INR should be 8,500, got ${inrValue}`);

    // INR to GBP: 108,000 INR / 108 = 1,000 GBP
    const gbpValue = currencyEngine.convert(108000, 'INR', 'GBP');
    assert(gbpValue === 1000, `108,000 INR to GBP should be 1,000, got ${gbpValue}`);
  } catch (err: any) {
    console.error('Currency Engine Unit Tests Failed:', err.message);
    success = false;
  }

  // 4. Confidence Engine Unit Tests
  console.log('\n--- Running Confidence Engine Tests ---');
  try {
    const factors = {
      ocr: 98,
      material: 100,
      image: 92,
      seller: 85,
      history: 72,
      market: 89
    };
    const confidence = confidenceEngine.calculateConfidence(factors);
    // Weighted confidence should be around 89 (example calculation in request)
    assert(confidence.overallScore >= 80 && confidence.overallScore <= 95, `Overall confidence should be around 89, got ${confidence.overallScore}`);
  } catch (err: any) {
    console.error('Confidence Engine Unit Tests Failed:', err.message);
    success = false;
  }

  // 5. Risk Engine Unit Tests
  console.log('\n--- Running Risk Engine Tests ---');
  try {
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
    assert(lowRisk.level === 'Low Risk', `Risk level should be 'Low Risk', got ${lowRisk.level}`);

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
    assert(highRisk.level === 'High Risk', `Risk level should be 'High Risk', got ${highRisk.level}`);
    assert(highRisk.score > 70, `High risk score should be >70, got ${highRisk.score}`);
  } catch (err: any) {
    console.error('Risk Engine Unit Tests Failed:', err.message);
    success = false;
  }

  // 6. Recommendation Engine Unit Tests
  console.log('\n--- Running Recommendation Engine Tests ---');
  try {
    // Avoid Low Margin
    const rec1 = recommendationEngine.generateRecommendation({
      roiPercent: 5,
      riskLevel: 'Medium Risk',
      riskScore: 40,
      overallConfidence: 80,
      marketTrend: 'flat',
      currentBid: 50000,
      totalLotValue: 100000
    });
    assert(rec1.status === 'Avoid (Low Margin)', `Rec status should be 'Avoid (Low Margin)', got ${rec1.status}`);

    // Avoid Overpriced
    const rec2 = recommendationEngine.generateRecommendation({
      roiPercent: -20,
      riskLevel: 'Medium Risk',
      riskScore: 45,
      overallConfidence: 85,
      marketTrend: 'flat',
      currentBid: 120000,
      totalLotValue: 100000
    });
    assert(rec2.status === 'Avoid (Overpriced)', `Rec status should be 'Avoid (Overpriced)', got ${rec2.status}`);

    // Strong Buy
    const rec3 = recommendationEngine.generateRecommendation({
      roiPercent: 45,
      riskLevel: 'Low Risk',
      riskScore: 20,
      overallConfidence: 90,
      marketTrend: 'flat',
      currentBid: 50000,
      totalLotValue: 100000
    });
    assert(rec3.status === 'Strong Buy', `Rec status should be 'Strong Buy', got ${rec3.status}`);
  } catch (err: any) {
    console.error('Recommendation Engine Unit Tests Failed:', err.message);
    success = false;
  }

  // 7. Simulation Engine Unit Tests
  console.log('\n--- Running Simulation Engine Tests ---');
  try {
    const costsInput = {
      currentBid: 500000,
      gstPercent: 18,
      tcsPercent: 1,
      transportation: 10000,
      refurbishment: 5000
    };
    const totalLotValue = 750000;

    const sim = simulationEngine.runSimulation(totalLotValue, costsInput);
    assert(sim.expectedRoi > 0, `Expected simulated ROI should be positive, got ${sim.expectedRoi}%`);
    assert(sim.chanceOfProfit > 50, `Chance of profit should be high, got ${sim.chanceOfProfit}%`);
    assert(sim.bestRoi > sim.worstRoi, `Best ROI (${sim.bestRoi}%) must exceed worst ROI (${sim.worstRoi}%)`);
  } catch (err: any) {
    console.error('Simulation Engine Unit Tests Failed:', err.message);
    success = false;
  }

  // 8. MSTC Catalog Regression Tests using realistic auction listings
  console.log('\n--- Running MSTC Catalog Regression Tests ---');
  try {
    // Catalog Item A: Scrap Copper Wire listing
    const catalogItemA = [
      {
        sr: 1,
        description: 'Scrap Copper Wire purity 99% - Lot number 441',
        qty: '1200',
        unit: 'KG',
        marketPrice: ''
      }
    ];
    const costsA = {
      currentBid: 500000,
      gstPercent: 18,
      tcsPercent: 1,
      transportation: 20000,
      loading: 5000
    };
    const valuationA = await roiEngine.calculateValuation(catalogItemA, costsA, true, 'Mumbai');

    // Scrap copper should match copper commodity, price around 700-800 INR/KG, total lot value around 900,000 INR
    assert(valuationA.totalLotValue > 800000, `Copper lot value should be > 800,000 INR, got ${valuationA.totalLotValue}`);
    assert(valuationA.roiPercent > 0, `Copper lot should have positive ROI, got ${valuationA.roiPercent}%`);
    assert(valuationA.recommendation.status === 'Buy' || valuationA.recommendation.status === 'Strong Buy', `Copper rec should be Buy/Strong Buy, got ${valuationA.recommendation.status}`);

    // Catalog Item B: Vehicle Salvage bus list (forestry region logistics discount)
    const catalogItemB = [
      {
        sr: 1,
        description: 'Condemned and salvage Tata School Bus',
        qty: '1',
        unit: 'Unit',
        marketPrice: ''
      }
    ];
    const costsB = {
      currentBid: 120000,
      gstPercent: 18,
      tcsPercent: 1,
      transportation: 45000, // high transport cost in Jammu
      loading: 5000
    };
    const valuationB = await roiEngine.calculateValuation(catalogItemB, costsB, false, 'Jammu & Kashmir');

    // Salvage Bus should match vehicle / heavy vehicle, have J&K 10% region logistics discount
    assert(!!(valuationB.items[0].priceSource?.includes('J&K') || valuationB.items[0].priceSource?.includes('logistics')), 'Logistics discount reason should be listed in price source');

    // Catalog Item C: Unserviceable Electronics scrap (Avoid recommendation test)
    const catalogItemC = [
      {
        sr: 1,
        description: 'Unserviceable and broken television scrap sets',
        qty: '10',
        unit: 'Units'
      }
    ];
    const costsC = {
      currentBid: 200000, // overpriced for scrap tvs
      gstPercent: 18,
      tcsPercent: 1,
      transportation: 5000
    };
    const valuationC = await roiEngine.calculateValuation(catalogItemC, costsC, false, 'Kolkata');

    // Should yield High Risk or Avoid due to unserviceable and overpriced parameters
    assert(valuationC.recommendation.status.startsWith('Avoid'), `Electronics scrap recommendation should be 'Avoid', got ${valuationC.recommendation.status}`);

  } catch (err: any) {
    console.error('Catalog Regression Tests Failed:', err.message);
    success = false;
  }

  return success;
}
