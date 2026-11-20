import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import { ShopCard } from "../components/ShopCard";
import { SelectMenu } from "../components/Ui";
import { formatMoney } from "../lib/format";
import { useSeo } from "../lib/seo";
import { productsMeta } from "../lib/seo-meta";
import { useStore } from "../lib/store";
import { CATEGORIES, findTopForLegacy, groupsFor } from "../lib/categories";
import type { Condition, Product } from "../lib/types";

type FilterKey = "all" | string;

const shopCategories: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All items" },
  ...CATEGORIES.map((name) => ({ key: name as FilterKey, label: name })),
];

const conditionOptions: Array<{ value: Condition | "All"; label: string }> = [
  { value: "All", label: "All conditions" },
  { value: "Like new", label: "Like New" },
  { value: "Good", label: "Gently Used" },
  { value: "Fair", label: "Well Used" },
];

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

type Sort = "newest" | "price-asc" | "price-desc";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  const [category, setCategory] = useState<FilterKey>(keyForQuery(searchParams.get("category")));
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [condition, setCondition] = useState<Condition | "All">("All");
  const [sort, setSort] = useState<Sort>("newest");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(100000);

  const initialPage = useMemo(() => {
    const raw = searchParams.get("page");
    const num = raw ? parseInt(raw, 10) : NaN;
    if (Number.isInteger(num) && num > 0) return num;
    try {
      const saved = sessionStorage.getItem("lelam_last_shop_page");
      const savedNum = saved ? parseInt(saved, 10) : NaN;
      if (Number.isInteger(savedNum) && savedNum > 0) return savedNum;
    } catch {
      // sessionStorage unavailable
    }
    return 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [page, setPage] = useState(initialPage);
  const isFirstRender = useRef(true);
  const prevFiltersRef = useRef({
    category,
    condition,
    maxPrice,
    query,
    sizes: selectedSizes.join(","),
    groups: selectedGroups.join(","),
    sort,
  });

  useSeo(productsMeta(category !== "all" ? category : null));
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    category: true,
    type: true,
    condition: true,
    price: true,
    size: true,
    sort: true,
  });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterDialogRef = useRef<HTMLElement>(null);
  const filterCloseRef = useRef<HTMLButtonElement>(null);
  const wasFiltersOpen = useRef(false);

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
    try {
      sessionStorage.setItem("lelam_last_shop_page", String(nextPage));
    } catch {
      // ignore
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextPage > 1) {
          next.set("page", String(nextPage));
        } else {
          next.delete("page");
        }
        return next;
      },
      { replace: true },
    );
    requestAnimationFrame(() => {
      scrollToProducts();
    });
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const urlCategory = searchParams.get("category");
  const urlQuery = searchParams.get("q");

  useEffect(() => {
    if (urlCategory !== null) {
      const parsedCat = keyForQuery(urlCategory);
      setCategory((curr) => (curr === parsedCat ? curr : parsedCat));
    }
  }, [urlCategory]);

  useEffect(() => {
    if (urlQuery !== null) {
      setQuery((curr) => (curr === urlQuery ? curr : urlQuery));
    }
  }, [urlQuery]);

  // Synchronize state if URL searchParams change (e.g. browser back/forward buttons)
  const searchPage = searchParams.get("page");
  useEffect(() => {
    const p = searchPage ? parseInt(searchPage, 10) : NaN;
    const targetPage = Number.isInteger(p) && p > 0 ? p : 1;
    setPage((curr) => (curr === targetPage ? curr : targetPage));
    try {
      sessionStorage.setItem("lelam_last_shop_page", String(targetPage));
    } catch {
      // ignore
    }
  }, [searchPage]);

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
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageProducts = visible.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const prev = prevFiltersRef.current;
    const sizes = selectedSizes.join(",");
    const groups = selectedGroups.join(",");
    const filtersChanged =
      prev.category !== category ||
      prev.condition !== condition ||
      prev.maxPrice !== maxPrice ||
      prev.query !== query ||
      prev.sizes !== sizes ||
      prev.groups !== groups ||
      prev.sort !== sort;

    if (!filtersChanged) return;

    prevFiltersRef.current = {
      category,
      condition,
      maxPrice,
      query,
      sizes,
      groups,
      sort,
    };

    setPage(1);
    try {
      sessionStorage.setItem("lelam_last_shop_page", "1");
    } catch {
      // ignore
    }
    setSearchParamsRef.current(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [category, condition, maxPrice, query, selectedSizes, selectedGroups, sort]);

  useEffect(() => {
    if (!filtersOpen) {
      if (wasFiltersOpen.current) {
        wasFiltersOpen.current = false;
        filterTriggerRef.current?.focus();
      }
      return;
    }
    wasFiltersOpen.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = filterDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    filterCloseRef.current?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  const reset = () => {
    setCategory("all");
    setCondition("All");
    setSort("newest");
    setSelectedSizes([]);
    setSelectedGroups([]);
    setMaxPrice(highestPrice);
    setQuery("");
    setPage(1);
    try {
      sessionStorage.removeItem("lelam_last_shop_page");
    } catch {
      // ignore
    }
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const toggleSize = (size: string) =>
    setSelectedSizes((previous) =>
      previous.includes(size) ? [] : [size],
    );

  const toggleGroup = (group: string) =>
    setSelectedGroups((previous) =>
      previous.includes(group) ? previous.filter((item) => item !== group) : [...previous, group],
    );

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    (condition !== "All" ? 1 : 0) +
    selectedGroups.length +
    selectedSizes.length +
    (maxPrice < highestPrice ? 1 : 0) +
    (query.trim() ? 1 : 0);

  return (
    <main className="page-shell shop-page">
      <section className="shop-sheet" aria-labelledby="shop-title">
        <div className="shop-layout">
          {filtersOpen && (
            <button
              type="button"
              className="shop-filter-scrim"
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            />
          )}
          <aside
            ref={filterDialogRef}
            id="shop-filter-panel"
            className={`shop-filters ${filtersOpen ? "is-open" : ""}`}
            aria-label="Filters"
            role={filtersOpen ? "dialog" : undefined}
            aria-modal={filtersOpen || undefined}
            aria-labelledby="shop-filter-title"
            tabIndex={filtersOpen ? -1 : undefined}
          >
            <div className="shop-filter-paper">
              <div className="shop-filter-content">
                <div className="shop-filter-title">
                  <h2 id="shop-filter-title">Filter pieces</h2>
                  <button
                    ref={filterCloseRef}
                    type="button"
                    className="shop-filter-close"
                    aria-label="Close filters"
                    onClick={() => setFiltersOpen(false)}
                  >
                    <X size={18} />
                  </button>
                  <Filter className="shop-filter-icon" size={16} strokeWidth={1.5} />
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
                        <span>{formatMoney(Math.min(maxPrice, highestPrice))}{maxPrice >= highestPrice ? "+" : ""}</span>
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
            {/* Compact filter + sort bar — phones only, sticky under the navbar */}
            <div className="shop-mobile-bar">
              <button
                ref={filterTriggerRef}
                type="button"
                className={`shop-mobile-toggle ${filtersOpen ? "is-open" : ""}`}
                aria-expanded={filtersOpen}
                aria-controls="shop-filter-panel"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <Filter size={15} strokeWidth={1.8} />
                <span>Filters</span>
                {activeFilterCount > 0 && <em className="shop-mobile-count">{activeFilterCount}</em>}
              </button>
              <div className="shop-mobile-sort">
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
            </div>
            <header className="shop-heading">
              <h1 id="shop-title" className="shop-title sr-only">Shop</h1>
              <p className="shop-found">{visible.length} Items found</p>
            </header>

            {pageProducts.length ? (
              <div className="shop-grid is-grid">
                {pageProducts.map((product, index) => (
                  <ShopCard key={product.id} product={product} priority={index === 0} />
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
                  disabled={safePage === 1}
                  onClick={() => handlePageChange(Math.max(1, safePage - 1))}
                >
                  <ChevronLeft size={15} strokeWidth={1.7} />
                </button>
                {pageItems(safePage, pageCount).map((item, index) =>
                  item === "…" ? (
                    <span key={`gap-${index}`}>…</span>
                  ) : (
                    <button
                      type="button"
                      key={item}
                      aria-current={safePage === item ? "page" : undefined}
                      className={safePage === item ? "is-active" : ""}
                      onClick={() => handlePageChange(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage === pageCount}
                  onClick={() => handlePageChange(Math.min(pageCount, safePage + 1))}
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
