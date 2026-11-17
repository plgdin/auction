import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Grid2X2,
  List,
} from "lucide-react";
import { ShopCard } from "../components/ShopCard";
import { SelectMenu } from "../components/Ui";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/format";
import { CATEGORIES, findTopForLegacy, groupsFor } from "../lib/categories";
import type { Condition, Product } from "../lib/types";

type FilterKey = "all" | string;

const shopCategories: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All items" },
  ...CATEGORIES.map((name) => ({ key: name as FilterKey, label: name })),
];

const conditionOptions: Array<{ value: Condition; label: string }> = [
  { value: "Like new", label: "Like New" },
  { value: "Good", label: "Gently Used" },
  { value: "Fair", label: "Well Used" },
];

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

type Sort = "newest" | "price-asc" | "price-desc";
type View = "grid" | "list";

function keyForQuery(category: string | null): FilterKey {
  if (!category) return "all";
  if (CATEGORIES.includes(category)) return category;
  const legacy = findTopForLegacy(category);
  return CATEGORIES.includes(legacy) ? legacy : "all";
}

function matchesCategory(product: Product, key: FilterKey) {
  if (key === "all") return true;
  return product.category === key || findTopForLegacy(product.category) === key;
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

export function ProductsPage() {
  const { db } = useStore();
  const route = useRoute();
  const [category, setCategory] = useState<FilterKey>(keyForQuery(route.query.get("category")));
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [query, setQuery] = useState(route.query.get("q") || "");
  const [condition, setCondition] = useState<Condition | "All">("All");
  const [sort, setSort] = useState<Sort>("newest");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [view, setView] = useState<View>("grid");
  const [page, setPage] = useState(1);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    category: true,
    type: true,
    condition: true,
    price: true,
    size: true,
    sort: true,
  });

  const scrollToProducts = () => {
    const target = document.querySelector<HTMLElement>(".shop-results");
    if (target) {
      const navOffset = 80;
      const elementPosition = target.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = Math.max(0, elementPosition - navOffset);
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    requestAnimationFrame(() => {
      scrollToProducts();
    });
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of active) {
      const top = CATEGORIES.includes(product.category) ? product.category : findTopForLegacy(product.category);
      if (CATEGORIES.includes(top)) map.set(top, (map.get(top) ?? 0) + 1);
    }
    return map;
  }, [active]);

  const groupOptions = useMemo(() => (category === "all" ? [] : groupsFor(category).map((group) => group.name)), [category]);

  const groupMatches = useMemo(() => {
    if (category === "all" || selectedGroups.length === 0) return () => true;
    const chosen = new Set<string>();
    for (const group of groupsFor(category)) {
      if (!selectedGroups.includes(group.name)) continue;
      for (const sub of group.subs) {
        if (sub !== "All") chosen.add(sub);
      }
      chosen.add(group.name);
    }
    return (product: Product) => chosen.has(product.subcategory ?? "");
  }, [category, selectedGroups]);

  useEffect(() => setSelectedGroups([]), [category]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return active
      .filter((product) => {
        if (!matchesCategory(product, category)) return false;
        if (!groupMatches(product)) return false;
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
  }, [active, category, condition, groupMatches, maxPrice, query, selectedSizes, sort]);

  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageProducts = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [category, condition, maxPrice, query, selectedSizes, selectedGroups, sort]);

  const reset = () => {
    setCategory("all");
    setCondition("All");
    setSort("newest");
    setSelectedSizes([]);
    setSelectedGroups([]);
    setMaxPrice(highestPrice);
    setQuery("");
  };

  const toggleSize = (size: string) =>
    setSelectedSizes((previous) =>
      previous.includes(size) ? [] : [size],
    );

  const toggleGroup = (group: string) =>
    setSelectedGroups((previous) =>
      previous.includes(group) ? previous.filter((item) => item !== group) : [...previous, group],
    );

  return (
    <main className="page-shell shop-page">
      <section className="shop-sheet" aria-labelledby="shop-title">
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
                    <button
                      type="button"
                      className="shop-filter-toggle"
                      onClick={() => toggleSection("category")}
                      aria-expanded={openSections.category}
                    >
                      <span>Category</span>
                      <ChevronDown
                        size={14}
                        strokeWidth={1.8}
                        className={`shop-chevron ${openSections.category ? "is-open" : ""}`}
                      />
                    </button>
                  </h3>
                  {openSections.category && (
                    <div className="shop-filter-options">
                      {shopCategories.map((option) => (
                        <label key={option.key} className="shop-check">
                          <input
                            type="checkbox"
                            checked={category === option.key}
                            onChange={() => setCategory(option.key)}
                          />
                          <span>{option.label}</span>
                          {option.key !== "all" && counts.get(option.key as string) ? (
                            <em className="shop-check-count">{counts.get(option.key as string)}</em>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  )}
                </section>

                {groupOptions.length > 0 && (
                  <section className="shop-filter-group">
                    <h3>
                      <button
                        type="button"
                        className="shop-filter-toggle"
                        onClick={() => toggleSection("type")}
                        aria-expanded={openSections.type}
                      >
                        <span>Type</span>
                        <ChevronDown
                          size={14}
                          strokeWidth={1.8}
                          className={`shop-chevron ${openSections.type ? "is-open" : ""}`}
                        />
                      </button>
                    </h3>
                    {openSections.type && (
                      <div className="shop-filter-options">
                        {groupOptions.map((group) => (
                          <label key={group} className="shop-check">
                            <input
                              type="checkbox"
                              checked={selectedGroups.includes(group)}
                              onChange={() => toggleGroup(group)}
                            />
                            <span>{group}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section className="shop-filter-group">
                  <h3>
                    <button
                      type="button"
                      className="shop-filter-toggle"
                      onClick={() => toggleSection("condition")}
                      aria-expanded={openSections.condition}
                    >
                      <span>Condition</span>
                      <ChevronDown
                        size={14}
                        strokeWidth={1.8}
                        className={`shop-chevron ${openSections.condition ? "is-open" : ""}`}
                      />
                    </button>
                  </h3>
                  {openSections.condition && (
                    <div className="shop-filter-options">
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
                    </div>
                  )}
                </section>

                <section className="shop-filter-group shop-price">
                  <h3>
                    <button
                      type="button"
                      className="shop-filter-toggle"
                      onClick={() => toggleSection("price")}
                      aria-expanded={openSections.price}
                    >
                      <span>Price Range</span>
                      <ChevronDown
                        size={14}
                        strokeWidth={1.8}
                        className={`shop-chevron ${openSections.price ? "is-open" : ""}`}
                      />
                    </button>
                  </h3>
                  {openSections.price && (
                    <div className="shop-filter-options">
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
                    </div>
                  )}
                </section>

                <section className="shop-filter-group">
                  <h3>
                    <button
                      type="button"
                      className="shop-filter-toggle"
                      onClick={() => toggleSection("size")}
                      aria-expanded={openSections.size}
                    >
                      <span>Size</span>
                      <ChevronDown
                        size={14}
                        strokeWidth={1.8}
                        className={`shop-chevron ${openSections.size ? "is-open" : ""}`}
                      />
                    </button>
                  </h3>
                  {openSections.size && (
                    <div className="shop-filter-options shop-size-list">
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
                  )}
                </section>

                <section className="shop-sort">
                  <h3>
                    <button
                      type="button"
                      className="shop-filter-toggle"
                      onClick={() => toggleSection("sort")}
                      aria-expanded={openSections.sort}
                    >
                      <span>Sort By</span>
                      <ChevronDown
                        size={14}
                        strokeWidth={1.8}
                        className={`shop-chevron ${openSections.sort ? "is-open" : ""}`}
                      />
                    </button>
                  </h3>
                  {openSections.sort && (
                    <div className="shop-select-wrap">
                      <SelectMenu
                        value={sort}
                        ariaLabel="Sort by"
                        options={[
                          { value: "newest", label: "Recently Listed" },
                          { value: "price-asc", label: "Price: Low to High" },
                          { value: "price-desc", label: "Price: High to Low" },
                        ]}
                        onChange={(value) => setSort(value as Sort)}
                      />
                    </div>
                  )}
                </section>
              </div>
            </div>
          </aside>

          <section className="shop-results">
            <header className="shop-heading">
              <div>
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
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
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
                      onClick={() => handlePageChange(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page === pageCount}
                  onClick={() => handlePageChange(Math.min(pageCount, page + 1))}
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
