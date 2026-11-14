import { ArrowUpRight, Check, Heart, ShoppingBag, Tag } from "lucide-react";
import { promptAuth } from "../lib/authGate";
import { formatMoney } from "../lib/format";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Product } from "../lib/types";
import { Link, navigate } from "./Link";
import { StatusPill } from "./Ui";

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { db, user, favorites, toggleFavorite, addToCart, cart } = useStore();
  const saved = favorites.includes(product.id);
  const inCart = cart.some((entry) => entry.product.id === product.id);
  const auction = db.auctions.find(
    (entry) =>
      entry.productId === product.id && ["live", "scheduled"].includes(entry.status),
  );
  const available = product.status === "active" && !auction;

  return (
    <article className={`product-card ${compact ? "is-compact" : ""} ${available ? "" : "is-unavailable"}`}>
      <div className="product-image" style={{ backgroundColor: product.color }}>
        <Link href={`#/product/${product.id}`} className="product-image-link" aria-label={`View ${product.title}`}>
          <img src={product.images[0]} alt={product.title} loading="lazy" />
        </Link>
        {product.tag && <span className="product-tag">{product.tag}</span>}
        <button
          type="button"
          className={`favorite-button ${saved ? "is-saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${product.title}`}
          aria-pressed={saved}
          onClick={() => {
            if (!user) {
              promptAuth(`#/product/${product.id}`, "Sign in to save pieces to your watchlist.");
              return;
            }
            void toggleFavorite(product.id);
            toast(saved ? "Removed from saved." : "Saved to your watchlist.", "success");
          }}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        {auction ? (
          <Link href={`#/auction/${auction.id}`} className="card-availability is-auction">
            {auction.status === "live" ? "LIVE AUCTION" : "UPCOMING AUCTION"} <ArrowUpRight size={12} />
          </Link>
        ) : (
          !available && (
            <span className="card-availability">
              <StatusPill status={product.status} />
            </span>
          )
        )}
        {available && (
          <button
            type="button"
            className="quick-add"
            onClick={async () => {
              if (!user) {
                promptAuth(`#/product/${product.id}`, "Sign in to add this piece to your cart.");
                return;
              }
              if (inCart) {
                navigate("#/cart");
                return;
              }
              const result = await addToCart(product.id);
              if (result.ok) {
                toast("Added to cart.", "success");
              } else {
                toast(result.error, "error");
              }
            }}
          >
            {inCart ? "In cart" : "Add to cart"}
            {inCart ? <Check size={15} /> : <ShoppingBag size={15} />}
          </button>
        )}
      </div>
      <div className="product-eyebrow">
        <span className="condition-line">{product.condition}</span>
        <span>{product.size || "One size"}</span>
      </div>
      <div className="product-name-row">
        <Link href={`#/product/${product.id}`}>{product.title}</Link>
        <span className="product-price">{formatMoney(product.askingPrice)}</span>
      </div>
      <div className="card-meta">
        <span>{product.sellerName}</span>
        <span>{product.location.split(",")[0]}</span>
      </div>
      {product.allowOffers && available && (
        <Link href={`#/product/${product.id}?offer=1`} className="offer-hint">
          <Tag size={12} /> Make an offer
        </Link>
      )}
    </article>
  );
}
