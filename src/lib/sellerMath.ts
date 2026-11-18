import type { Offer, SellerTier } from "./types";

/**
 * Seller-side money logic.
 * Flat 10% seller commission on sale price (GST inclusive).
 * Buyer platform fee: ₹10 (1000 paise) + 18% GST (180 paise) charged at checkout.
 */

export const SELLER_COMMISSION_PERCENT = 10;
export const SELLER_COMMISSION_PERCENT_NORMAL = 10;
export const SELLER_COMMISSION_PERCENT_VERIFIED = 5;
export const BUYER_PLATFORM_FEE_PAISE = 1_000;
export const PLATFORM_FEE_GST_PERCENT = 18;

/** GST charged on the buyer platform fee, rounded to nearest paise. */
export function platformFeeGst(platformFeePaise: number): number {
  return Math.round(Math.max(0, platformFeePaise) * (PLATFORM_FEE_GST_PERCENT / 100));
}

/** Total buyer platform fee including 18% GST. */
export function buyerPlatformFeeTotal(platformFeePaise: number): number {
  return Math.max(0, platformFeePaise) + platformFeeGst(platformFeePaise);
}

export function sellerCommissionPercent(tier?: SellerTier): number {
  return tier === "verified"
    ? SELLER_COMMISSION_PERCENT_VERIFIED
    : SELLER_COMMISSION_PERCENT_NORMAL;
}

export function sellerCommission(amount: number, tier?: SellerTier): number {
  return Math.round(Math.max(0, amount) * (sellerCommissionPercent(tier) / 100));
}

export function sellerNetPayout(amount: number, tier?: SellerTier): number {
  return Math.max(0, amount - sellerCommission(amount, tier));
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

/** Tiered minimum increment in paise for the current bid level. */
export function auctionIncrement(amountPaise: number): number {
  if (amountPaise < 100000) return 5000;
  if (amountPaise < 500000) return 10000;
  if (amountPaise < 2000000) return 25000;
  return 50000;
}

/** Starting price for a scheduled auction: max(₹199, round to ₹50 of asking × pct). */
export function auctionStartingPrice(askingPrice: number, startPct: number): number {
  const raw = Math.round((askingPrice * startPct) / 100);
  const rounded = Math.round(raw / 5000) * 5000;
  return Math.max(19900, rounded);
}
