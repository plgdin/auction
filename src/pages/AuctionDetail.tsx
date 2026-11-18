import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  Gavel,
  Info,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { Countdown } from "../components/Countdown";
import { Link, navigate } from "../components/Link";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/Ui";
import { formatMoney, formatDateTime, shortDate } from "../lib/format";
import { useSeo } from "../lib/seo";
import { auctionMeta } from "../lib/seo-meta";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import { promptAuth } from "../lib/authGate";

export function AuctionDetailPage() {
  const { db, user, placeBid, toggleFavorite, favorites } = useStore();
  const { auctionId = "" } = useParams();
  const auction = db.auctions.find((item) => item.id === auctionId);
  const [bidRupees, setBidRupees] = useState("");
  const [lastResult, setLastResult] = useState<string>("");
  const [acceptedAuctionTerms, setAcceptedAuctionTerms] = useState(false);
  const [showWinnerPayment, setShowWinnerPayment] = useState(false);

  const product = auction ? db.products.find((item) => item.id === auction.productId) : undefined;
  const winnerOrder = auction?.orderId ? db.orders.find((item) => item.id === auction.orderId) : undefined;

  const minimum = useMemo(() => {
    if (!auction) return 0;
    return (auction.currentBid ?? auction.startingPrice - auction.minIncrement) + auction.minIncrement;
  }, [auction]);

  useEffect(() => {
    setBidRupees("");
    setLastResult("");
    setShowWinnerPayment(false);
  }, [auctionId]);

  useEffect(() => {
    if (!auction || !user || auction.status !== "completed" || auction.winnerId !== user.id || !winnerOrder) return;
    if (winnerOrder.paymentStatus === "paid") return;
    const seenKey = `lelam-auction-winner-prompt:${winnerOrder.id}`;
    if (sessionStorage.getItem(seenKey)) return;
    sessionStorage.setItem(seenKey, "shown");
    setShowWinnerPayment(true);
  }, [auction, user, winnerOrder]);

  useSeo(
    auction && product
      ? auctionMeta(
          {
            id: auction.id,
            productId: auction.productId,
            status: auction.status,
            startingPrice: auction.startingPrice,
            currentBid: auction.currentBid,
          },
          {
            id: product.id,
            title: product.title,
            description: product.description,
            condition: product.condition,
            size: product.size,
            brand: product.brand,
            sellerName: product.sellerName,
            askingPrice: product.askingPrice,
            images: product.images,
            status: product.status,
          },
        )
      : null,
  );

  if (!auction || !product) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Gavel size={38} />
          <h2>This auction is not here.</h2>
          <p>It may have ended or been cancelled.</p>
          <Link href="/auctions" className="button button-olive">
            All auctions
          </Link>
        </div>
      </main>
    );
  }

  const seller = db.users.find((item) => item.id === auction.sellerId);
  const live = auction.status === "live";
  const scheduled = auction.status === "scheduled";
  const completed = auction.status === "completed";
  const ownAuction = user?.id === auction.sellerId;
  const saved = favorites.includes(product.id);
  const bids = [...auction.bids].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const participating = Boolean(user && bids.some((bid) => bid.bidderId === user.id));
  const leading = Boolean(user && auction.highestBidderId === user.id);

  const submitBid = async () => {
    if (!acceptedAuctionTerms) {
      toast("Please accept the Auction Terms before bidding.", "error");
      return;
    }
    const amount = Math.round(Number(bidRupees) * 100);
    if (!bidRupees.trim() || Number.isNaN(amount)) {
      toast("Enter a bid amount.", "error");
      return;
    }
    const result = await placeBid(auction.id, amount);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setBidRupees("");
    setLastResult(
      result.extended
        ? "Bid placed. A late bid came in, so the auction was extended."
        : "Bid placed. You are the highest bidder.",
    );
    toast(result.extended ? "Bid placed. Auction extended." : "Bid placed.", "success");
  };

  return (
    <main className="page-shell auction-detail-page">
      <div className="section-wrap">
        <div className="breadcrumbs">
          <Link href="/auctions">
            <ArrowLeft size={14} /> All auctions
          </Link>
          <span>/</span>
          <span>{product.title}</span>
        </div>

        <div className="auction-detail-layout">
          <div className="auction-detail-visual">
            <div className="auction-detail-image">
              <img src={product.images[0]} alt={product.title} />
              <span className={`auction-live-badge ${live ? "is-live" : ""}`}>
                {live && <i />}
                {live ? "LIVE AUCTION" : scheduled ? "UPCOMING LOT" : auction.status.toUpperCase()}
              </span>
            </div>
            <div className="auction-detail-meta">
              <div>
                <span>Seller</span>
                <strong>{product.sellerName}</strong>
              </div>
              <div>
                <span>Condition</span>
                <strong>{product.condition}</strong>
              </div>
              <div>
                <span>Size</span>
                <strong>{product.size || "One size"}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{product.location.split(",")[0]}</strong>
              </div>
            </div>
            <p className="auction-detail-description">{product.description}</p>
            <div className="auction-trust-line">
              <ShieldCheck size={15} /> Doorstep delivery across India.
            </div>
          </div>

          <div className="auction-detail-panel">
            <div className="auction-detail-topline">
              <span>{product.category}</span>
              <StatusPill status={auction.status} tone={live ? "live" : undefined} />
            </div>
            <h1>{product.title}</h1>
            <p className="auction-detail-sub">
              Asking price {formatMoney(auction.askingPrice)} ·{" "}
              {live
                ? "bidding open"
                : scheduled
                  ? `starts ${shortDate(auction.startsAt)}`
                  : `ended ${formatDateTime(auction.endsAt)}`}
            </p>

            <div className={`auction-bid-box ${leading ? "is-leading" : ""}`}>
              <div className="auction-bid-head">
                <span>{live ? "Current bid" : completed ? "Winning bid" : "Starting bid"}</span>
                <span>
                  {auction.bidCount} {auction.bidCount === 1 ? "bid" : "bids"}
                </span>
              </div>
              <strong className="auction-bid-amount">
                {formatMoney(auction.currentBid ?? auction.startingPrice)}
              </strong>
              {live && <Countdown to={auction.endsAt} prefix="Closes in" />}
              {scheduled && <Countdown to={auction.startsAt} prefix="Opens in" />}
              {completed && auction.winnerId && (
                <span className="auction-winner-line">
                  <Trophy size={14} /> Won by{" "}
                  {auction.winnerId === user?.id
                    ? "you"
                    : bids.find((bid) => bid.amount === auction.currentBid)?.alias ?? "anonymous bidder"}
                </span>
              )}
              {completed && !auction.winnerId && <span className="auction-winner-line">No bids — lot did not sell</span>}
              {live && leading && (
                <span className="auction-leading">
                  <BadgeCheck size={14} /> You are the highest bidder
                </span>
              )}
            </div>

            <div className="auction-guarantee">
              <Info size={16} />
              <p>
                <strong>How bidding works:</strong> bids must meet the displayed minimum and increment. A bid in the final 30 seconds adds 30 seconds. The highest valid bid when the timer ends wins and must be paid within 5 minutes. <Link href="/auction-terms">Full Auction Terms</Link>.
              </p>
            </div>

            {live && !ownAuction && user && !user.blocked && user.role !== "admin" && (
              <div className="auction-bid-form">
                <label className="field">
                  <span className="field-label">Your bid (₹)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={bidRupees}
                    min={minimum / 100}
                    placeholder={String(minimum / 100)}
                    onChange={(event) => setBidRupees(event.target.value)}
                  />
                  <span className="field-hint">
                    Minimum next bid {formatMoney(minimum)} · increment{" "}
                    {formatMoney(auction.minIncrement)}
                  </span>
                </label>
                <div className="auction-bid-presets">
                  {[minimum, minimum + auction.minIncrement, minimum + auction.minIncrement * 2].map(
                    (amount) => (
                      <button
                        key={amount}
                        type="button"
                        className="chip-button"
                        onClick={() => setBidRupees(String(amount / 100))}
                      >
                        {formatMoney(amount)}
                      </button>
                    ),
                  )}
                </div>
                <label className="legal-consent auction-consent">
                  <input
                    type="checkbox"
                    checked={acceptedAuctionTerms}
                    onChange={(event) => setAcceptedAuctionTerms(event.target.checked)}
                  />
                  <span>
                    I agree to the <Link href="/auction-terms">Auction Terms</Link>. Verified email is required to bid.
                  </span>
                </label>
                <button type="button" className="button button-olive auction-bid-submit" onClick={submitBid} disabled={!acceptedAuctionTerms}>
                  Place bid <Gavel size={15} />
                </button>
                {participating && (
                  <p className="auction-anon-note">
                    <Users size={13} /> You appear in the feed as{" "}
                    {bids.find((bid) => bid.bidderId === user?.id)?.alias}.
                  </p>
                )}
                <p className="auction-antinsipe">
                  <Clock3 size={13} /> Bids in the final {auction.antiSnipeSeconds} seconds extend the
                  auction by {auction.antiSnipeSeconds} seconds. Anti-snipe protection is on.
                </p>
              </div>
            )}

            {live && !ownAuction && !user && (
              <div className="auction-own-note">
                <Gavel size={16} />
                <div>
                  <strong>Sign in to bid</strong>
                  <p>Your account is required to place and track bids.</p>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => promptAuth(`${window.location.pathname}${window.location.search}`, "place a bid")}
                  >
                    Sign in or create an account <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {live && user?.blocked && <p className="auction-own-note">This account is blocked from bidding.</p>}
            {live && user?.role === "admin" && <p className="auction-own-note">Administrators cannot bid.</p>}

            {ownAuction && (
              <div className="auction-own-note">
                <Gavel size={16} />
                <div>
                  <strong>This is your auction.</strong>
                  <p>You cannot bid on your own listing.</p>
                  <Link href="/seller?tab=auctions" className="text-link">
                    Manage auction <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {scheduled && !ownAuction && (
              <div className="auction-scheduled-block">
                <p>
                  Bidding opens {shortDate(auction.startsAt)}. The starting price is{" "}
                  {formatMoney(auction.startingPrice)}.
                </p>
                <button
                  type="button"
                  className={`button ${saved ? "button-ghost" : "button-olive"}`}
                  onClick={() => {
                    toggleFavorite(product.id);
                    toast(saved ? "Removed reminder." : "We will remind you when it opens.", "success");
                  }}
                >
                  {saved ? "Reminder saved" : "Remind me"} <Clock3 size={15} />
                </button>
              </div>
            )}

            {completed && (
              <div className="auction-result-block">
                <div>
                  <span>Asking price</span>
                  <strong>{formatMoney(auction.askingPrice)}</strong>
                </div>
                <div>
                  <span>Winning bid</span>
                  <strong>{formatMoney(auction.currentBid ?? auction.startingPrice)}</strong>
                </div>
                <div>
                  <span>Seller payout</span>
                  <strong>{formatMoney(auction.financial?.sellerPayout ?? 0)}</strong>
                </div>
              </div>
            )}

            <div className="auction-bid-feed">
              <div className="auction-bid-feed-head">
                <h2>Bid history</h2>
                <span>Anonymous by design</span>
              </div>
              {bids.length ? (
                <ul>
                  {bids.map((bid) => (
                    <li key={bid.id} className={bid.bidderId === user?.id ? "is-mine" : ""}>
                      <span className="bid-alias">
                        {bid.bidderId === user?.id ? "You" : bid.alias}
                      </span>
                      <strong>{formatMoney(bid.amount)}</strong>
                      <em>{formatDateTime(bid.createdAt)}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="auction-bid-empty">No bids yet. The starting price is the opening bid.</p>
              )}
            </div>

    {lastResult && <p className="auction-last-result">{lastResult}</p>}

            {showWinnerPayment && winnerOrder && (
              <Modal title="You won — complete your purchase" onClose={() => setShowWinnerPayment(false)}>
                <div className="modal-body">
                  <p>You won <strong>{product.title}</strong> for {formatMoney(winnerOrder.total)}.</p>
                  <p>Complete payment within 5 minutes. You can return to this order from your account.</p>
                  {winnerOrder.paymentDeadline && <Countdown to={winnerOrder.paymentDeadline} prefix="Payment due in" />}
                  <button
                    type="button"
                    className="button button-olive"
                    onClick={() => navigate(`/orders/${winnerOrder.id}`)}
                  >
                    Pay now
                  </button>
                </div>
              </Modal>
            )}

            <div className="auction-detail-actions">
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  toggleFavorite(product.id);
                  toast(saved ? "Removed from saved." : "Saved. We will alert you.", "success");
                }}
              >
                {saved ? "Saved" : "Save this lot"}
              </button>
              <Link href={`/product/${product.id}`} className="text-link">
                Full item details <ArrowUpRight size={14} />
              </Link>
            </div>

            {seller && (
              <div className="auction-detail-seller">
                <div className="seller-avatar">{seller.name.slice(0, 1)}</div>
                <div>
                  <span>Offered by</span>
                  <strong>{seller.name}</strong>
                  <p>{seller.bio || <>Independent seller on <span className="brand-wordmark">lelam.co</span></>}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
