import { ExternalLink, ShieldCheck, Truck } from "lucide-react";
import { Link } from "../../components/Link";
import { ShipmentStepper, nextShipmentAction } from "../../components/seller/Parts";
import { StatusPill } from "../../components/Ui";
import { formatDateTime, formatMoney } from "../../lib/format";
import { useStore } from "../../lib/store";
import { toast } from "../../lib/toast";

/**
 * Orders — the seller's part of "we handle delivery". The rider does the legwork;
 * the seller packs the parcel and confirms the hand-over. One button per state.
 */
export function OrdersTab() {
  const { db, user, advanceShipment, bookCourierPickup } = useStore();
  if (!user) return null;

  const myOrders = [...db.orders.filter((order) => order.sellerId === user.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (!myOrders.length) {
    return (
      <div className="panel orders-empty">
        <p className="panel-empty">
          No orders yet. When a buyer pays, they appear here with the delivery label ready — pickup from your
          door, payout within 5 business days of buyer approval.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-section">
      <p className="orders-intro">
        Buyer paid. A rider comes to your door, takes the parcel, and is gone — pack the parcel for
        the pickup, confirm each step below, and keep the piece ready.
      </p>

      {myOrders.map((order) => {
        const buyer = db.users.find((item) => item.id === order.buyerId);
        const action = nextShipmentAction(order);
        const closed = ["cancelled", "expired", "returned"].includes(order.status);
        const awaitingPayment = order.paymentStatus !== "paid";
        return (
          <article key={order.id} className={`order-card ${closed ? "is-closed" : ""}`}>
            <header className="order-card-head">
              <div>
                <strong>{order.number}</strong>
                <span>{formatDateTime(order.createdAt)} · {buyer?.name ?? "Buyer"}</span>
              </div>
              <div className="order-card-pills">
                <StatusPill status={order.status} />
                <StatusPill status={order.paymentStatus} tone={order.paymentStatus === "paid" ? "good" : "warm"} />
                {order.source === "auction" && <span className="status-pill status-neutral">Live auction win</span>}
                {order.source === "offer" && <span className="status-pill status-neutral">Accepted offer</span>}
              </div>
              <Link href={`#/orders/${order.id}`} className="text-link">
                Full receipt <ExternalLink size={12} />
              </Link>
            </header>

            <div className="order-card-grid">
              <div className="order-card-items">
                {order.items.map((item) => (
                  <div key={item.id}>
                    <img src={item.image} alt={item.title} />
                    <span>
                      <strong>{item.title}</strong>
                      <em>
                        ×{item.quantity} · {formatMoney(item.price)}
                      </em>
                    </span>
                  </div>
                ))}
              </div>

              <address className="order-card-label">
                <span>Deliver to</span>
                <strong>{order.address.name}</strong>
                <p>
                  {order.address.line1}
                  {order.address.line2 ? `, ${order.address.line2}` : ""}
                  <br />
                  {order.address.city} {order.address.pincode}
                </p>
                <em>{order.address.phone}</em>
              </address>

              <div className="order-card-total">
                <span>Order total</span>
                <strong>{formatMoney(order.total)}</strong>
                <em>incl. rider pickup & drop</em>
              </div>
            </div>

            {!awaitingPayment && !closed && (
              <footer className="order-card-delivery">
                <ShipmentStepper order={order} />
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  {order.status === "processing" && (!order.shipment || order.shipment.status === "pending_pickup") && (
                    <button
                      type="button"
                      className="button button-olive order-card-btn"
                      onClick={async () => {
                        const result = await bookCourierPickup(order.id);
                        if (result.ok) toast("Courier pickup booked! Shipping label ready.", "success");
                        else toast(result.error, "error");
                      }}
                    >
                      <Truck size={14} /> Book Courier Pickup
                    </button>
                  )}
                  {action && (
                    <button
                      type="button"
                      className="button button-ghost order-card-btn"
                      onClick={async () => {
                        const result = await advanceShipment(order.id, action.status);
                        if (result.ok) toast("Delivery updated. The buyer sees it instantly.", "success");
                        else toast(result.error, "error");
                      }}
                    >
                      {action.label}
                    </button>
                  )}
                </div>
              </footer>
            )}

            {order.status === "delivered" && (
              <div className="order-card-waiting" style={{ background: "rgba(235, 230, 215, 0.5)", borderRadius: "6px", padding: "10px 14px", marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={16} />
                <span>
                  <strong>Escrow Hold Active:</strong> Funds locked until buyer inspects or 48h passes. Payout is released automatically once approved.
                </span>
              </div>
            )}
            {awaitingPayment && <p className="order-card-waiting">Buyer's payment is {order.paymentStatus}. Nothing to do yet.</p>}
            {closed && <p className="order-card-waiting">This order is closed ({order.status.replace("_", " ")}). No payout from it.</p>}
          </article>
        );
      })}
    </div>
  );
}
