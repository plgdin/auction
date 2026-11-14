import { Link } from "../../components/Link";
import { AuctionRailCard, nextShipmentAction, OfferDecision, shipmentStep } from "../../components/seller/Parts";
import { formatMoney, timeAgo } from "../../lib/format";
import { netPayout } from "../../lib/sellerMath";
import { useStore } from "../../lib/store";
import { toast } from "../../lib/toast";

/**
 * "Today" — the one screen a seller opens daily: what needs action,
 * what the money looks like, what is live on the rail.
 * Every inline action works here without hopping tabs.
 */
export function TodayTab({ onGoToTab }: { onGoToTab: (tab: string) => void }) {
  const { db, user, respondToOffer, advanceShipment, endAuctionNow } = useStore();
  if (!user) return null;

  const myOffers = db.offers.filter((offer) => offer.sellerId === user.id);
  const myOrders = db.orders.filter((order) => order.sellerId === user.id);
  const myAuctions = db.auctions.filter((auction) => auction.sellerId === user.id);
  const mySettlements = db.settlements.filter((settlement) => settlement.sellerId === user.id);

  const pendingOffers = myOffers.filter((offer) => offer.status === "pending");
  const paidOrders = myOrders.filter((order) => order.paymentStatus === "paid");
  const handOffOrders = paidOrders.filter((order) => {
    const action = nextShipmentAction(order);
    return action && (order.shipment?.status ?? order.status) !== "delivered";
  });
  const liveRail = myAuctions.filter((auction) => ["live", "scheduled"].includes(auction.status));
  const lifetime = mySettlements.reduce(
    (total, settlement) => (settlement.status === "paid" ? total + netPayout(settlement.sellerPayout) : total),
    0,
  );
  const pendingPayout = mySettlements
    .filter((settlement) => settlement.status !== "paid")
    .reduce((total, settlement) => total + netPayout(settlement.sellerPayout), 0);
  const recentOrders = [...myOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const queueFull = pendingOffers.length + handOffOrders.length;
  // Call the strip what it is: parcels still waiting for the rider, or moving.
  const parcelLabel = handOffOrders.some((order) => shipmentStep(order) >= 3)
    ? `${handOffOrders.length === 1 ? "parcel" : "parcels"} on the way to buyers`
    : `${handOffOrders.length === 1 ? "parcel" : "parcels"} waiting for the rider`;

  return (
    <div className="dashboard-section">
      <div className="today-money" role="group" aria-label="Your money">
        <button type="button" className="today-money-fig is-dark" onClick={() => onGoToTab("money")}>
          <strong>{formatMoney(lifetime)}</strong>
          <span>in your pocket so far</span>
        </button>
        <button type="button" className="today-money-fig" onClick={() => onGoToTab("money")}>
          <strong>{formatMoney(pendingPayout)}</strong>
          <span>arriving · buyer approval · ≤5 business days</span>
        </button>
        <button type="button" className="today-money-fig" onClick={() => onGoToTab("orders")}>
          <strong>{handOffOrders.length || "—"}</strong>
          <span>{parcelLabel}</span>
        </button>
      </div>

      <section className="panel sd-today-queue">
        <div className="panel-head">
          <h2>
            {queueFull ? "Needs you" : "Nothing needs you."}
          </h2>
          <span>
            {queueFull ? `${queueFull} ${queueFull === 1 ? "decision" : "decisions"} · today` : "All tidy."}
          </span>
        </div>

        {queueFull === 0 && (
          <p className="panel-empty">
            Sit back. Offers and parcels ping you here the moment they arrive.
          </p>
        )}

        {pendingOffers.length > 0 && (
          <div className="today-offers">
            {pendingOffers.slice(0, 4).map((offer) => (
              <OfferDecision
                key={offer.id}
                offer={offer}
                product={db.products.find((item) => item.id === offer.productId)}
                buyer={db.users.find((item) => item.id === offer.buyerId)}
                onAccept={() => {
                  const result = respondToOffer(offer.id, true);
                  if (result.ok) toast("Offer accepted. The buyer can pay now.", "success");
                  else toast(result.error, "error");
                }}
                onDecline={() => {
                  const result = respondToOffer(offer.id, false);
                  if (result.ok) toast("Offer declined.");
                  else toast(result.error, "error");
                }}
              />
            ))}
          </div>
        )}

        {handOffOrders.length > 0 && (
          <div className="today-hands">
            {handOffOrders.slice(0, 3).map((order) => {
              const action = nextShipmentAction(order);
              return (
                <div key={order.id} className="today-hand-row">
                  <img src={order.items[0]?.image} alt="" aria-hidden />
                  <div>
                    <strong>
                      Order {order.number} · {formatMoney(order.total)}
                    </strong>
                    <span>
                      Buyer paid
                      {order.paidAt ? ` · ${timeAgo(order.paidAt)}` : ""}
                      {" · a rider collects from your door"}
                    </span>
                  </div>
                  {action && (
                    <button
                      type="button"
                      className="button button-olive today-hand-btn"
                      onClick={() => {
                        const result = advanceShipment(order.id, action.status);
                        if (result.ok) toast("Delivery updated. The buyer sees it instantly.", "success");
                        else toast(result.error, "error");
                      }}
                    >
                      {action.label}
                    </button>
                  )}
                  <Link href={`#/orders/${order.id}`} className="text-link">
                    Open
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel sd-today-rail">
        <div className="panel-head">
          <h2>On the rail, live</h2>
          <Link href="#/auctions" className="text-link">
            Auction hall
          </Link>
        </div>
        {liveRail.length ? (
          <div className="auction-rail">
            {liveRail.map((auction) => (
              <AuctionRailCard
                key={auction.id}
                auction={auction}
                product={db.products.find((item) => item.id === auction.productId)}
                onEnd={() => {
                  endAuctionNow(auction.id);
                  toast("Auction ended and settled.", "success");
                }}
              />
            ))}
          </div>
        ) : (
          <p className="panel-empty">
            No piece of yours is running in the hall right now. Schedule one from Inventory.
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent activity</h2>
          <span>last {recentOrders.length}</span>
        </div>
        <ul className="activity-list">
          {recentOrders.map((order) => (
            <li key={order.id}>
              <span className={`activity-dot ${order.status}`} />
              <div>
                <strong>{order.items[0]?.title ?? "Order"}</strong>
                <span>
                  {order.number} · {timeAgo(order.createdAt)}
                </span>
              </div>
              <Link href={`#/orders/${order.id}`} className="text-link">
                Details
              </Link>
            </li>
          ))}
          {recentOrders.length === 0 && <p className="panel-empty">No orders yet. The first one will land here.</p>}
        </ul>
      </section>
    </div>
  );
}
