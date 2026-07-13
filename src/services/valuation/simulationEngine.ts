import type { ValuationCosts } from './types';
import { SIMULATION_CONFIG } from './roiConfig';
import { costEngine } from './costEngine';

export interface ValuationSimulation {
  expectedRoi: number;
  worstRoi: number;
  bestRoi: number;
  chanceOfProfit: number; // 0 to 100
}

export const simulationEngine = {
  /**
   * Runs a Monte Carlo simulation (5000 iterations) to predict ROI distribution under variance
   */
  runSimulation(
    totalLotValue: number,
    costs: ValuationCosts
  ): ValuationSimulation {
    const iterations = SIMULATION_CONFIG.iterations || 1000;
    
    const simulatedRois: number[] = [];
    let profitCount = 0;

    const baseCostsInfo = costEngine.calculateCosts(costs);
    const currentBid = costs.currentBid || 0;
    const gstPercent = costs.gstPercent !== undefined ? costs.gstPercent : 18;
    const tcsPercent = costs.tcsPercent !== undefined ? costs.tcsPercent : 1;

    // Fixed costs that do not vary
    const gstAmount = Math.round(currentBid * (gstPercent / 100));
    const tcsAmount = Math.round((currentBid + gstAmount) * (tcsPercent / 100));
    const fixedCostsSum = currentBid + gstAmount + tcsAmount;

    // Variable cost components
    const transport = costs.transportation || 0;
    const refurbishment = costs.refurbishment || 0;
    const otherExpensesExcludingVar = Math.round(
      baseCostsInfo.otherExpenses - transport - refurbishment
    );

    for (let i = 0; i < iterations; i++) {
      // 1. Vary Item/Lot Valuation (Weight variance and Commodity price volatility)
      // Weight variance: +/- 5%
      const weightFactor = 1 + (Math.random() - 0.5) * (SIMULATION_CONFIG.weightVariancePercent * 2);
      // Commodity Price variance: +/- 10%
      const priceFactor = 1 + (Math.random() - 0.5) * (SIMULATION_CONFIG.marketPriceVolatilityPercent * 2);
      const simulatedLotValue = totalLotValue * weightFactor * priceFactor;

      // 2. Vary Costs (Transport varies by +15%/-5%, Recovery/refurbishment varies by +/- 10%)
      const transportFactor = 1 - 0.05 + Math.random() * (SIMULATION_CONFIG.transportCostVariancePercent);
      const simulatedTransport = transport * transportFactor;

      const refurbFactor = 1 + (Math.random() - 0.5) * (SIMULATION_CONFIG.recoveryRateVariancePercent * 2);
      const simulatedRefurb = refurbishment * refurbFactor;

      const simulatedTotalCost = Math.round(
        fixedCostsSum +
        otherExpensesExcludingVar +
        simulatedTransport +
        simulatedRefurb
      );

      const simulatedProfit = simulatedLotValue - simulatedTotalCost;
      const simulatedRoi = simulatedTotalCost > 0 ? (simulatedProfit / simulatedTotalCost) * 100 : 0;

      simulatedRois.push(simulatedRoi);
      if (simulatedProfit > 0) {
        profitCount++;
      }
    }

    // Sort to calculate percentiles
    simulatedRois.sort((a, b) => a - b);

    const sum = simulatedRois.reduce((acc, r) => acc + r, 0);
    const expectedRoi = Math.round(sum / iterations);

    // 5th percentile as worst case, 95th percentile as best case
    const worstIdx = Math.floor(iterations * 0.05);
    const bestIdx = Math.floor(iterations * 0.95);

    const worstRoi = Math.round(simulatedRois[worstIdx]);
    const bestRoi = Math.round(simulatedRois[bestIdx]);

    const chanceOfProfit = Math.round((profitCount / iterations) * 100);

    return {
      expectedRoi,
      worstRoi,
      bestRoi,
      chanceOfProfit,
    };
  }
};
