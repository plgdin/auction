import { ArrowUpRight, Gavel } from "lucide-react";
import { formatDateTime, formatMoney } from "../lib/format";
import type { Auction, Product } from "../lib/types";
import { Countdown } from "./Countdown";
import { Link } from "./Link";

export function AuctionCard({ auction, product }: { auction: Auction; product: Product }) {
  const latest = [...auction.bids].sort((a, b) => b.amount - a.amount)[0];
  const isLive = auction.status === "live";
  const isScheduled = auction.status === "scheduled";
  const isCompleted = auction.status === "completed";

  const badge = isLive
    ? "LIVE"
    : isScheduled
      ? "UPCOMING"
      : auction.status === "cancelled"
        ? "CANCELLED"
        : "SOLD";
  const priceLabel = isLive ? "Current bid" : isCompleted ? "Winning bid" : "Starting bid";
  const price = formatMoney(
    isLive || isCompleted ? auction.currentBid ?? auction.startingPrice : auction.startingPrice,
  );
  const detail = isLive
    ? `${auction.bidCount} bids${latest ? ` · ${latest.alias}` : ""}`
    : isCompleted
      ? `${auction.bidCount} bids`
      : `Min. increment ${formatMoney(auction.minIncrement)}`;
  const winner = auction.winnerId
    ? auction.bids.find((bid) => bid.amount === auction.currentBid)?.alias
    : undefined;

  return (
    <article
      className={`shop-card auction-tile ${isLive ? "is-live" : ""} ${isCompleted ? "is-completed" : ""}`}
    >
      <div className="shop-card-media">
        <Link href={`#/auction/${auction.id}`} aria-label={`View auction for ${product.title}`}>
          <img src={product.images[0]} alt={product.title} loading="lazy" />
        </Link>
        <span className="shop-card-tape" aria-hidden="true" />
        <span className={`auction-tile-badge ${isLive ? "is-live" : ""}`}>{badge}</span>
      </div>

      <div className="shop-card-info">
        <p className="shop-card-meta auction-tile-topline">
          <span>{product.category}</span>
          {isLive && <Countdown to={auction.endsAt} prefix="Ends in" compact />}
          {isScheduled && <Countdown to={auction.startsAt} prefix="Starts in" compact />}
          {isCompleted && <span>Ended {formatDateTime(auction.endsAt)}</span>}
        </p>
        <Link href={`#/auction/${auction.id}`} className="shop-card-title">
          {product.title}
        </Link>
        <p className="shop-card-meta">
          Asking {formatMoney(auction.askingPrice)} · {detail}
        </p>
        <p className="shop-card-meta">
          {isScheduled
            ? `Starts ${formatDateTime(auction.startsAt)} · Ends ${formatDateTime(auction.endsAt)}`
            : isLive
              ? `Started ${formatDateTime(auction.startsAt)} · Ends ${formatDateTime(auction.endsAt)}`
              : auction.status === "cancelled"
                ? auction.cancelledReason || "Auction cancelled"
                : winner
                  ? `Won by ${winner}`
                  : "No bids — lot did not sell"}
        </p>
        <div className="shop-card-buy">
          <div className="auction-tile-bid">
            <span>{priceLabel}</span>
            <strong>{price}</strong>
          </div>
          <Link href={`#/auction/${auction.id}`} className="auction-tile-enter">
            {isLive ? <Gavel size={14} strokeWidth={1.8} /> : <ArrowUpRight size={14} strokeWidth={1.8} />}
            {isLive ? "Enter" : isScheduled ? "View lot" : "Result"}
          </Link>
        </div>
      </div>
    </article>
  );
}
