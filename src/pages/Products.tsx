import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Grid2X2,
  Heart,
  List,
  ShoppingBag,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/format";
import { toast } from "../lib/toast";
import type { Condition, Product } from "../lib/types";

type FilterKey = "all" | "clothes" | "accessories" | "bags" | "shoes" | "others";

const shopCategories: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All items" },
  { key: "clothes", label: "Clothes" },
  { key: "accessories", label: "Accessories" },
  { key: "bags", label: "Bags" },
  { key: "shoes", label: "Shoes" },
  { key: "others", label: "Others" },
];

const conditionOptions: Array<{ value: Condition; label: string }> = [
  { value: "Like new", label: "Like New" },
  { value: "Good", label: "Gently Used" },
  { value: "Fair", label: "Well Used" },
];

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
const coreCategories = ["Clothing", "Footwear", "Bags & accessories"];

type Sort = "newest" | "price-asc" | "price-desc";
type View = "grid" | "list";

function keyForQuery(category: string | null): FilterKey {
  if (!category) return "all";
  if (category === "Clothing") return "clothes";
  if (category === "Footwear") return "shoes";
  if (category === "Bags & accessories") return "accessories";
  return "others";
}

function matchesCategory(product: Product, key: FilterKey) {
  if (key === "all") return true;
  if (key === "clothes") return product.category === "Clothing";
  if (key === "accessories" || key === "bags") return product.category === "Bags & accessories";
  if (key === "shoes") return product.category === "Footwear";
  return !coreCategories.includes(product.category);
}

function pageItems(current: number, total: number): Array<number | "…"> {
  if (total <= 6) return Array.from({ length: total }, (_, index) => index + 1);
  const items: Array<number | "…"> = [1];
  if (current > 3) items.push("…");
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
    items.push(page);
  }
  if (current < total - 2) items.push("…");
  items.push(total);
  return items;
}

