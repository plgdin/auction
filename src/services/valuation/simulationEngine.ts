import type { ValuationCosts } from './types';
import { SIMULATION_CONFIG } from './roiConfig';
import { costEngine } from './costEngine';
import { safePositive, safeRound, safeDivide } from './inputValidator';

export interface ValuationSimulation {
  expectedRoi: number;
  worstRoi: number;
  bestRoi: number;
  chanceOfProfit: number; // 0 to 100
}

export const simulationEngine = {
  /**
   * Runs a Monte Carlo simulation to predict ROI distribution under variance.
   * Varies lot valuation (weight + price), transport, refurbishment, loading, unloading, and labour.
   * All arithmetic is NaN-safe — never produces NaN/Infinity in output.
   */
  runSimulation(
    totalLotValue: number,
    costs: ValuationCosts
  ): ValuationSimulation {
    const iterations = SIMULATION_CONFIG.iterations || 1000;
    
    const simulatedRois: number[] = [];
    let profitCount = 0;

    const baseCostsInfo = costEngine.calculateCosts(costs);
    const currentBid = safePositive(costs.currentBid);
    const gstPercent = costs.gstPercent !== undefined ? costs.gstPercent : 18;
    const tcsPercent = costs.tcsPercent !== undefined ? costs.tcsPercent : 1;

    // Fixed costs that do not vary
    const gstAmount = safeRound(currentBid * (gstPercent / 100));
    const tcsAmount = safeRound((currentBid + gstAmount) * (tcsPercent / 100));
    const fixedCostsSum = currentBid + gstAmount + tcsAmount;

    // Variable cost components — expanded set for realistic simulation
    const transport = safePositive(costs.transportation);
    const refurbishment = safePositive(costs.refurbishment);
    const loading = safePositive(costs.loading);
    const unloading = safePositive(costs.unloading);
    const labour = safePositive(costs.labour);
    const variableCostsSum = transport + refurbishment + loading + unloading + labour;

    // Remaining other expenses that we treat as fixed
    const otherExpensesExcludingVar = Math.max(0, safeRound(
      baseCostsInfo.otherExpenses - variableCostsSum
    ));

    // Cap for extreme outlier ROI values (prevent a single wildly skewed simulation from corrupting percentiles)
    const ROI_CAP = 500;
    const ROI_FLOOR = -100;

    for (let i = 0; i < iterations; i++) {
      // 1. Vary Item/Lot Valuation (Weight variance and Commodity price volatility)
      const weightFactor = 1 + (Math.random() - 0.5) * (SIMULATION_CONFIG.weightVariancePercent * 2);
      const priceFactor = 1 + (Math.random() - 0.5) * (SIMULATION_CONFIG.marketPriceVolatilityPercent * 2);
      const simulatedLotValue = totalLotValue * weightFactor * priceFactor;

      // 2. Vary Costs — each variable component gets its own variance
      const transportFactor = 1 - 0.05 + Math.random() * (SIMULATION_CONFIG.transportCostVariancePercent);
      const simulatedTransport = transport * transportFactor;

      const refurbFactor = 1 + (Math.random() - 0.5) * (SIMULATION_CONFIG.recoveryRateVariancePercent * 2);
      const simulatedRefurb = refurbishment * refurbFactor;

      // Loading/unloading/labour vary by ±10%
      const loadingFactor = 1 + (Math.random() - 0.5) * 0.20;
      const simulatedLoading = loading * loadingFactor;

      const unloadingFactor = 1 + (Math.random() - 0.5) * 0.20;
      const simulatedUnloading = unloading * unloadingFactor;

      const labourFactor = 1 + (Math.random() - 0.5) * 0.20;
      const simulatedLabour = labour * labourFactor;

      const simulatedTotalCost = safeRound(
        fixedCostsSum +
        otherExpensesExcludingVar +
        simulatedTransport +
        simulatedRefurb +
        simulatedLoading +
        simulatedUnloading +
        simulatedLabour
      );

      const simulatedProfit = simulatedLotValue - simulatedTotalCost;
      let simulatedRoi = safeDivide(simulatedProfit, simulatedTotalCost, 0) * 100;

      // Cap extreme outliers
      simulatedRoi = Math.max(ROI_FLOOR, Math.min(ROI_CAP, simulatedRoi));

      simulatedRois.push(simulatedRoi);
      if (simulatedProfit > 0) {
        profitCount++;
      }
    }

    // Sort to calculate percentiles
    simulatedRois.sort((a, b) => a - b);

    const sum = simulatedRois.reduce((acc, r) => acc + r, 0);
    const expectedRoi = safeRound(safeDivide(sum, iterations, 0));

    // 5th percentile as worst case, 95th percentile as best case
    const worstIdx = Math.floor(iterations * 0.05);
    const bestIdx = Math.min(Math.floor(iterations * 0.95), iterations - 1);

    const worstRoi = safeRound(simulatedRois[worstIdx] ?? 0);
    const bestRoi = safeRound(simulatedRois[bestIdx] ?? 0);

    const chanceOfProfit = safeRound(safeDivide(profitCount, iterations, 0) * 100);

    return {
      expectedRoi,
      worstRoi,
      bestRoi,
      chanceOfProfit,
    };
  }
};

