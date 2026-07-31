import type { ValuationCosts } from './types';
import { BID_MARGINS } from './roiConfig';
import { costEngine } from './costEngine';
import { safeRound, safeDivide } from './inputValidator';

export interface ValuationBidding {
  idealBid: number;
  maxBid: number;
  walkAwayPrice: number;
  conservativeBid: number;
  aggressiveBid: number;
}

export const biddingEngine = {
  /**
   * Generates bid levels targeting specific ROIs based on lot value and other expenses.
   * Formula: Bid = ( (LotValue / (1 + ROI/100)) - OtherExpenses ) / taxMultiplier
   * All outputs are guaranteed to be non-negative finite integers.
   */
  generateBidRecommendations(totalLotValue: number, costs: ValuationCosts): ValuationBidding {
    const gstPercent = costs.gstPercent !== undefined ? costs.gstPercent : 18;
    const tcsPercent = costs.tcsPercent !== undefined ? costs.tcsPercent : 1;

    const gstRate = gstPercent / 100;
    const tcsRate = tcsPercent / 100;
    const taxMultiplier = 1 + gstRate + tcsRate + (gstRate * tcsRate);

    // Calculate other expenses (excluding bid and taxes)
    const { otherExpenses } = costEngine.calculateCosts(costs);

    const currentBid = Number(costs.currentBid) || 0;
    const isDataPoor = totalLotValue <= 0;
    const effectiveLotValue = isDataPoor ? (currentBid * taxMultiplier + otherExpenses) : totalLotValue;

    const calculateBidForRoi = (targetRoi: number): number => {
      // Expenses exceed lot value (and it's not a data-poor fallback case)
      if (effectiveLotValue <= 0 || (!isDataPoor && effectiveLotValue <= otherExpenses)) {
        return 0;
      }
      const roiDivisor = 1 + targetRoi / 100;
      const costLimit = safeDivide(effectiveLotValue, roiDivisor, effectiveLotValue);
      const bid = safeDivide(costLimit - otherExpenses, taxMultiplier, 0);
      return safeRound(Math.max(0, bid));
    };

    // Generate specific target bids
    const walkAwayPrice = calculateBidForRoi(0); // Break-even (0% ROI)
    const maxBid = calculateBidForRoi(BID_MARGINS.minAcceptableRoiPercent); // Maximum bid to secure at least 10% minimum target ROI
    const idealBid = calculateBidForRoi(BID_MARGINS.idealRoiPercent); // Bid for 25% target ROI
    const conservativeBid = calculateBidForRoi(BID_MARGINS.conservativeRoiPercent); // Bid for 40% target ROI
    const aggressiveBid = calculateBidForRoi(BID_MARGINS.aggressiveRoiPercent); // Bid for 15% target ROI

    return {
      idealBid,
      maxBid,
      walkAwayPrice,
      conservativeBid,
      aggressiveBid,
    };
  }
};

