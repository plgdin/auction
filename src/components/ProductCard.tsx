import { ArrowUpRight, Check, Heart, ShoppingBag, Tag } from "lucide-react";
import { formatMoney } from "../lib/format";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Product } from "../lib/types";
import { Link, navigate } from "./Link";
import { StatusPill } from "./Ui";

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { db, favorites, toggleFavorite, addToCart, cart } = useStore();
  const saved = favorites.includes(product.id);
  const inCart = cart.some((entry) => entry.product.id === product.id);
  const auction = db.auctions.find(
    (entry) =>
      entry.productId === product.id && ["live", "scheduled"].includes(entry.status),
  );
  const available = product.status === "active" && !auction;

  return (
    <article className={`product-card group flex flex-col ${compact ? "is-compact" : ""} ${available ? "" : "is-unavailable"}`}>
      <div className="product-image relative aspect-[1/1.18] rounded-2xl overflow-hidden bg-[#14160f] border border-white/10">
        <Link href={`#/product/${product.id}`} className="product-image-link block w-full h-full" aria-label={`View ${product.title}`}>
          <img
            src={product.images[0]}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </Link>
        {product.tag && (
          <span className="product-tag absolute top-3 left-3 z-10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#c89b3c] bg-[#0c0e09]/90 backdrop-blur-md rounded-full border border-[#c89b3c]/40 shadow-md">
            {product.tag}
          </span>
        )}
        <button
          type="button"
          className={`favorite-button absolute top-3 right-3 z-10 size-8 rounded-full flex items-center justify-center bg-[#0c0e09]/80 backdrop-blur-md border border-white/20 transition-all duration-200 hover:scale-110 hover:border-white/40 cursor-pointer ${saved ? "text-rose-500 is-saved" : "text-white"}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${product.title}`}
          aria-pressed={saved}
          onClick={() => {
            toggleFavorite(product.id);
            toast(saved ? "Removed from saved." : "Saved to your watchlist.", "success");
          }}
        >
          <Heart size={15} fill={saved ? "currentColor" : "none"} />
        </button>
        {auction ? (
          <Link href={`#/auction/${auction.id}`} className="card-availability is-auction absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#c89b3c] text-[#0c0e09] shadow-lg">
            {auction.status === "live" ? "LIVE AUCTION" : "UPCOMING AUCTION"} <ArrowUpRight size={13} />
          </Link>
        ) : (
          !available && (
            <span className="card-availability absolute bottom-3 left-3 z-10">
              <StatusPill status={product.status} />
            </span>
          )
        )}
        {available && (
          <button
            type="button"
            className="quick-add absolute bottom-3 inset-x-3 z-10 py-2.5 px-4 rounded-full font-bold text-xs uppercase tracking-wider bg-white text-[#0c0e09] shadow-xl flex items-center justify-center gap-2 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-stone-100 cursor-pointer"
            onClick={() => {
              if (inCart) {
                navigate("#/cart");
                return;
              }
              const result = addToCart(product.id);
              if (result.ok) {
                toast("Added to cart.", "success");
              } else {
                toast(result.error, "error");
              }
            }}
          >
            <span>{inCart ? "In cart" : "Add to cart"}</span>
            {inCart ? <Check size={14} /> : <ShoppingBag size={14} />}
          </button>
        )}
      </div>

      <div className="product-eyebrow flex items-center justify-between mt-3 text-xs uppercase font-bold tracking-[0.14em] text-[#c89b3c]">
        <span className="condition-line">{product.condition}</span>
        <span className="text-white/60">{product.size || "One size"}</span>
      </div>

      <div className="product-name-row flex items-baseline justify-between gap-3 mt-1">
        <Link
          href={`#/product/${product.id}`}
          className="text-base font-bold text-white hover:text-[#c89b3c] transition-colors truncate"
        >
          {product.title}
        </Link>
        <span className="product-price text-base font-extrabold text-white shrink-0 tracking-tight">
          {formatMoney(product.askingPrice)}
        </span>
      </div>

      <div className="card-meta flex items-center justify-between text-xs text-white/50 mt-1 font-medium">
        <span>{product.sellerName}</span>
        <span>{product.location.split(",")[0]}</span>
      </div>

      {product.allowOffers && available && (
        <Link
          href={`#/product/${product.id}?offer=1`}
          className="offer-hint inline-flex items-center gap-1.5 text-xs font-semibold text-[#c89b3c] hover:underline mt-1.5"
        >
          <Tag size={12} />
          <span>Make a private offer</span>
        </Link>
      )}
    </article>
  );
}
