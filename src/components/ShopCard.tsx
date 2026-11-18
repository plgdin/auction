import { Check, Heart, ShoppingBag } from "lucide-react";
import { Link, navigate } from "./Link";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/format";
import { toast } from "../lib/toast";
import type { Product } from "../lib/types";
import { animateCartAdded } from "../lib/cartAnimation";

/**
 * The torn-paper product card used across the shop and saved lists.
 */
export function ShopCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { favorites, toggleFavorite, addToCart, cart } = useStore();
  const saved = favorites.includes(product.id);
  const inCart = cart.some((entry) => entry.product.id === product.id);
  const condition =
    product.condition === "Good"
      ? "Gently Used"
      : product.condition === "Fair"
        ? "Well Used"
        : product.condition === "Like new"
          ? "Like New"
          : product.condition;

  return (
    <article className="shop-card">
      <div className="shop-card-media">
        <Link href={`/product/${product.id}`} aria-label={`View ${product.title}`}>
          <img
            src={product.images[0]}
            alt={product.title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
          />
        </Link>
        <span className="shop-card-tape" aria-hidden="true" />
        <button
          type="button"
          className={`shop-heart ${saved ? "is-saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${product.title}`}
          aria-pressed={saved}
          onClick={() => {
            toggleFavorite(product.id);
            toast(saved ? "Removed from saved." : "Saved to your watchlist.", "success");
          }}
        >
          <Heart size={13} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="shop-card-info">
        <div className="shop-card-main">
          <div className="shop-card-topline">
            <span className="shop-card-category">{product.category}</span>
            <span className="shop-card-condition-tag">{condition}</span>
          </div>
          <Link href={`/product/${product.id}`} className="shop-card-title">
            {product.title}
          </Link>
          {product.description && (
            <p className="shop-card-desc">{product.description}</p>
          )}
          <p className="shop-card-meta">
            <span>Size: {product.size || "One size"}</span> <span>·</span> {condition}
            {product.brand && <> <span>·</span> {product.brand}</>}
          </p>
        </div>

        <div className="shop-card-buy">
          <div className="shop-card-price-wrap">
            <span className="shop-card-price-label">Price</span>
            <strong className="shop-card-price">{formatMoney(product.askingPrice)}</strong>
          </div>
          <button
            type="button"
            className={`shop-cart ${inCart ? "is-in-cart" : ""}`}
            aria-label={inCart ? `In cart: ${product.title}` : `Add ${product.title} to cart`}
            onClick={() => {
              if (inCart) {
                navigate("/cart");
                return;
              }
              const result = addToCart(product.id);
              if (result.ok) {
                animateCartAdded();
                toast("Added to cart.", "success");
              }
              else toast(result.error, "error");
            }}
          >
            {inCart ? (
              <Check size={14} strokeWidth={2.4} />
            ) : (
              <ShoppingBag size={14} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
