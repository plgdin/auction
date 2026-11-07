import { ArrowUpRight, Gavel } from "lucide-react";
import NumberTicker from "@/components/ui/number-ticker-02";
import { formatMoney } from "../lib/format";
import type { Auction, Product } from "../lib/types";
import { Countdown } from "./Countdown";
import { Link } from "./Link";
import { StatusPill } from "./Ui";

export function AuctionCard({ auction, product }: { auction: Auction; product: Product }) {
  const latest = [...auction.bids].sort((a, b) => b.amount - a.amount)[0];
  const isLive = auction.status === "live";
  const isScheduled = auction.status === "scheduled";
  const isCompleted = auction.status === "completed";

  return (
    <article className={`auction-card ${isLive ? "is-live" : ""} ${isCompleted ? "is-completed" : ""}`}>
      <Link href={`#/auction/${auction.id}`} className="auction-card-image">
        <img src={product.images[0]} alt={product.title} loading="lazy" />
        <span className="auction-card-badge">
          {isLive ? (
            <>
              <i /> LIVE
            </>
          ) : isScheduled ? (
            "UPCOMING"
          ) : auction.status === "cancelled" ? (
            "CANCELLED"
          ) : (
            "COMPLETED"
          )}
        </span>
      </Link>
      <div className="auction-card-body">
        <div className="auction-card-topline">
          <span>{product.category}</span>
          {isLive && <Countdown to={auction.endsAt} compact />}
          {isScheduled && <Countdown to={auction.startsAt} prefix="Starts in" compact />}
          {isCompleted && <span>{auction.bidCount} bids</span>}
        </div>
        <Link href={`#/auction/${auction.id}`} className="auction-card-title">
          {product.title}
        </Link>
        <div className="auction-card-prices">
          <div>
            <span>{isLive ? "Current bid" : isCompleted ? "Winning bid" : "Starting at"}</span>
            <strong>
              <NumberTicker
                value={Math.round(
                  (isLive || isCompleted
                    ? auction.currentBid ?? auction.startingPrice
                    : auction.startingPrice) / 100
                )}
                currency="INR"
                decimals={0}
                className="font-bold text-base text-inherit"
              />
            </strong>
          </div>
          <div>
            <span>Asking price</span>
            <em>{formatMoney(auction.askingPrice)}</em>
          </div>
        </div>
        <div className="auction-card-meta">
          <span>{isLive ? `${auction.bidCount} bids` : `Min. increment ${formatMoney(auction.minIncrement)}`}</span>
          {latest && isLive && <span>{latest.alias}</span>}
          {isCompleted && auction.winnerId && <span>Winner anonymous</span>}
        </div>
        <div className="auction-card-footer">
          <StatusPill status={auction.status} />
          <Link href={`#/auction/${auction.id}`} className="auction-enter">
            {isLive ? <Gavel size={14} /> : <ArrowUpRight size={14} />}
            {isLive ? "Enter auction" : isScheduled ? "View lot" : "See result"}
          </Link>
        </div>
      </div>
    </article>
  );
}
