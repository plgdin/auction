import { ArrowRight, LockKeyhole, Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Link, navigate } from "../components/Link";
import { formatMoney } from "../lib/format";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";

export function CartPage() {
  const { cart, cartSubtotal, user, setCartQuantity, removeFromCart, db } = useStore();

  const sellers = [...new Set(cart.map((entry) => entry.product.sellerId))];
  const shipping = sellers.reduce((total, sellerId) => {
    const items = cart.filter((entry) => entry.product.sellerId === sellerId);
    const subtotal = items.reduce(
      (sum, entry) => sum + entry.product.askingPrice * entry.line.quantity,
      0,
    );
    if (subtotal >= db.settings.freeShippingThreshold) return total;
    return total + Math.max(...items.map((entry) => entry.product.shippingFee));
  }, 0);
  const total = cartSubtotal + shipping;

  if (!cart.length) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <ShoppingBag size={38} />
          <h2>
            Your cart is <em>quiet.</em>
          </h2>
          <p>Find something one-of-one and it will wait here for you.</p>
          <Link href="#/products" className="button button-olive">
            Browse the rail <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="section-wrap">
        <div className="page-header">
          <div>
            <div className="eyebrow">YOUR CART</div>
            <h1>
              A good <em>shortlist.</em>
            </h1>
            <p>{cart.length} {cart.length === 1 ? "piece" : "pieces"} from independent sellers.</p>
          </div>
          <Link href="#/products" className="text-link">
            Keep browsing
          </Link>
        </div>

        <div className="cart-layout">
          <div className="cart-items">
            {sellers.map((sellerId) => {
              const items = cart.filter((entry) => entry.product.sellerId === sellerId);
              const seller = db.users.find((candidate) => candidate.id === sellerId);
              return (
                <section key={sellerId} className="cart-seller-group">
                  <div className="cart-seller-head">
                    <span>Sold by</span>
                    <strong>{seller?.name || items[0].product.sellerName}</strong>
                    <Link href={`#/products?q=${encodeURIComponent(seller?.name || "")}`}>
                      View shop
                    </Link>
                  </div>
                  {items.map(({ product, line }) => (
                    <article key={product.id} className="cart-item">
                      <Link href={`#/product/${product.id}`} className="cart-item-image">
                        <img src={product.images[0]} alt={product.title} />
                      </Link>
                      <div className="cart-item-info">
                        <div>
                          <Link href={`#/product/${product.id}`} className="cart-item-title">
                            {product.title}
                          </Link>
                          <span>
                            {product.condition} · {product.size || "One size"} · {product.location}
                          </span>
                        </div>
                        <div className="cart-item-controls">
                          {product.isUnique ? (
                            <span className="one-of-one">One of one</span>
                          ) : (
                            <div className="quantity-stepper">
                              <button
                                type="button"
                                onClick={() => setCartQuantity(product.id, line.quantity - 1)}
                                aria-label="Decrease quantity"
                              >
                                <Minus size={13} />
                              </button>
                              <span>{line.quantity}</span>
                              <button
                                type="button"
                                onClick={() => setCartQuantity(product.id, line.quantity + 1)}
                                aria-label="Increase quantity"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            className="remove-link"
                            onClick={() => {
                              removeFromCart(product.id);
                              toast("Removed from cart.");
                            }}
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        </div>
                      </div>
                      <div className="cart-item-price">
                        <strong>{formatMoney(product.askingPrice * line.quantity)}</strong>
                        {line.quantity > 1 && <span>{formatMoney(product.askingPrice)} each</span>}
                        <em>
                          {product.shippingFee === 0
                            ? "Free shipping"
                            : `+ ${formatMoney(product.shippingFee)} shipping`}
                        </em>
                      </div>
                    </article>
                  ))}
                </section>
              );
            })}
            <div className="cart-note">
              <Truck size={16} />
              <span>
                Shipping is calculated per seller. Free over {formatMoney(db.settings.freeShippingThreshold)}.
                Delivery is available across Trivandrum pincodes starting with 695.
              </span>
            </div>
          </div>

          <aside className="cart-summary">
            <div className="summary-card">
              <h2>Order summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatMoney(cartSubtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <strong>{shipping ? formatMoney(shipping) : "Free"}</strong>
              </div>
              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>{formatMoney(total)}</strong>
              </div>
              <p className="summary-note">
                {sellers.length > 1
                  ? `This cart has ${sellers.length} sellers. You will check out once and each seller is notified separately.`
                  : "One seller. One tidy checkout."}
              </p>
              <button
                type="button"
                className="button button-olive summary-cta"
                onClick={() => {
                  if (!user) {
                    toast("Sign in to check out.", "error");
                    navigate("#/login");
                    return;
                  }
                  navigate("#/checkout");
                }}
              >
                <LockKeyhole size={15} /> Checkout
              </button>
              <div className="summary-trust">
                <span>Buyer protection</span>
                <span>Private offers</span>
                <span>Doorstep delivery</span>
              </div>
            </div>
            <div className="summary-aside">
              <strong>Not ready?</strong>
              <p>Save a piece to your watchlist and come back when you are sure.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
