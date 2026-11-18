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
import { formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { BUYER_PLATFORM_FEE_PAISE, platformFeeGst } from "../lib/sellerMath";
import { toast } from "../lib/toast";
import { isValidIndianPincode } from "../lib/delivery";
import { supabase } from "../lib/supabase";
import { payWithRazorpay } from "../lib/payments";

export function CheckoutPage() {
  const route = useRoute();
  const { db, user, cart, refreshRemoteCommerce, createOrders, payOrders } = useStore();
  const [selectedAddress, setSelectedAddress] = useState(
    user?.addresses.find((address) => address.isDefault)?.id || user?.addresses[0]?.id || "",
  );
  const [showAddressForm, setShowAddressForm] = useState(!user?.addresses.length);
  const [payment, setPayment] = useState<"upi" | "card" | "cod">("upi");
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
  const platformFee = BUYER_PLATFORM_FEE_PAISE;
  const gst = platformFeeGst(platformFee);
  const shipping = sellerIds.reduce((sum, sellerId) => {
    const sellerLines = lines.filter((line) => line.product.sellerId === sellerId);
    const sellerSubtotal = sellerLines.reduce((amount, line) => amount + line.unitPrice * line.quantity, 0);
    return sum + (sellerSubtotal >= 199900 ? 0 : Math.max(0, ...sellerLines.map((line) => line.product.shippingFee)));
  }, 0);
  const total = subtotal + shipping + platformFee + gst;
  const address = user?.addresses.find((item) => item.id === selectedAddress);
  const serviceable = address
    ? isValidIndianPincode(address.pincode)
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
      toast("Enter a valid six-digit Indian PIN code.", "error");
      return;
    }
    setPlacing(true);

    let createdOrderIds: string[] = [];
    let checkoutGroupId: string | undefined = undefined;

    try {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const allUuids =
        lines.every(({ product }) => uuidPattern.test(product.id)) &&
        (!offerId || uuidPattern.test(offerId));

      if (allUuids) {
        let { data: created, error } = await supabase.rpc("checkout_create_orders", {
          p_address: address,
          p_lines: productId || offerId
            ? []
            : lines.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
          p_product_id: productId ?? null,
          p_offer_id: offerId ?? null,
          p_quantity: 1,
          p_payment_method: payment,
        });

        // If listing is locked/unavailable, check if this buyer has a stale pending order and release it
        if (error && (error.message.includes("Listing is not available") || error.message.includes("not available"))) {
          try {
            const { data: staleOrders } = await supabase
              .from("orders")
              .select("id")
              .eq("status", "pending_payment");
            if (staleOrders && staleOrders.length > 0) {
              for (const stale of staleOrders) {
                await supabase.rpc("cancel_order", { p_order_id: stale.id, p_reason: "Checkout retry" });
              }
              const retry = await supabase.rpc("checkout_create_orders", {
                p_address: address,
                p_lines: productId || offerId
                  ? []
                  : lines.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
                p_product_id: productId ?? null,
                p_offer_id: offerId ?? null,
                p_quantity: 1,
                p_payment_method: payment,
              });
              created = retry.data;
              error = retry.error;
            }
          } catch {
            // retry cleanup ignored
          }
        }

        if (!error && created?.orderIds?.length) {
          createdOrderIds = created.orderIds as string[];
          checkoutGroupId = created.checkoutGroupId;
        }
      }

      // If Supabase was not applicable or threw, fall back gracefully to local store order creation
      if (!createdOrderIds.length) {
        const localRes = createOrders({
          addressId: selectedAddress,
          productId,
          offerId,
        });
        if (!localRes.ok) {
          throw new Error(localRes.error || "The order could not be created.");
        }
        createdOrderIds = localRes.orderIds;
      }

      if (payment !== "cod") {
        try {
          await payWithRazorpay(
            {
              checkoutGroupId,
              orderId: createdOrderIds[0],
              amountPaise: Math.round(total * 100),
              orderNumber: createdOrderIds[0]?.slice(0, 8),
            },
            { name: user.name, email: user.email, contact: user.phone },
          );
        } catch (payErr: any) {
          if (createdOrderIds[0] && payErr?.message?.includes("cancelled")) {
            try {
              await supabase.rpc("cancel_order", {
                p_order_id: createdOrderIds[0],
                p_reason: "Payment cancelled by user",
              });
            } catch {
              // cancellation cleanup ignored
            }
          }
          throw payErr;
        }

        payOrders(createdOrderIds);
        toast("Payment confirmed. Your order is in progress.", "success");
      } else {
        if (createdOrderIds.some((id) => id.startsWith("o-"))) {
          payOrders(createdOrderIds);
        }
        toast("Order placed. Payment is due on delivery.", "success");
      }

      await refreshRemoteCommerce();
      navigate(`#/orders/${createdOrderIds[0]}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not complete checkout.", "error");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <main className="page-shell checkout-page">
      <div className="section-wrap">
        <div className="page-header">
          <div>
            <div className="eyebrow">CHECKOUT</div>
            <h1>Complete your order.</h1>
            <p>Review delivery, payment, and your final total.</p>
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
                  <p>Doorstep delivery across India. Add a valid six-digit PIN code.</p>
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
                        {!isValidIndianPincode(item.pincode) && (
                          <span className="address-warning">Enter a valid six-digit Indian PIN code</span>
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
                <label className={`payment-option ${payment === "upi" ? "is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === "upi"}
                    onChange={() => setPayment("upi")}
                  />
                  <Smartphone size={20} />
                  <span>
                    <strong>UPI</strong>
                    <em>Google Pay, PhonePe, Paytm</em>
                  </span>
                  {payment === "upi" && <Check size={16} />}
                </label>
                <label className={`payment-option ${payment === "card" ? "is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === "card"}
                    onChange={() => setPayment("card")}
                  />
                  <CreditCard size={20} />
                  <span>
                    <strong>Card</strong>
                    <em>Credit or debit</em>
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
                {payment === "cod"
                  ? "No online payment is due now. Pay the delivery partner when your order arrives."
                  : `Pay securely with ${payment === "upi" ? "UPI" : "your card"} through Razorpay. Your order is confirmed after payment.`}
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
                <span>Delivery</span>
                <strong>{formatMoney(shipping)}</strong>
              </div>
              <div className="summary-row">
                <span>Platform fee</span>
                <strong>{formatMoney(platformFee)}</strong>
              </div>
              <div className="summary-row">
                <span>GST on platform fee (18%)</span>
                <strong>{formatMoney(gst)}</strong>
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
                onClick={placeOrder}
                disabled={placing || !address || !serviceable}
              >
                {placing ? "Starting secure checkout…" : payment === "cod" ? "Place order" : `Pay ${formatMoney(total)}`} <ArrowRight size={15} />
              </button>
              <div className="summary-trust">
                <span>
                  <ShieldCheck size={13} /> Secure checkout
                </span>
                <span>
                  <Truck size={13} /> Delivery across India
                </span>
              </div>
            </div>
            <div className="summary-aside">
              <strong>Need to change something?</strong>
              <p>
                You can cancel free of charge any time before the parcel is picked up. After
                pickup, the order can&apos;t be cancelled.
              </p>
              <p>
                Won an auction? Auction orders are final — no cancellation, and no returns or
                refunds unless the item is damaged or not as described.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
