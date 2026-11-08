import type { Offer } from "./types";

/**
 * Seller-side money logic. Every figure on the sell page and seller dashboard
 * must come from these helpers so the demo never shows invented numbers.
 *
 * Marketplace and offer sales carry no commission: the seller pockets the
 * asking price. Live auctions guarantee the asking price; commission is taken
 * only on the overage when a winning bid clears it (see store.computeAuctionSettlement).
 */

export function timeLeftLabel(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "expired";
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours <= 48) return `~${hours}h left`;
  return `~${Math.ceil(hours / 24)}d left`;
}

/** Human share of the asking price an offer represents, e.g. "83% of asking". */
export function offerShareOfAsking(offer: Pick<Offer, "amount">, askingPrice: number): number {
  if (!askingPrice) return 0;
  return Math.round((offer.amount / askingPrice) * 100);
}

/** Flat platform charge per product sold, disclosed on every seller-facing money surface. */
export const PLATFORM_CHARGE_PAISE = 1_000;

/** Settlement sellerPayout already stores the amount after platform charges. */
export function netPayout(sellerPayout: number): number {
  return Math.max(0, sellerPayout);
}

/** Starting price for a scheduled auction: asking price scaled by the platform percentage. */
export function auctionStartingPrice(askingPrice: number, startPct: number): number {
  return Math.max(100, Math.round((askingPrice * startPct) / 100 / 100) * 100);
}
