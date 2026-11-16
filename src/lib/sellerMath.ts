import type { Offer } from "./types";

/**
 * Seller-side money logic. Every figure on the sell page and seller dashboard
 * must come from these helpers so the demo never shows invented numbers.
 *
 * Seller commission applies to the full sale amount on marketplace, offer,
 * and auction sales. Buyer platform fee is separate and charged once at checkout.
 */

export const SELLER_COMMISSION_PERCENT = 10;
export const BUYER_PLATFORM_FEE_PAISE = 1_000;

export function sellerCommission(amount: number): number {
  return Math.round(Math.max(0, amount) * (SELLER_COMMISSION_PERCENT / 100));
}

export function sellerNetPayout(amount: number): number {
  return Math.max(0, amount - sellerCommission(amount));
}

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

/** Settlement sellerPayout already stores the amount after seller commission. */
export function netPayout(sellerPayout: number): number {
  return Math.max(0, sellerPayout);
}

/** Starting price for a scheduled auction: asking price scaled by the platform percentage. */
export function auctionStartingPrice(askingPrice: number, startPct: number): number {
  return Math.max(100, Math.round((askingPrice * startPct) / 100 / 100) * 100);
}
