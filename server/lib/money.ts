/** All monetary values are integer paise. */
export function computeAuctionSettlement(
  askingPricePaise: number,
  winningBidPaise: number,
  commissionPct = 5,
) {
  if (winningBidPaise < askingPricePaise) {
    return {
      sellerPayoutPaise: askingPricePaise,
      platformSubsidyPaise: askingPricePaise - winningBidPaise,
      platformCommissionPaise: 0,
    };
  }
  if (winningBidPaise === askingPricePaise) {
    return {
      sellerPayoutPaise: askingPricePaise,
      platformSubsidyPaise: 0,
      platformCommissionPaise: 0,
    };
  }
  const excess = winningBidPaise - askingPricePaise;
  const commission = Math.floor((excess * commissionPct) / 100);
  return {
    sellerPayoutPaise: winningBidPaise - commission,
    platformSubsidyPaise: 0,
    platformCommissionPaise: commission,
  };
}

export function calculateStartingPrice(askingPricePaise: number, pct: number) {
  const raw = Math.floor((askingPricePaise * pct) / 100);
  return Math.max(100, Math.round(raw / 100) * 100);
}

export function formatPaise(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
