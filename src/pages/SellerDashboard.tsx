import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Clock3,
  Gavel,
  Package,
  Plus,
  Store,
  Tag,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { Countdown } from "../components/Countdown";
import { EmptyState, StatusPill, Tabs } from "../components/Ui";
import { formatDate, formatMoney, timeAgo } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Order } from "../lib/types";

const shipmentOptions: { value: NonNullable<Order["shipment"]>["status"]; label: string }[] = [
  { value: "pickup_scheduled", label: "Pickup scheduled" },
  { value: "picked_up", label: "Picked up" },
  { value: "in_transit", label: "In transit" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Delivery failed" },
  { value: "returned", label: "Returned" },
];

export function SellerDashboardPage() {
  const {
    db,
    user,
    respondToOffer,
    advanceShipment,
    scheduleAuction,
    startAuctionNow,
    endAuctionNow,
    cancelAuction,
    toggleListingAvailability,
    removeListing,
  } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get("tab") || "overview");
  const [shipmentDraft, setShipmentDraft] = useState<Record<string, string>>({});
  const [auctionProduct, setAuctionProduct] = useState("");
  const [auctionStart, setAuctionStart] = useState("");

  useEffect(() => {
    setTab(route.query.get("tab") || "overview");
  }, [route.query]);

  if (!user) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Store size={38} />
          <h2>Sign in to your seller dashboard.</h2>
          <Link href="#/login" className="button button-olive">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (!user.isSeller && user.role !== "admin") {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Store size={38} />
          <h2>You are not selling yet.</h2>
          <p>Open a seller account from your profile, then list your first piece.</p>
          <div className="modal-actions center">
            <Link href="#/sell" className="button button-olive">
              Try listing
            </Link>
            <Link href="#/account?tab=profile" className="button button-ghost">
              My profile
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const myProducts = db.products.filter((product) => product.sellerId === user.id);
  const myOffers = db.offers.filter((offer) => offer.sellerId === user.id);
  const myOrders = db.orders.filter((order) => order.sellerId === user.id);
  const myAuctions = db.auctions.filter((auction) => auction.sellerId === user.id);
  const mySettlements = db.settlements.filter((settlement) => settlement.sellerId === user.id);
  const pendingOffers = myOffers.filter((offer) => offer.status === "pending");
  const paidOrders = myOrders.filter((order) =>
    ["paid", "processing", "awaiting_pickup", "shipped", "delivered"].includes(order.status),
  );
  const revenue = mySettlements.reduce(
    (total, settlement) => total + (settlement.status === "paid" ? settlement.sellerPayout : 0),
    0,
  );
  const pendingPayout = mySettlements
    .filter((settlement) => settlement.status !== "paid")
    .reduce((total, settlement) => total + settlement.sellerPayout, 0);
  const liveAuctions = myAuctions.filter((auction) => auction.status === "live");

  const setTabAndHash = (next: string) => {
    setTab(next);
    window.location.hash = `#/seller?tab=${next}`;
  };

  return (
    <main className="page-shell dashboard-page">
      <div className="section-wrap">
        <div className="page-header">
          <div>
            <div className="eyebrow">SELLER DASHBOARD</div>
            <h1>
              Your <em>shop.</em>
            </h1>
            <p>
              {user.name} · {myProducts.length} listings · {liveAuctions.length} live auctions
            </p>
          </div>
          <Link href="#/sell" className="button button-olive">
            <Plus size={15} /> New listing
          </Link>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <span>
              <Package size={15} /> Active listings
            </span>
            <strong>{myProducts.filter((product) => product.status === "active").length}</strong>
            <em>{myProducts.filter((product) => product.status === "pending").length} in review</em>
          </div>
          <div className="stat-card">
            <span>
              <Tag size={15} /> Pending offers
            </span>
            <strong>{pendingOffers.length}</strong>
            <em>Private, buyer-only prices</em>
          </div>
          <div className="stat-card">
            <span>
              <Truck size={15} /> Orders to ship
            </span>
            <strong>
              {paidOrders.filter((order) => !["delivered", "returned"].includes(order.status)).length}
            </strong>
            <em>Delivery is manually updated</em>
          </div>
          <div className="stat-card">
            <span>
              <Wallet size={15} /> Paid out
            </span>
            <strong>{formatMoney(revenue)}</strong>
            <em>{formatMoney(pendingPayout)} pending</em>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "listings", label: "Listings", count: myProducts.length },
            { id: "offers", label: "Offers", count: pendingOffers.length },
            { id: "orders", label: "Orders", count: myOrders.length },
            { id: "auctions", label: "Auctions", count: myAuctions.length },
            { id: "earnings", label: "Earnings" },
          ]}
          active={tab}
          onChange={setTabAndHash}
        />

        {tab === "overview" && (
          <div className="dashboard-section">
            <div className="dashboard-two-col">
              <section className="panel">
                <div className="panel-head">
                  <h2>Needs attention</h2>
                  <span>Today</span>
                </div>
                {pendingOffers.length === 0 &&
                paidOrders.filter((order) => order.status === "paid").length === 0 ? (
                  <p className="panel-empty">Nothing urgent. Your shop is tidy.</p>
                ) : (
                  <ul className="attention-list">
                    {pendingOffers.slice(0, 3).map((offer) => {
                      const product = db.products.find((item) => item.id === offer.productId);
                      return (
                        <li key={offer.id}>
                          <Tag size={15} />
                          <div>
                            <strong>{formatMoney(offer.amount)} offer</strong>
                            <span>{product?.title} · {timeAgo(offer.createdAt)}</span>
                          </div>
                          <button type="button" className="text-link" onClick={() => setTabAndHash("offers")}>
                            Review
                          </button>
                        </li>
                      );
                    })}
                    {paidOrders
                      .filter((order) => order.status === "paid")
                      .slice(0, 3)
                      .map((order) => (
                        <li key={order.id}>
                          <Truck size={15} />
                          <div>
                            <strong>Order {order.number}</strong>
                            <span>Paid · arrange pickup</span>
                          </div>
                          <button type="button" className="text-link" onClick={() => setTabAndHash("orders")}>
                            Open
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Recent activity</h2>
                  <span>History</span>
                </div>
                <ul className="activity-list">
                  {[...myOrders]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 5)
                    .map((order) => (
                      <li key={order.id}>
                        <span className={`activity-dot ${order.status}`} />
                        <div>
                          <strong>{order.items[0]?.title ?? "Order"}</strong>
                          <span>
                            {order.number} · {formatDate(order.createdAt)}
                          </span>
                        </div>
                        <StatusPill status={order.status} />
                      </li>
                    ))}
                  {myOrders.length === 0 && <p className="panel-empty">No orders yet.</p>}
                </ul>
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Your live auctions</h2>
                <Link href="#/auctions" className="text-link">
                  Marketplace <ArrowUpRight size={14} />
                </Link>
              </div>
              {liveAuctions.length ? (
                <div className="mini-auction-grid">
                  {liveAuctions.map((auction) => {
                    const product = db.products.find((item) => item.id === auction.productId);
                    if (!product) return null;
                    return (
                      <Link key={auction.id} href={`#/auction/${auction.id}`} className="mini-auction">
                        <img src={product.images[0]} alt={product.title} />
                        <div>
                          <strong>{product.title}</strong>
                          <span>
                            {formatMoney(auction.currentBid ?? auction.startingPrice)} · {auction.bidCount} bids
                          </span>
                          <Countdown to={auction.endsAt} compact />
                        </div>
                        <ArrowUpRight size={15} />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="panel-empty">
                  No live auction right now. Opt in to auctions when listing, or schedule one below.
                </p>
              )}
            </section>
          </div>
        )}

        {tab === "listings" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>All listings</h2>
              <Link href="#/sell" className="text-link">
                <Plus size={14} /> Add listing
              </Link>
            </div>
            {myProducts.length ? (
              <div className="listing-table">
                <div className="table-head">
                  <span>Piece</span>
                  <span>Price</span>
                  <span>Status</span>
                  <span>Views</span>
                  <span>Actions</span>
                </div>
                {myProducts.map((product) => (
                  <div key={product.id} className="table-row">
                    <div className="table-product">
                      <img src={product.images[0]} alt={product.title} />
                      <div>
                        <strong>{product.title}</strong>
                        <span>
                          {product.category} · {product.condition} · {product.quantity} in stock
                        </span>
                      </div>
                    </div>
                    <strong>{formatMoney(product.askingPrice)}</strong>
                    <StatusPill status={product.status} />
                    <span>{product.views}</span>
                    <div className="table-actions">
                      <Link href={`#/product/${product.id}`} className="text-link">
                        View
                      </Link>
                      <Link href={`#/sell?edit=${product.id}`} className="text-link">
                        Edit
                      </Link>
                      {["active", "draft"].includes(product.status) && (
                        <button
                          type="button"
                          className="text-link"
                          onClick={async () => {
                            const result = await toggleListingAvailability(product.id);
                            if (!result.ok) toast(result.error, "error");
                          }}
                        >
                          {product.status === "active" ? "Pause" : "Activate"}
                        </button>
                      )}
                      {product.status !== "removed" && (
                        <button
                          type="button"
                          className="text-link danger"
                          onClick={async () => {
                            if (!window.confirm("Remove this listing?")) return;
                            const result = await removeListing(product.id);
                            if (!result.ok) toast(result.error, "error");
                            else toast("Listing removed.");
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Package size={34} />}
                title="No listings yet."
                body="Add the first piece and it will appear on the rail."
                action="Create a listing"
                actionHref="#/sell"
              />
            )}
          </div>
        )}

        {tab === "offers" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Offers received</h2>
              <span>Private to each buyer</span>
            </div>
            {myOffers.length ? (
              <div className="offer-table">
                {myOffers.map((offer) => {
                  const product = db.products.find((item) => item.id === offer.productId);
                  const buyer = db.users.find((item) => item.id === offer.buyerId);
                  return (
                    <article key={offer.id} className="offer-row">
                      <div className="offer-product">
                        {product && <img src={product.images[0]} alt={product.title} />}
                        <div>
                          <strong>{product?.title ?? "Listing"}</strong>
                          <span>
                            Asking {product ? formatMoney(product.askingPrice) : "—"} · from{" "}
                            {buyer?.name ?? "a buyer"}
                          </span>
                        </div>
                      </div>
                      <div className="offer-amount">
                        <span>Offer</span>
                        <strong>{formatMoney(offer.amount)}</strong>
                      </div>
                      <div className="offer-status">
                        <StatusPill status={offer.status} />
                        <span>
                          {offer.status === "pending"
                            ? `Expires ${formatDate(offer.expiresAt)}`
                            : offer.respondedAt
                              ? formatDate(offer.respondedAt)
                              : timeAgo(offer.createdAt)}
                        </span>
                      </div>
                      {offer.message && <p className="offer-message">“{offer.message}”</p>}
                      {offer.status === "pending" ? (
                        <div className="offer-actions">
                          <button
                            type="button"
                            className="button button-olive"
                            onClick={async () => {
                              const result = await respondToOffer(offer.id, true);
                              if (result.ok) toast("Offer accepted. The buyer can pay now.", "success");
                              else toast(result.error, "error");
                            }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="button button-ghost"
                            onClick={async () => {
                              const result = await respondToOffer(offer.id, false);
                              if (result.ok) toast("Offer declined.");
                              else toast(result.error, "error");
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="offer-closed">
                          {offer.status === "converted" ? "Paid and converted to an order" : "Closed"}
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Tag size={34} />}
                title="No offers yet."
                body="When a buyer sends a private offer, it lands here."
                action="View listings"
                actionHref="#/seller?tab=listings"
              />
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Orders</h2>
              <span>Delivery updates are manual in this demo</span>
            </div>
            {myOrders.length ? (
              <div className="seller-order-list">
                {myOrders.map((order) => {
                  const buyer = db.users.find((item) => item.id === order.buyerId);
                  const nextStatus = shipmentDraft[order.id] || "";
                  return (
                    <article key={order.id} className="seller-order">
                      <div className="seller-order-head">
                        <div>
                          <strong>{order.number}</strong>
                          <span>
                            {formatDate(order.createdAt)} · {buyer?.name ?? "Buyer"}
                          </span>
                        </div>
                        <StatusPill status={order.status} />
                        <StatusPill status={order.paymentStatus} tone={order.paymentStatus === "paid" ? "good" : "warm"} />
                        <Link href={`#/orders/${order.id}`} className="text-link">
                          Details
                        </Link>
                      </div>
                      <div className="seller-order-body">
                        <div className="seller-order-items">
                          {order.items.map((item) => (
                            <div key={item.id}>
                              <img src={item.image} alt={item.title} />
                              <span>
                                <strong>{item.title}</strong>
                                <em>
                                  Qty {item.quantity} · {formatMoney(item.price)}
                                </em>
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="seller-order-address">
                          <span>Ship to</span>
                          <strong>{order.address.name}</strong>
                          <p>
                            {order.address.line1}
                            {order.address.line2 ? `, ${order.address.line2}` : ""}
                            <br />
                            {order.address.city} {order.address.pincode}
                          </p>
                          <span>{order.address.phone}</span>
                        </div>
                        <div className="seller-order-total">
                          <span>Order total</span>
                          <strong>{formatMoney(order.total)}</strong>
                          <em>
                            {order.source === "auction"
                              ? "Auction win"
                              : order.source === "offer"
                                ? "Accepted offer"
                                : "Marketplace sale"}
                          </em>
                        </div>
                      </div>
                      {order.paymentStatus === "paid" &&
                        !["cancelled", "expired", "returned"].includes(order.status) && (
                          <div className="shipment-update">
                            <label>
                              <span>Update delivery</span>
                              <select
                                value={nextStatus}
                                onChange={(event) =>
                                  setShipmentDraft((previous) => ({
                                    ...previous,
                                    [order.id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Choose a status</option>
                                {shipmentOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className="button button-olive"
                              disabled={!nextStatus}
                              onClick={async () => {
                                const result = await advanceShipment(
                                  order.id,
                                  nextStatus as NonNullable<Order["shipment"]>["status"],
                                );
                                if (result.ok) {
                                  toast("Delivery status updated.", "success");
                                  setShipmentDraft((previous) => ({ ...previous, [order.id]: "" }));
                                } else {
                                  toast(result.error, "error");
                                }
                              }}
                            >
                              Save update
                            </button>
                            <p>Courier integration is not connected. This updates the timeline only.</p>
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Truck size={34} />}
                title="No orders yet."
                body="Paid orders appear here with the buyer's delivery address."
                action="View marketplace"
                actionHref="#/products"
              />
            )}
          </div>
        )}

        {tab === "auctions" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Auctions</h2>
              <span>Optional live lots</span>
            </div>

            <section className="panel auction-schedule-panel">
              <h3>Schedule an auction</h3>
              <p>
                Pick one of your active listings. The starting price is set from the platform
                percentage. You are guaranteed at least your asking price.
              </p>
              <div className="auction-schedule-form">
                <label>
                  <span>Listing</span>
                  <select
                    value={auctionProduct}
                    onChange={(event) => setAuctionProduct(event.target.value)}
                  >
                    <option value="">Choose a listing</option>
                    {myProducts
                      .filter((product) => product.status === "active")
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.title} · {formatMoney(product.askingPrice)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Starts</span>
                  <input
                    type="datetime-local"
                    value={auctionStart}
                    onChange={(event) => setAuctionStart(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="button button-olive"
                  disabled={!auctionProduct || !auctionStart}
                  onClick={async () => {
                    const result = await scheduleAuction(
                      auctionProduct,
                      new Date(auctionStart).toISOString(),
                    );
                    if (result.ok) {
                      toast("Auction scheduled.", "success");
                      setAuctionProduct("");
                      setAuctionStart("");
                    } else {
                      toast(result.error, "error");
                    }
                  }}
                >
                  Schedule <Gavel size={15} />
                </button>
              </div>
            </section>

            {myAuctions.length ? (
              <div className="seller-auction-list">
                {myAuctions.map((auction) => {
                  const product = db.products.find((item) => item.id === auction.productId);
                  if (!product) return null;
                  return (
                    <article key={auction.id} className="seller-auction">
                      <img src={product.images[0]} alt={product.title} />
                      <div className="seller-auction-info">
                        <div>
                          <strong>{product.title}</strong>
                          <span>
                            Asking {formatMoney(auction.askingPrice)} · start{" "}
                            {formatMoney(auction.startingPrice)}
                          </span>
                        </div>
                        <div className="seller-auction-stats">
                          <span>{formatMoney(auction.currentBid ?? auction.startingPrice)}</span>
                          <em>{auction.bidCount} bids</em>
                          {auction.status === "live" && <Countdown to={auction.endsAt} compact />}
                          {auction.status === "scheduled" && <Countdown to={auction.startsAt} prefix="Opens" compact />}
                        </div>
                      </div>
                      <div className="seller-auction-actions">
                        <StatusPill status={auction.status} tone={auction.status === "live" ? "live" : undefined} />
                        {auction.status === "scheduled" && (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => {
                              startAuctionNow(auction.id);
                              toast("Auction started.", "success");
                            }}
                          >
                            Start now
                          </button>
                        )}
                        {auction.status === "live" && (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => {
                              endAuctionNow(auction.id);
                              toast("Auction ended and settled.", "success");
                            }}
                          >
                            End now
                          </button>
                        )}
                        {["scheduled", "live"].includes(auction.status) && (
                          <button
                            type="button"
                            className="text-link danger"
                            onClick={() => {
                              if (!window.confirm("Cancel this auction?")) return;
                              cancelAuction(auction.id, "Cancelled by seller.");
                              toast("Auction cancelled.");
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        <Link href={`#/auction/${auction.id}`} className="text-link">
                          View lot
                        </Link>
                      </div>
                      {auction.financial && (
                        <div className="seller-auction-finance">
                          <span>
                            Winning bid <strong>{formatMoney(auction.financial.winningBid)}</strong>
                          </span>
                          <span>
                            Your payout <strong>{formatMoney(auction.financial.sellerPayout)}</strong>
                          </span>
                          {auction.financial.platformSubsidy > 0 && (
                            <span>
                              Subsidy <strong>{formatMoney(auction.financial.platformSubsidy)}</strong>
                            </span>
                          )}
                          <span>
                            Commission{" "}
                            <strong>{formatMoney(auction.financial.platformCommission)}</strong>
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Gavel size={34} />}
                title="No auctions yet."
                body="Opt in when listing, or schedule one from an active listing above."
                action="Manage listings"
                actionHref="#/seller?tab=listings"
              />
            )}
          </div>
        )}

        {tab === "earnings" && (
          <div className="dashboard-section">
            <div className="earning-cards">
              <div className="stat-card is-dark">
                <span>
                  <Banknote size={15} /> Lifetime paid
                </span>
                <strong>{formatMoney(revenue)}</strong>
                <em>Settlements marked paid</em>
              </div>
              <div className="stat-card">
                <span>
                  <Clock3 size={15} /> Pending payout
                </span>
                <strong>{formatMoney(pendingPayout)}</strong>
                <em>Awaiting admin approval</em>
              </div>
              <div className="stat-card">
                <span>
                  <TrendingUp size={15} /> Auction subsidy
                </span>
                <strong>
                  {formatMoney(
                    mySettlements.reduce((total, item) => total + item.platformSubsidy, 0),
                  )}
                </strong>
                <em>Covered by lelam</em>
              </div>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Settlements</h2>
                <span>Payouts are manual in this demo</span>
              </div>
              {mySettlements.length ? (
                <div className="listing-table">
                  <div className="table-head">
                    <span>Source</span>
                    <span>Asking</span>
                    <span>Payout</span>
                    <span>Status</span>
                    <span>Date</span>
                  </div>
                  {mySettlements.map((settlement) => (
                    <div key={settlement.id} className="table-row">
                      <div className="table-product">
                        <div>
                          <strong>{settlement.source}</strong>
                          <span>
                            {settlement.orderId ? `Order ${settlement.orderId.slice(0, 8)}` : "Auction"}
                          </span>
                        </div>
                      </div>
                      <span>{formatMoney(settlement.askingPrice)}</span>
                      <strong>{formatMoney(settlement.sellerPayout)}</strong>
                      <StatusPill status={settlement.status} />
                      <span>{formatDate(settlement.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="panel-empty">No settlements yet. They appear after a paid order.</p>
              )}
            </section>
          </div>
        )}

        <div className="dashboard-footnote">
          <BadgeCheck size={15} />
          Demo dashboard. No real payouts, courier bookings, or payment captures happen here.
          <button type="button" className="text-link" onClick={() => navigate("#/products")}>
            Back to shop
          </button>
        </div>
      </div>
    </main>
  );
}
