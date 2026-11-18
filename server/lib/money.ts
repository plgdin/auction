/** All monetary values are integer paise. */
export function computeAuctionSettlement(
  _askingPricePaise: number,
  winningBidPaise: number,
  commissionPct = 10,
) {
  // Seller commission is 10% of the full winning bid (GST inclusive),
  // rounded down to paise. Bids below asking are not subsidised by the platform.
  const commission = Math.floor((winningBidPaise * commissionPct) / 100);
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
