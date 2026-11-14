import { useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Smartphone,
  Truck,
} from "lucide-react";
import { AddressForm } from "../components/AddressForm";
import { Link, navigate } from "../components/Link";
import { Field } from "../components/Ui";
import { formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";

export function CheckoutPage() {
  const route = useRoute();
  const { db, user, cart, createOrders, payOrders, onlinePaymentsEnabled } = useStore();
  const [selectedAddress, setSelectedAddress] = useState(
    user?.addresses.find((address) => address.isDefault)?.id || user?.addresses[0]?.id || "",
  );
  const [showAddressForm, setShowAddressForm] = useState(!user?.addresses.length);
  const [payment, setPayment] = useState<"upi" | "card" | "cod">("cod");
  const [placing, setPlacing] = useState(false);

  const productId = route.query.get("product") || undefined;
  const offerId = route.query.get("offer") || undefined;

  const offer = offerId ? db.offers.find((item) => item.id === offerId) : undefined;
  const singleProduct = productId
    ? db.products.find((item) => item.id === productId)
    : offer
      ? db.products.find((item) => item.id === offer.productId)
      : undefined;

  const lines = useMemo(() => {
    if (singleProduct) {
      return [
        {
          product: singleProduct,
          quantity: 1,
          unitPrice: offer ? offer.amount : singleProduct.askingPrice,
        },
      ];
    }
    return cart.map((entry) => ({
      product: entry.product,
      quantity: entry.line.quantity,
      unitPrice: entry.product.askingPrice,
    }));
  }, [cart, singleProduct, offer]);

  const subtotal = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
  const sellerIds = [...new Set(lines.map((line) => line.product.sellerId))];
  const shipping = sellerIds.reduce((total, sellerId) => {
    const group = lines.filter((line) => line.product.sellerId === sellerId);
    const groupSubtotal = group.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    if (groupSubtotal >= db.settings.freeShippingThreshold) return total;
    return total + Math.max(...group.map((line) => line.product.shippingFee));
  }, 0);
  const total = subtotal + shipping;
  const address = user?.addresses.find((item) => item.id === selectedAddress);
  const serviceable = address
    ? db.settings.serviceablePrefixes.some((prefix) => address.pincode.startsWith(prefix))
    : false;

  if (!user) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <LockKeyhole size={38} />
          <h2>Sign in to check out.</h2>
          <p>Your cart is saved. Sign in or create an account to continue.</p>
          <div className="modal-actions center">
            <Link href="#/login" className="button button-olive">
              Sign in
            </Link>
            <Link href="#/register" className="button button-ghost">
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!lines.length) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Truck size={38} />
          <h2>Nothing to check out.</h2>
          <p>Your cart is empty right now.</p>
          <Link href="#/products" className="button button-olive">
            Browse listings
          </Link>
        </div>
      </main>
    );
  }

  if (offer && offer.buyerId !== user.id) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <LockKeyhole size={38} />
          <h2>This offer is not yours.</h2>
          <Link href="#/account?tab=offers" className="button button-olive">
            My offers
          </Link>
        </div>
      </main>
    );
  }

  if (offer && !["accepted", "converted"].includes(offer.status)) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <LockKeyhole size={38} />
          <h2>This offer is not ready for checkout.</h2>
          <p>The seller may not have accepted it, or the payment window has passed.</p>
          <Link href="#/account?tab=offers" className="button button-olive">
            Back to my offers
          </Link>
        </div>
      </main>
    );
  }

  const placeOrder = async () => {
    if (!selectedAddress || !address) {
      toast("Choose or add a delivery address.", "error");
      return;
    }
    if (!serviceable) {
      toast("We do not deliver to this pincode yet.", "error");
      return;
    }
    setPlacing(true);
    const created = await createOrders({
      addressId: selectedAddress,
      productId,
      offerId,
      paymentMethod: payment,
    });
    if (!created.ok) {
      setPlacing(false);
      toast(created.error, "error");
      return;
    }
    if (payment !== "cod") {
      const paid = await payOrders(created.orderIds);
      setPlacing(false);
      if (!paid.ok) {
        toast(paid.error, "error");
        navigate(`#/orders/${created.orderIds[0]}`);
        return;
      }
      toast("Payment confirmed. Your order is on its way to the seller.", "success");
      navigate(`#/orders/${created.orderIds[0]}`);
      return;
    }
    setPlacing(false);
    toast("Order placed. Payment is due on delivery.", "success");
    navigate(`#/orders/${created.orderIds[0]}`);
  };

  return (
    <main className="page-shell">
      <div className="section-wrap">
        <div className="page-header">
          <div>
            <div className="eyebrow">CHECKOUT</div>
            <h1>
              Almost <em>yours.</em>
            </h1>
            <p>Confirm the address, then complete the order.</p>
          </div>
          <Link href={offer ? "#/account?tab=offers" : "#/cart"} className="text-link">
            Back
          </Link>
        </div>

        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-block">
              <div className="checkout-block-head">
                <span className="step-number">01</span>
                <div>
                  <h2>Delivery address</h2>
                  <p>Doorstep delivery only. No meeting the seller.</p>
                </div>
                <button type="button" className="text-link" onClick={() => setShowAddressForm((open) => !open)}>
                  {showAddressForm ? "Cancel" : "Add new"}
                </button>
              </div>

              {user.addresses.length > 0 && (
                <div className="address-options">
                  {user.addresses.map((item) => (
                    <label
                      key={item.id}
                      className={`address-option ${selectedAddress === item.id ? "is-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddress === item.id}
                        onChange={() => setSelectedAddress(item.id)}
                      />
                      <div>
                        <strong>
                          {item.label} {item.isDefault && <em>Default</em>}
                        </strong>
                        <span>
                          {item.name} · {item.phone}
                        </span>
                        <p>
                          {item.line1}
                          {item.line2 ? `, ${item.line2}` : ""}, {item.city}, {item.state} {item.pincode}
                        </p>
                        {!db.settings.serviceablePrefixes.some((prefix) => item.pincode.startsWith(prefix)) && (
                          <span className="address-warning">Not in our delivery area yet</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {showAddressForm && (
                <AddressForm
                  onSaved={() => {
                    setShowAddressForm(false);
                    const latest = useStore;
                    void latest;
                  }}
                  onCancel={user.addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
                />
              )}
            </section>

            <section className="checkout-block">
              <div className="checkout-block-head">
                <span className="step-number">02</span>
                <div>
                  <h2>Payment</h2>
                  <p>Choose how you want to pay.</p>
                </div>
              </div>
              <div className="payment-options">
                <label
                  className={`payment-option ${payment === "upi" ? "is-selected" : ""} ${onlinePaymentsEnabled ? "" : "is-disabled"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === "upi"}
                    disabled={!onlinePaymentsEnabled}
                    onChange={() => setPayment("upi")}
                  />
                  <Smartphone size={20} />
                  <span>
                    <strong>UPI</strong>
                    <em>{onlinePaymentsEnabled ? "Google Pay, PhonePe, Paytm" : "Coming soon"}</em>
                  </span>
                  {payment === "upi" && <Check size={16} />}
                </label>
                <label
                  className={`payment-option ${payment === "card" ? "is-selected" : ""} ${onlinePaymentsEnabled ? "" : "is-disabled"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === "card"}
                    disabled={!onlinePaymentsEnabled}
                    onChange={() => setPayment("card")}
                  />
                  <CreditCard size={20} />
                  <span>
                    <strong>Card</strong>
                    <em>{onlinePaymentsEnabled ? "Credit or debit" : "Coming soon"}</em>
                  </span>
                  {payment === "card" && <Check size={16} />}
                </label>
                <label className={`payment-option ${payment === "cod" ? "is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === "cod"}
                    onChange={() => setPayment("cod")}
                  />
                  <Banknote size={20} />
                  <span>
                    <strong>Cash on delivery</strong>
                    <em>Pay when it arrives</em>
                  </span>
                  {payment === "cod" && <Check size={16} />}
                </label>
              </div>
              <p className="payment-demo-note">
                {onlinePaymentsEnabled
                  ? "Online payments open at checkout. Card details are handled by Razorpay, never by lelam."
                  : "Cash on delivery is live now. UPI and card payments turn on once the Razorpay keys are added."}
              </p>
            </section>

            <section className="checkout-block">
              <div className="checkout-block-head">
                <span className="step-number">03</span>
                <div>
                  <h2>Review</h2>
                  <p>
                    {lines.length} {lines.length === 1 ? "piece" : "pieces"} ·{" "}
                    {sellerIds.length} {sellerIds.length === 1 ? "seller" : "sellers"}
                  </p>
                </div>
              </div>
              <div className="checkout-review">
                {lines.map(({ product, quantity, unitPrice }) => (
                  <div key={product.id} className="checkout-review-item">
                    <img src={product.images[0]} alt={product.title} />
                    <div>
                      <strong>{product.title}</strong>
                      <span>
                        {product.condition} · {product.size || "One size"} · Qty {quantity}
                      </span>
                      <em>{product.sellerName}</em>
                    </div>
                    <strong>{formatMoney(unitPrice * quantity)}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="checkout-aside">
            <div className="summary-card">
              <h2>Order total</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <strong>{shipping ? formatMoney(shipping) : "Free"}</strong>
              </div>
              {offer && (
                <div className="summary-row offer-savings">
                  <span>Agreed offer</span>
                  <strong>{formatMoney(offer.amount)}</strong>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>{formatMoney(total)}</strong>
              </div>
              <div className="checkout-address-mini">
                <MapPin size={14} />
                <span>
                  {address
                    ? `${address.line1}, ${address.city} ${address.pincode}`
                    : "Choose a delivery address"}
                </span>
              </div>
              <button
                type="button"
                className="button button-olive summary-cta"
                onClick={() => void placeOrder()}
                disabled={placing || !address || !serviceable}
              >
                {placing ? "Placing order…" : "Place order"} <ArrowRight size={15} />
              </button>
              <div className="summary-trust">
                <span>
                  <ShieldCheck size={13} /> Secure checkout
                </span>
                <span>
                  <Truck size={13} /> Trivandrum delivery
                </span>
              </div>
            </div>
            <div className="summary-aside">
              <strong>Need to change something?</strong>
              <p>You can cancel before the seller arranges pickup.</p>
            </div>
            <Field label="Order note" hint="Optional. Visible to the seller.">
              <textarea rows={2} placeholder="Gate code, delivery preference…" />
            </Field>
          </aside>
        </div>
      </div>
    </main>
  );
}
