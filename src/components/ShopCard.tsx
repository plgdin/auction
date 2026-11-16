import { Heart, ShoppingBag } from "lucide-react";
import { Link, navigate } from "./Link";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/format";
import { toast } from "../lib/toast";
import type { Product } from "../lib/types";

/**
 * The torn-paper product card used across the shop and saved lists.
 */
export function ShopCard({ product }: { product: Product }) {
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
        <Link href={`#/product/${product.id}`} aria-label={`View ${product.title}`}>
          <img src={product.images[0]} alt={product.title} loading="lazy" />
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
        <Link href={`#/product/${product.id}`} className="shop-card-title">
          {product.title}
        </Link>
        <p className="shop-card-meta">
          Size: {product.size || "One size"} <span>·</span> {condition}
        </p>
        <div className="shop-card-buy">
          <strong className="shop-card-price">{formatMoney(product.askingPrice)}</strong>
          <button
            type="button"
            className={`shop-cart ${inCart ? "is-in-cart" : ""}`}
            aria-label={inCart ? `View cart with ${product.title}` : `Add ${product.title} to cart`}
            onClick={() => {
              if (inCart) {
                navigate("#/cart");
                return;
              }
              const result = addToCart(product.id);
              if (result.ok) toast("Added to cart.", "success");
              else toast(result.error, "error");
            }}
          >
            <ShoppingBag size={14} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </article>
  );
}
