import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  CreditCard,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { Field, StatusPill } from "../components/Ui";
import { formatDate, formatDateTime, formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Order } from "../lib/types";

const shipmentSteps: NonNullable<Order["shipment"]>["status"][] = [
  "pending_pickup",
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

const sellerShipmentOptions: { value: NonNullable<Order["shipment"]>["status"]; label: string }[] = [
  { value: "pickup_scheduled", label: "Pickup scheduled" },
  { value: "picked_up", label: "Picked up" },
  { value: "in_transit", label: "In transit" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
];

export function OrderDetailPage() {
  const route = useRoute();
  const {
    db,
    user,
    payOrders,
    cancelOrder,
    requestReturn,
    addReview,
    advanceShipment,
    confirmCodPayment,
  } = useStore();
  const orderId = route.path.split("/")[2] || "";
  const order = db.orders.find((item) => item.id === orderId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState("");

  if (!order) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Package size={38} />
          <h2>Order not found.</h2>
          <Link href="#/account?tab=orders" className="button button-olive">
            My orders
          </Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <ShieldCheck size={38} />
          <h2>Sign in to view this order.</h2>
          <Link href="#/login" className="button button-olive">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const isBuyer = order.buyerId === user.id;
  const isSeller = order.sellerId === user.id;
  const isAdmin = user.role === "admin";
  if (!isBuyer && !isSeller && !isAdmin) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <ShieldCheck size={38} />
          <h2>This order is not yours.</h2>
          <Link href="#/account?tab=orders" className="button button-olive">
            My orders
          </Link>
        </div>
      </main>
    );
  }

  const seller = db.users.find((item) => item.id === order.sellerId);
  const buyer = db.users.find((item) => item.id === order.buyerId);
  const existingReview = db.reviews.find((review) => review.orderId === order.id);
  const activeIndex = order.shipment ? shipmentSteps.indexOf(order.shipment.status) : -1;
  const canPay = isBuyer && order.status === "pending_payment";
  const canUpdateDelivery =
    (isSeller || isAdmin) &&
    (order.paymentStatus === "paid" ||
      (order.paymentMethod === "cod" && order.paymentStatus === "pending")) &&
    !["delivered", "cancelled", "expired", "returned"].includes(order.status);
  const canCancel =
    (isBuyer || isSeller || isAdmin) &&
    ["pending_payment", "paid", "processing", "awaiting_pickup"].includes(order.status);
  const canReturn = isBuyer && order.status === "delivered";
  const canReview = isBuyer && order.status === "delivered" && !existingReview;

  return (
    <main className="page-shell order-page">
      <div className="section-wrap">
        <div className="breadcrumbs">
          <Link href={isSeller ? "#/seller?tab=orders" : "#/account?tab=orders"}>
            <ArrowLeft size={14} /> {isSeller ? "Seller orders" : "My orders"}
          </Link>
          <span>/</span>
          <span>{order.number}</span>
        </div>

        <div className="order-header">
          <div>
            <div className="eyebrow">ORDER {order.number}</div>
            <h1>
              {order.status === "delivered" ? (
                <>
                  Delivered, <em>enjoy it.</em>
                </>
              ) : order.status === "pending_payment" ? (
                <>
                  Almost <em>yours.</em>
                </>
              ) : ["cancelled", "expired", "returned"].includes(order.status) ? (
                <>
                  This order is <em>closed.</em>
                </>
              ) : order.shipment &&
                ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(
                  order.shipment.status,
                ) ? (
                <>
                  On its <em>way.</em>
                </>
              ) : (
                <>
                  Getting it <em>ready.</em>
                </>
              )}
            </h1>
            <p>
              Placed {formatDate(order.createdAt)} · {order.items.length}{" "}
              {order.items.length === 1 ? "piece" : "pieces"} ·{" "}
              {isSeller ? `Buyer ${buyer?.name ?? "—"}` : `From ${seller?.name ?? "seller"}`}
            </p>
          </div>
          <div className="order-status-stack">
            <StatusPill status={order.status} />
            {order.status !== order.paymentStatus && (
              <StatusPill
                status={order.paymentStatus}
                tone={order.paymentStatus === "paid" ? "good" : "warm"}
              />
            )}
          </div>
        </div>

        {order.status === "pending_payment" && order.paymentDeadline && (
          <div className="order-callout">
            <Clock3 size={17} />
            <span>
              Payment is due by {formatDateTime(order.paymentDeadline)}. The item stays reserved
              until then.
            </span>
          </div>
        )}

        <div className="order-layout">
          <div className="order-main">
            <section className="panel">
              <div className="panel-head">
                <h2>Items</h2>
                <span>
                  {order.source === "auction"
                    ? "Auction win"
                    : order.source === "offer"
                      ? "Accepted offer"
                      : order.source === "buy_now"
                        ? "Buy now"
                        : "Cart checkout"}
                </span>
              </div>
              <div className="order-items">
                {order.items.map((item) => (
                  <div key={item.id} className="order-item">
                    <img src={item.image} alt={item.title} />
                    <div>
                      <Link href={`#/product/${item.productId}`}>{item.title}</Link>
                      <span>
                        {item.sellerName} · Qty {item.quantity}
                      </span>
                      {order.auctionId && <em>Winning bid price</em>}
                      {order.offerId && <em>Agreed private offer price</em>}
                    </div>
                    <strong>{formatMoney(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
              <div className="order-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatMoney(order.subtotal)}</strong>
                </div>
                <div>
                  <span>Shipping</span>
                  <strong>{order.shipping ? formatMoney(order.shipping) : "Free"}</strong>
                </div>
                <div className="is-total">
                  <span>Total</span>
                  <strong>{formatMoney(order.total)}</strong>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Delivery</h2>
                <span>{order.shipment ? "Manual tracking" : "Waiting for payment"}</span>
              </div>
              {order.shipment ? (
                <>
                  <ol className="timeline">
                    {shipmentSteps.map((step, index) => {
                      const event = order.shipment?.events.find((item) => item.status === step);
                      const done = activeIndex >= index;
                      return (
                        <li key={step} className={done ? "is-done" : ""}>
                          <span className="timeline-dot">{done ? <Check size={11} /> : index + 1}</span>
                          <div>
                            <strong>{step.replaceAll("_", " ")}</strong>
                            <span>
                              {event ? `${formatDateTime(event.at)} · ${event.note}` : "Pending"}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {order.shipment.provider && (
                    <p className="shipment-provider">
                      Provider: {order.shipment.provider}
                      {order.shipment.awb ? ` · AWB ${order.shipment.awb}` : ""}
                    </p>
                  )}
                  <p className="fineprint">
                    Delivery updates are set manually in this demo. No courier is connected.
                  </p>
                </>
              ) : (
                <p className="panel-empty">Delivery starts after payment is confirmed.</p>
              )}
            </section>

            {canUpdateDelivery && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Update delivery</h2>
                  <span>Seller action</span>
                </div>
                <div className="inline-form-row">
                  <Field label="New status">
                    <select
                      value={shipmentStatus}
                      onChange={(event) => setShipmentStatus(event.target.value)}
                    >
                      <option value="">Choose a status</option>
                      {sellerShipmentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    type="button"
                    className="button button-olive"
                    disabled={!shipmentStatus}
                    onClick={async () => {
                      const result = await advanceShipment(
                        order.id,
                        shipmentStatus as NonNullable<Order["shipment"]>["status"],
                      );
                      if (result.ok) {
                        toast("Delivery updated.", "success");
                        setShipmentStatus("");
                      } else {
                        toast(result.error, "error");
                      }
                    }}
                  >
                    Save update
                  </button>
                </div>
              </section>
            )}

            {canReview && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Review the seller</h2>
                  <span>Delivery complete</span>
                </div>
                <div className="review-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={star <= rating ? "is-active" : ""}
                      onClick={() => setRating(star)}
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <Field label="Comment" hint="Optional">
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Exactly as described. Packed with care."
                  />
                </Field>
                <button
                  type="button"
                  className="button button-olive"
                  onClick={async () => {
                    const result = await addReview(order.id, rating, comment);
                    if (result.ok) toast("Review posted. Thank you.", "success");
                    else toast(result.error, "error");
                  }}
                >
                  Post review
                </button>
              </section>
            )}

            {existingReview && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Your review</h2>
                  <span>{formatDate(existingReview.createdAt)}</span>
                </div>
                <div className="review-summary">
                  <strong>{"★".repeat(existingReview.rating)}</strong>
                  <p>{existingReview.comment || "No comment left."}</p>
                </div>
              </section>
            )}
          </div>

          <aside className="order-aside">
            <div className="summary-card">
              <h2>Order summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatMoney(order.subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <strong>{order.shipping ? formatMoney(order.shipping) : "Free"}</strong>
              </div>
              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>{formatMoney(order.total)}</strong>
              </div>

              {canPay && (
                <button
                  type="button"
                  className="button button-olive summary-cta"
                  onClick={async () => {
                    const result = await payOrders([order.id]);
                    if (result.ok) toast("Payment confirmed.", "success");
                    else toast(result.error, "error");
                  }}
                >
                  <CreditCard size={15} /> Pay {formatMoney(order.total)}
                </button>
              )}

              {(isSeller || isAdmin) &&
                order.paymentMethod === "cod" &&
                order.status === "delivered" &&
                order.paymentStatus === "pending" && (
                  <button
                    type="button"
                    className="button button-olive summary-cta"
                    onClick={async () => {
                      const result = await confirmCodPayment(order.id);
                      if (result.ok) toast("Cash received and recorded.", "success");
                      else toast(result.error, "error");
                    }}
                  >
                    Confirm cash received
                  </button>
                )}

              {canReturn && (
                <button
                  type="button"
                  className="button button-ghost summary-cta"
                  onClick={async () => {
                    const result = await requestReturn(order.id);
                    if (result.ok) toast("Return requested.");
                    else toast(result.error, "error");
                  }}
                >
                  <RotateCcw size={14} /> Request return
                </button>
              )}

              {canCancel && (
                <button
                  type="button"
                  className="button button-ghost summary-cta"
                  onClick={async () => {
                    if (!window.confirm("Cancel this order?")) return;
                    const result = await cancelOrder(order.id);
                    if (result.ok) toast("Order cancelled.");
                    else toast(result.error, "error");
                  }}
                >
                  <X size={14} /> Cancel order
                </button>
              )}

              <p className="payment-demo-note">
                {order.paymentStatus === "paid"
                  ? "Payment received. The seller will arrange pickup."
                  : order.status === "delivered"
                    ? "Cash on delivery is collected at the doorstep."
                    : "Payment is due on delivery."}
              </p>
            </div>

            <div className="panel order-address">
              <h3>
                <MapPin size={14} /> Delivery address
              </h3>
              <strong>{order.address.name}</strong>
              <p>
                {order.address.line1}
                {order.address.line2 ? `, ${order.address.line2}` : ""}
                <br />
                {order.address.city}, {order.address.state} {order.address.pincode}
              </p>
              <span>{order.address.phone}</span>
            </div>

            <div className="panel order-contact">
              <h3>
                <Truck size={14} /> {isSeller ? "Buyer" : "Seller"}
              </h3>
              <strong>{isSeller ? buyer?.name : seller?.name}</strong>
              <span>{isSeller ? buyer?.email : seller?.email}</span>
              {!isSeller && seller && (
                <Link href={`#/products?q=${encodeURIComponent(seller.name)}`} className="text-link">
                  See their shop <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          </aside>
        </div>

        <div className="order-footnote">
          <ShieldCheck size={15} />
          <span>
            Keep the delivery address accurate. Auctions and accepted offers have a limited payment
            window.
          </span>
          <button
            type="button"
            className="text-link"
            onClick={() => navigate(isSeller ? "#/seller?tab=orders" : "#/account?tab=orders")}
          >
            All orders
          </button>
        </div>
      </div>
    </main>
  );
}
