import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Gavel,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PageHeader } from "../components/Ui";
import { ProductCard } from "../components/ProductCard";
import { Link } from "../components/Link";
import { CATEGORIES } from "../lib/categories";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/format";
import type { Category, Condition, Product } from "../lib/types";

const categoryNames: Array<Category | "All finds"> = ["All finds", ...CATEGORIES];

type Sort = "newest" | "price-asc" | "price-desc" | "offers";

export function ProductsPage() {
  const { db } = useStore();
  const route = useRoute();
  const [category, setCategory] = useState<Category | "All finds">(
    (route.query.get("category") as Category | null) || "All finds",
  );
  const [query, setQuery] = useState(route.query.get("q") || "");
  const [condition, setCondition] = useState<Condition | "All">("All");
  const [sort, setSort] = useState<Sort>("newest");
  const [offersOnly, setOffersOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const nextCategory = (route.query.get("category") as Category | null) || "All finds";
    const nextQuery = route.query.get("q") || "";
    setCategory(nextCategory);
    setQuery(nextQuery);
  }, [route.query]);

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const active = useMemo(
    () =>
      db.products.filter(
        (product) => product.status === "active" || product.status === "reserved",
      ),
    [db.products],
  );

  const highestPrice = Math.max(...active.map((product) => product.askingPrice), 100000);

  useEffect(() => {
    if (!maxPrice) setMaxPrice(highestPrice);
  }, [highestPrice, maxPrice]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    let list = active.filter((product) => {
      if (category !== "All finds" && product.category !== category) return false;
      if (condition !== "All" && product.condition !== condition) return false;
      if (offersOnly && !product.allowOffers) return false;
      if (product.askingPrice > maxPrice) return false;
      if (search) {
        const haystack = `${product.title} ${product.description} ${product.brand ?? ""} ${product.category} ${product.sellerName}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return a.askingPrice - b.askingPrice;
      if (sort === "price-desc") return b.askingPrice - a.askingPrice;
      if (sort === "offers") return Number(b.allowOffers) - Number(a.allowOffers);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [active, category, condition, offersOnly, maxPrice, query, sort]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of active) {
      map.set(product.category, (map.get(product.category) ?? 0) + 1);
    }
    return map;
  }, [active]);

  const openMenu = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setMenuOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenuOpen(false), 150);
  };
  const chooseCategory = (next: Category | "All finds") => {
    setCategory(next);
    setMenuOpen(false);
  };
  const liveAuctions = db.auctions.filter((auction) => auction.status === "live");

  const reset = () => {
    setQuery("");
    setCategory("All finds");
    setCondition("All");
    setSort("newest");
    setOffersOnly(false);
    setMaxPrice(highestPrice);
  };

  return (
    <main className="page-shell">
      <div className="section-wrap">
        <PageHeader
          eyebrow="SHOP THE ARCHIVE"
          title={
            <>
              Every piece, <em>one of one.</em>
            </>
          }
          description="Buy instantly at the asking price, add to your cart, or send a private offer. Bidding only appears on the few pieces a seller has opted into an auction."
          action={
            liveAuctions.length > 0 ? (
              <Link href="#/auctions" className="live-callout">
                <span className="live-dot" /> {liveAuctions.length} live auction
                {liveAuctions.length === 1 ? "" : "s"} <Gavel size={14} />
              </Link>
            ) : undefined
          }
        />

        <div className="catalog-toolbar">
          <div
            className={`category-dropdown ${menuOpen ? "is-open" : ""}`}
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMenuOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMenuOpen(false);
            }}
          >
            <button
              type="button"
              className="category-dropdown-trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="catalog-category-menu"
              onClick={() => setMenuOpen(true)}
            >
              <SlidersHorizontal size={16} />
              <span>{category === "All finds" ? "All categories" : category}</span>
              <ChevronDown size={16} className="category-dropdown-chevron" />
            </button>
            <div
              id="catalog-category-menu"
              className="category-dropdown-panel"
              role="menu"
              aria-label="Filter by category"
            >
              <span className="category-dropdown-label">Shop by category</span>
              {categoryNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="menuitemradio"
                  aria-checked={category === name}
                  className={category === name ? "is-active" : ""}
                  onClick={() => chooseCategory(name)}
                >
                  <span>
                    {name === "All finds" ? "All pieces" : name}
                    <em>{name === "All finds" ? active.length : counts.get(name) ?? 0}</em>
                  </span>
                  {category === name && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>

          <label className="catalog-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the archive"
              aria-label="Search listings"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>

          <select
            className="catalog-select"
            value={condition}
            onChange={(event) => setCondition(event.target.value as Condition | "All")}
            aria-label="Filter by condition"
          >
            <option value="All">Any condition</option>
            <option value="New">New</option>
            <option value="Like new">Like new</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
          </select>

          <select
            className="catalog-select"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            aria-label="Sort listings"
          >
            <option value="newest">Newest first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="offers">Open to offers</option>
          </select>
        </div>

        <div className="catalog-subbar">
          <div className="catalog-checks">
            <label>
              <input
                type="checkbox"
                checked={offersOnly}
                onChange={(event) => setOffersOnly(event.target.checked)}
              />
              <span>Open to offers</span>
            </label>
            <label className="price-filter">
              <span>Under {formatMoney(maxPrice)}</span>
              <input
                type="range"
                min={10000}
                max={highestPrice}
                step={5000}
                value={maxPrice}
                onChange={(event) => setMaxPrice(Number(event.target.value))}
              />
            </label>
          </div>
          <span className="catalog-count">
            {visible.length} {visible.length === 1 ? "piece" : "pieces"}
          </span>
        </div>

        {visible.length ? (
          <div className="product-grid catalog-grid">
            {visible.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="empty-state page-empty">
            <Search size={34} />
            <h2>Nothing on this rail right now.</h2>
            <p>Try a different category, widen the price range, or clear the search.</p>
            <button type="button" className="button button-olive" onClick={reset}>
              Reset filters
            </button>
          </div>
        )}
        {visible.length > 0 && (
          <div className="catalog-foot">
            <span>
              Every listing is one seller&apos;s piece. Prices are set by the seller, in Indian rupees.
            </span>
            <button type="button" onClick={reset} className="text-link">
              Reset filters
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
