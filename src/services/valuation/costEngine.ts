import type { ValuationCosts } from './types';
import { TAX_CONFIG } from './roiConfig';

export const costEngine = {
  /**
   * Calculates individual tax amounts and the total cost structure
   */
  calculateCosts(costs: ValuationCosts): {
    totalCost: number;
    gstAmount: number;
    tcsAmount: number;
    otherExpenses: number;
    breakdown: Record<string, number>;
  } {
    const currentBid = costs.currentBid || 0;
    const gstPercent = costs.gstPercent !== undefined ? costs.gstPercent : TAX_CONFIG.defaultGstPercent;
    const tcsPercent = costs.tcsPercent !== undefined ? costs.tcsPercent : TAX_CONFIG.defaultTcsPercent;

    // Calculate GST
    const gstAmount = Math.round(currentBid * (gstPercent / 100));

    // TCS is collected on purchase value inclusive of GST in Indian auctions
    const tcsAmount = Math.round((currentBid + gstAmount) * (tcsPercent / 100));

    // Sum other expenses
    const transportation = costs.transportation || 0;
    const loading = costs.loading || 0;
    const unloading = costs.unloading || 0;
    const warehouse = costs.warehouse || 0;
    const storage = costs.storage || 0;
    const insurance = costs.insurance || 0;
    const interest = costs.interest || 0;
    const opportunityCost = costs.opportunityCost || 0;
    const repair = costs.repair || 0;
    const fuel = costs.fuel || 0;
    const customDuty = costs.customDuty || 0;
    const labour = costs.labour || 0;
    const shrinkage = costs.shrinkage || 0;
    const processingLoss = costs.processingLoss || 0;
    const miscellaneous = costs.miscellaneous || 0;
    const contingency = costs.contingency || 0;
    const auctionFee = costs.auctionFee || 0;
    const emdCost = costs.emdCost || 0;
    
    // Backwards compatibility with refurbishment / extraCharge / otherFees
    const refurbishment = costs.refurbishment || 0;
    const extraCharge = costs.extraCharge || 0;
    const otherFees = costs.otherFees || 0;

    const otherExpenses = Math.round(
      transportation +
      loading +
      unloading +
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

    const totalCost = Math.round(currentBid + gstAmount + tcsAmount + otherExpenses);

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
   * Computes the true mathematical break-even bid price
   * Bid_be + GST_be + TCS_be + Other Expenses = Total Lot Value
   * Bid_be * (1 + gstRate + tcsRate + gstRate * tcsRate) + Other Expenses = Total Lot Value
   * Bid_be = (Total Lot Value - Other Expenses) / (1 + gstRate + tcsRate + gstRate * tcsRate)
   */
  calculateBreakEven(totalLotValue: number, costs: ValuationCosts): number {
    const gstPercent = costs.gstPercent !== undefined ? costs.gstPercent : TAX_CONFIG.defaultGstPercent;
    const tcsPercent = costs.tcsPercent !== undefined ? costs.tcsPercent : TAX_CONFIG.defaultTcsPercent;

    const gstRate = gstPercent / 100;
    const tcsRate = tcsPercent / 100;

    const gstTcsMultiplier = 1 + gstRate + tcsRate + (gstRate * tcsRate);

    const { otherExpenses } = this.calculateCosts(costs);

    if (totalLotValue <= otherExpenses) {
      return 0;
    }

    const breakEvenBid = (totalLotValue - otherExpenses) / gstTcsMultiplier;
    return Math.round(Math.max(0, breakEvenBid));
  }
};
