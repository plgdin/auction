import type { ValuationCosts } from './types';
import { TAX_CONFIG } from './roiConfig';
import { safeNumber, safePositive, safeRound, safeDivide } from './inputValidator';

export const costEngine = {
  /**
   * Calculates individual tax amounts and the total cost structure.
   * All inputs are sanitized — never produces NaN or Infinity.
   */
  calculateCosts(costs: ValuationCosts): {
    totalCost: number;
    gstAmount: number;
    tcsAmount: number;
    otherExpenses: number;
    breakdown: Record<string, number>;
  } {
    const currentBid = safePositive(costs.currentBid);
    const gstPercent = safeNumber(costs.gstPercent, TAX_CONFIG.defaultGstPercent);
    const tcsPercent = safeNumber(costs.tcsPercent, TAX_CONFIG.defaultTcsPercent);

    // Calculate GST
    const gstAmount = safeRound(currentBid * (gstPercent / 100));

    // TCS is collected on purchase value inclusive of GST in Indian auctions
    const tcsAmount = safeRound((currentBid + gstAmount) * (tcsPercent / 100));

    // Sum other expenses — each field is safely coerced
    const transportation = safePositive(costs.transportation);
    const loading = safePositive(costs.loading);
    const unloading = safePositive(costs.unloading);
    const warehouse = safePositive(costs.warehouse);
    const storage = safePositive(costs.storage);
    const insurance = safePositive(costs.insurance);
    const interest = safePositive(costs.interest);
    const opportunityCost = safePositive(costs.opportunityCost);
    const repair = safePositive(costs.repair);
    const fuel = safePositive(costs.fuel);
    const customDuty = safePositive(costs.customDuty);
    const labour = safePositive(costs.labour);
    const shrinkage = safePositive(costs.shrinkage);
    const processingLoss = safePositive(costs.processingLoss);
    const miscellaneous = safePositive(costs.miscellaneous);
    const contingency = safePositive(costs.contingency);
    const auctionFee = safePositive(costs.auctionFee);
    const emdCost = safePositive(costs.emdCost);
    
    // Backwards compatibility with refurbishment / extraCharge / otherFees / loadingUnloading
    const refurbishment = safePositive(costs.refurbishment);
    const extraCharge = safePositive(costs.extraCharge);
    const otherFees = safePositive(costs.otherFees);
    const loadingUnloading = safePositive(costs.loadingUnloading);

    const otherExpenses = safeRound(
      transportation +
      loading +
      unloading +
      loadingUnloading +
      warehouse +
      storage +
      insurance +
      interest +
      opportunityCost +
      repair +
      fuel +
      customDuty +
      labour +
      shrinkage +
      processingLoss +
      miscellaneous +
      contingency +
      auctionFee +
      emdCost +
      refurbishment +
      extraCharge +
      otherFees
    );

    const totalCost = safeRound(currentBid + gstAmount + tcsAmount + otherExpenses);

    const breakdown: Record<string, number> = {
      currentBid,
      gstAmount,
      tcsAmount,
      transportation,
      loading,
      unloading,
      warehouse,
      storage,
      insurance,
      interest,
      opportunityCost,
      repair,
      fuel,
      customDuty,
      labour,
      shrinkage,
      processingLoss,
      miscellaneous,
      contingency,
      auctionFee,
      emdCost,
      refurbishment,
      extraCharge,
      otherFees
    };

    return {
      totalCost,
      gstAmount,
      tcsAmount,
      otherExpenses,
      breakdown
    };
  },

  /**
   * Computes the true mathematical break-even bid price.
   * Formula: Bid_be = (Total Lot Value - Other Expenses) / (1 + gstRate + tcsRate + gstRate * tcsRate)
   * Returns 0 if lot value cannot cover expenses.
   */
  calculateBreakEven(totalLotValue: number, costs: ValuationCosts): number {
    const gstPercent = safeNumber(costs.gstPercent, TAX_CONFIG.defaultGstPercent);
    const tcsPercent = safeNumber(costs.tcsPercent, TAX_CONFIG.defaultTcsPercent);

    const gstRate = gstPercent / 100;
    const tcsRate = tcsPercent / 100;

    const gstTcsMultiplier = 1 + gstRate + tcsRate + (gstRate * tcsRate);

    const { otherExpenses } = this.calculateCosts(costs);

    if (totalLotValue <= otherExpenses) {
      return 0;
    }

    const breakEvenBid = safeDivide(totalLotValue - otherExpenses, gstTcsMultiplier, 0);
    return safeRound(Math.max(0, breakEvenBid));
  }
};

