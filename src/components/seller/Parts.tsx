import { ArrowUpRight, Gavel, Tag } from "lucide-react";
import { Link } from "../Link";
import { Countdown } from "../Countdown";
import { formatDate, formatMoney, timeAgo } from "../../lib/format";
import { offerShareOfAsking, timeLeftLabel } from "../../lib/sellerMath";
import type { Auction, Offer, Order, Product, User } from "../../lib/types";

/* -------------------------------------------------- Offer decision card -- */

export function OfferDecision({
  offer,
  product,
  buyer,
  onAccept,
  onDecline,
}: {
  offer: Offer;
  product?: Product;
  buyer?: User;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const share = offerShareOfAsking(offer, product?.askingPrice ?? 0);
  const pending = offer.status === "pending";
  return (
    <article className="offer-card">
      <div className="offer-card-product">
        {product ? <img src={product.images[0]} alt={product.title} /> : <div aria-hidden />}
        <div>
          <strong>{product?.title ?? "Listing"}</strong>
          <span>
            Asking {product ? formatMoney(product.askingPrice) : "—"} · from {buyer?.name ?? "a buyer"} ·{" "}
            {timeAgo(offer.createdAt)}
          </span>
        </div>
      </div>
      <div className="offer-card-money">
        <span>Offer</span>
        <strong>{formatMoney(offer.amount)}</strong>
        <em>
          {share}% of asking
          {share < 70 ? " · low side of fair, your call" : ""}
        </em>
      </div>
      {offer.message && <p className="offer-card-note">“{offer.message}”</p>}
      {pending ? (
        <div className="offer-card-actions">
          <span className="offer-card-clock">
            <Tag size={14} /> {timeLeftLabel(offer.expiresAt)}
          </span>
          <button type="button" className="button button-olive" onClick={onAccept}>
            Accept
          </button>
          <button type="button" className="button button-ghost" onClick={onDecline}>
            Pass
          </button>
        </div>
      ) : (
        <div className="offer-card-actions is-closed">
          <span className="offer-card-closed">
            {offer.status === "converted" && "Paid. Now on its way."}
            {offer.status === "accepted" && "Accepted — buyer paying."}
            {(offer.status === "rejected" || offer.status === "cancelled") && "Passed."}
            {offer.status === "expired" && "Expired."}
            {offer.respondedAt ? formatDate(offer.respondedAt) : ""}
          </span>
        </div>
      )}
    </article>
  );
/* ------------------------------------------------------ Shipment stepper -- */

const SHIPMENT_STEPS = [
  { id: "paid", label: "Paid" },
  { id: "pickup_scheduled", label: "Pickup arranged" },
  { id: "picked_up", label: "Handed over" },
  { id: "transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
] as const;

/** Where a seller-facing order sits on the delivery rail. */
export function shipmentStep(order: Order): number {
  const status = order.shipment?.status ?? order.status;
  if (["returned", "failed"].includes(status)) return 4;
  if (status === "delivered") return 4;
  if (status === "out_for_delivery" || status === "in_transit") return 3;
  if (status === "picked_up") return 3;
  if (status === "processing") return 1;
  if (status === "awaiting_pickup") return 2;
  return 0; // paid, pending, pickup scheduled
}

type ShipmentStatus = NonNullable<Order["shipment"]>["status"];

/** The one delivery action the seller should confirm right now, if any. */
export function nextShipmentAction(order: Order): { status: ShipmentStatus; label: string } | null {
  if (order.paymentStatus !== "paid") return null;
  if (["cancelled", "expired", "returned", "failed", "delivered"].includes(order.status)) return null;
  const current = shipmentStep(order);
  switch (current) {
    case 0:
      return { status: "pickup_scheduled", label: "Pickup arranged" };
    case 1:
      return { status: "picked_up", label: "Confirm handed to the rider" };
    case 2:
      return { status: "in_transit", label: "Mark in transit" };
    case 3:
      return { status: "out_for_delivery", label: "Out for delivery" };
    case 4:
      return { status: "delivered", label: "Mark delivered" };
    default:
      return null;
  }
}

export function ShipmentStepper({ order }: { order: Order }) {
  const current = shipmentStep(order);
  const bad = ["failed", "returned"].includes(order.shipment?.status ?? "");
  return (
    <ol className="shipment-rail" aria-label="Delivery progress">
      {SHIPMENT_STEPS.map((step, index) => (
        <li
          key={step.id}
          className={
            index < current || (index === current && (order.status === "delivered" || bad))
              ? "is-done"
              : index === current
                ? "is-now"
                : ""
          }
        >
          <i aria-hidden />
          <span>{index === 4 && bad ? "Failed" : step.label}</span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------- Auction cards -- */

export function AuctionRailCard({
  auction,
  product,
  onEnd,
}: {
  auction: Auction;
  product?: Product;
  onEnd: () => void;
}) {
  if (!product) return null;
  return (
    <article className="auction-rail-card">
      <Link href={`#/auction/${auction.id}`} className="auction-rail-thumb">
        <img src={product.images[0]} alt={product.title} />
      </Link>
      <div className="auction-rail-body">
        <Link href={`#/auction/${auction.id}`} className="auction-rail-title">
          {product.title}
        </Link>
        <span>
          {formatMoney(auction.currentBid ?? auction.startingPrice)} · {auction.bidCount} bids ·{" "}
          your floor {formatMoney(auction.askingPrice)} locked
        </span>
      </div>
      <div className="auction-rail-side">
        {auction.status === "live" ? (
          <>
            <Countdown to={auction.endsAt} compact />
            <button type="button" className="text-link" onClick={onEnd}>
              End now
            </button>
          </>
        ) : (
          <span className="auction-rail-scheduled">opens soon</span>
        )}
        <Link href={`#/auction/${auction.id}`} className="text-link" aria-label={`View lot ${product.title}`}>
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  );
}

/* --------------------------------------------------- Settled offer row -- */

export function SettlementLedgerRow({
  source,
  orderId,
  asking,
  payout,
  subsidy,
  status,
  createdAt,
}: {
  source: string;
  orderId?: string;
  asking: number;
  payout: number;
  subsidy: number;
  status: string;
  createdAt: string;
}) {
  const tone =
    status === "paid" ? "status-good" : status === "approved" ? "status-good" : status === "on_hold" ? "status-bad" : "status-warm";
  const label =
    status === "pending"
      ? "Buyer approval pending"
      : status === "paid"
        ? "Paid"
        : status === "approved"
          ? "Cleared — in the 5-day window"
          : status === "on_hold"
            ? "On hold"
            : status;
  return (
    <div className="ledger-row">
      <div>
        <strong>{source === "auction" ? "Live auction" : source === "offer" ? "Accepted offer" : "Marketplace sale"}</strong>
        <span>{orderId ? `Order ${orderId.slice(0, 8)}` : "Auction"} · {formatDate(createdAt)}</span>
      </div>
      <span className="ledger-ask">{formatMoney(asking)}</span>
      <span className="ledger-payout">
        {formatMoney(payout)}
        {subsidy > 0 && <em>incl. {formatMoney(subsidy)} platform cover</em>}
      </span>
      <span className={`status-pill ${tone}`}>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------ make line -- */

export function NoListingsYet() {
  return (
    <div className="empty-state page-empty">
      <Gavel size={34} />
      <h2>
        Your shelf wants <em>back.</em>
      </h2>
      <p>Two minutes and one photo is enough to hang the first piece on the rail.</p>
      <Link href="#/sell" className="button button-olive">
        List the first piece
      </Link>
    </div>
  );
}

