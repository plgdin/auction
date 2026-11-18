import { ArrowRight, LockKeyhole, ShoppingBag, Truck, X } from "lucide-react";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/format";
import { BUYER_PLATFORM_FEE_PAISE, platformFeeGst } from "../lib/sellerMath";
import { Link } from "./Link";

export function CartOverlayCard({ onClose }: { onClose?: () => void }) {
  const { cart, cartSubtotal } = useStore();
  const total = cartSubtotal + BUYER_PLATFORM_FEE_PAISE + platformFeeGst(BUYER_PLATFORM_FEE_PAISE);

  return (
    <section className="cart-genie-card" aria-label="Cart preview">
      <header className="cart-genie-head">
        <div>
          <span>Your shortlist</span>
          <h2>Your cart <em>so far.</em></h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close cart">
          <X size={20} />
        </button>
      </header>
      {cart.length ? (
        <>
          <div className="cart-genie-lines">
            {cart.slice(0, 3).map(({ product, line }) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="cart-genie-line"
                onClick={onClose}
              >
                <img src={product.images[0]} alt="" />
                <span>
                  <strong>{product.title}</strong>
                  <small>{product.condition} · Qty {line.quantity}</small>
                </span>
                <b>{formatMoney(product.askingPrice * line.quantity)}</b>
              </Link>
            ))}
            {cart.length > 3 && (
              <p className="cart-genie-more">And {cart.length - 3} more pieces in your cart</p>
            )}
          </div>
          <div className="cart-genie-bill">
            <div><span>Subtotal</span><strong>{formatMoney(cartSubtotal)}</strong></div>
            <div><span>Platform fee</span><strong>{formatMoney(BUYER_PLATFORM_FEE_PAISE)}</strong></div>
            <div><span>GST on platform fee (18%)</span><strong>{formatMoney(platformFeeGst(BUYER_PLATFORM_FEE_PAISE))}</strong></div>
            <div className="cart-genie-total"><span>Total</span><strong>{formatMoney(total)}</strong></div>
          </div>
          <p className="cart-genie-delivery"><Truck size={15} /> Doorstep delivery across India</p>
          <div className="cart-genie-actions">
            <Link href="/cart" className="button button-ghost" onClick={onClose}>View cart</Link>
            <Link href="/checkout" className="button button-olive" onClick={onClose}>
              <LockKeyhole size={15} /> Checkout <ArrowRight size={15} />
            </Link>
          </div>
        </>
      ) : (
        <div className="cart-genie-empty">
          <ShoppingBag size={28} />
          <p>Your cart is empty. Find a piece to make it yours.</p>
          <Link href="/products" className="button button-olive" onClick={onClose}>Browse pieces</Link>
        </div>
      )}
    </section>
  );
}