function ShopCard({ product }: { product: Product }) {
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
            onClick={async () => {
              if (inCart) {
                navigate("#/cart");
                return;
              }
              const result = await addToCart(product.id);
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

export function ProductsPage() {
  const { db } = useStore();
  const route = useRoute();
  const [category, setCategory] = useState<FilterKey>(keyForQuery(route.query.get("category")));
  const [query, setQuery] = useState(route.query.get("q") || "");
  const [condition, setCondition] = useState<Condition | "All">("All");
  const [sort, setSort] = useState<Sort>("newest");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [view, setView] = useState<View>("grid");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setCategory(keyForQuery(route.query.get("category")));
    setQuery(route.query.get("q") || "");
  }, [route.query]);

  const active = useMemo(
    () => db.products.filter((product) => product.status === "active" || product.status === "reserved"),
    [db.products],
  );
  const highestPrice = Math.max(10000, ...active.map((product) => product.askingPrice));
  useEffect(() => setMaxPrice(highestPrice), [highestPrice]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return active
      .filter((product) => {
        if (!matchesCategory(product, category)) return false;
        if (condition !== "All" && product.condition !== condition) return false;
        if (product.askingPrice > maxPrice) return false;
        if (
          selectedSizes.length &&
          !selectedSizes.some((size) => (product.size || "").toLowerCase().includes(size.toLowerCase()))
        ) {
          return false;
        }
        if (
          search &&
          !`${product.title} ${product.description} ${product.brand ?? ""} ${product.category} ${product.sellerName}`
            .toLowerCase()
            .includes(search)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "price-asc") return a.askingPrice - b.askingPrice;
        if (sort === "price-desc") return b.askingPrice - a.askingPrice;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [active, category, condition, maxPrice, query, selectedSizes, sort]);

  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageProducts = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [category, condition, maxPrice, query, selectedSizes, sort]);

  const reset = () => {
    setCategory("all");
    setCondition("All");
    setSort("newest");
    setSelectedSizes([]);
    setMaxPrice(highestPrice);
    setQuery("");
  };

  const toggleSize = (size: string) =>
    setSelectedSizes((previous) =>
      previous.includes(size) ? previous.filter((item) => item !== size) : [...previous, size],
    );

  return (
    <main className="page-shell shop-page">
      <section className="shop-sheet" aria-labelledby="shop-title">
        <svg width="0" height="0" className="sr-only" aria-hidden="true">
          <defs>
            <filter id="filter-deckle-tear" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <div className="shop-layout">
          <aside className="shop-filters" aria-label="Filters">
            <div className="shop-filter-paper">
              <div className="shop-filter-content">
                <div className="shop-filter-title">
                  <h2>Filter</h2>
                  <Filter size={16} strokeWidth={1.5} />
                </div>

                <section className="shop-filter-group">
                  <h3>
                    Category <ChevronDown size={14} strokeWidth={1.8} className="is-up" />
                  </h3>
                  {shopCategories.map((option) => (
                    <label key={option.key} className="shop-check">
                      <input
                        type="checkbox"
                        checked={category === option.key}
                        onChange={() => setCategory(option.key)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </section>

                <section className="shop-filter-group">
                  <h3>
                    Condition <ChevronDown size={14} strokeWidth={1.8} className="is-up" />
                  </h3>
                  {conditionOptions.map((option) => (
                    <label key={option.value} className="shop-check">
                      <input
                        type="checkbox"
                        checked={condition === option.value}
                        onChange={() =>
                          setCondition(condition === option.value ? "All" : option.value)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </section>

                <section className="shop-filter-group shop-price">
                  <h3>
                    Price Range <ChevronDown size={14} strokeWidth={1.8} className="is-up" />
                  </h3>
                  <input
                    type="range"
                    className="shop-range"
                    min={0}
                    max={highestPrice}
                    step={5000}
                    value={Math.min(maxPrice, highestPrice)}
                    onChange={(event) => setMaxPrice(Number(event.target.value))}
                    aria-label="Maximum price"
                  />
                  <div className="shop-price-ends">
                    <span>₹0</span>
                    <span>{formatMoney(Math.min(maxPrice, highestPrice))}+</span>
                  </div>
                </section>

                <section className="shop-filter-group">
                  <h3>
                    Size <ChevronDown size={14} strokeWidth={1.8} className="is-up" />
                  </h3>
                  <div className="shop-size-list">
                    {sizes.map((size) => (
                      <button
                        type="button"
                        key={size}
                        className={selectedSizes.includes(size) ? "selected" : ""}
                        onClick={() => toggleSize(size)}
                        aria-pressed={selectedSizes.includes(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="shop-sort">
                  <h3>
                    Sort By <ChevronDown size={14} strokeWidth={1.8} className="is-up" />
                  </h3>
                  <div className="shop-select-wrap">
                    <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort by">
                      <option value="newest">Recently Listed</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                    </select>
                    <ChevronDown size={14} strokeWidth={1.5} />
                  </div>
                </section>
              </div>
            </div>
            <img className="shop-flowers" src="/ass/dried-flowers.png" alt="" aria-hidden="true" />
          </aside>

          <section className="shop-results">
            <header className="shop-heading">
              <div>
                <h1 id="shop-title" className="shop-title">
                  Shop All <em>Items</em>
                  <span className="shop-doodle" aria-hidden="true" />
                </h1>
                <p className="shop-found">{visible.length} Items found</p>
              </div>
              <div className="shop-view">
                <span>View:</span>
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={view === "grid" ? "is-active" : ""}
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 size={15} strokeWidth={1.7} />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={view === "list" ? "is-active" : ""}
                  onClick={() => setView("list")}
                >
                  <List size={18} strokeWidth={1.7} />
                </button>
              </div>
            </header>

            {pageProducts.length ? (
              <div className={`shop-grid is-${view}`}>
                {pageProducts.map((product) => (
                  <ShopCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="shop-empty">
                <h2>No finds here yet</h2>
                <p>Try another category, size or price range.</p>
                <button type="button" onClick={reset}>
                  Clear filters
                </button>
              </div>
            )}

            {visible.length > 0 && (
              <nav className="shop-pagination" aria-label="Pagination">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft size={15} strokeWidth={1.7} />
                </button>
                {pageItems(page, pageCount).map((item, index) =>
                  item === "…" ? (
                    <span key={`gap-${index}`}>…</span>
                  ) : (
                    <button
                      type="button"
                      key={item}
                      aria-current={page === item ? "page" : undefined}
                      className={page === item ? "is-active" : ""}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page === pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  <ChevronRight size={15} strokeWidth={1.7} />
                </button>
              </nav>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}