import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ArrowRight } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

export type SearchResultItem = {
  id: string;
  title: string;
  price?: number;
  image?: string;
  seller?: string;
  condition?: string;
  category?: string;
};

export type ExpandingSearchDockProps = {
  onSearch?: (query: string) => void;
  placeholder?: string;
  results?: SearchResultItem[];
  onSelectResult?: (item: SearchResultItem) => void;
  onSeeAll?: (query: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
  defaultExpanded?: boolean;
};

const FALLBACK_DEMO_RESULTS: SearchResultItem[] = [
  {
    id: "demo-1",
    title: "1970s Leather Biker Jacket",
    price: 12500,
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=200&auto=format&fit=crop&q=80",
    seller: "Nila Vintage",
    condition: "Good",
    category: "Leather",
  },
  {
    id: "demo-2",
    title: "The Worn-in Selvedge Denim",
    price: 3450,
    image: "https://images.unsplash.com/photo-1542272604-780c96856592?w=200&auto=format&fit=crop&q=80",
    seller: "Curated Thread",
    condition: "Like new",
    category: "Denim",
  },
  {
    id: "demo-3",
    title: "Chunky Wool Knit Cardigan",
    price: 2800,
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=200&auto=format&fit=crop&q=80",
    seller: "Heritage Wool",
    condition: "Excellent",
    category: "Knitwear",
  },
  {
    id: "demo-4",
    title: "Hand-tooled Quilted Leather Bag",
    price: 4900,
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&auto=format&fit=crop&q=80",
    seller: "Studio Artisan",
    condition: "Very good",
    category: "Accessories",
  },
];

export function ExpandingSearchDock({
  onSearch,
  placeholder = "Search...",
  results,
  onSelectResult,
  onSeeAll,
  align = "right",
  className = "",
  defaultExpanded = false,
}: ExpandingSearchDockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        if (!query.trim() && !defaultExpanded) {
          setIsExpanded(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query, defaultExpanded]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isExpanded) {
        handleCollapse();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const handleExpand = () => {
    setIsExpanded(true);
    setShowDropdown(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    setShowDropdown(false);
    setQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (onSearch) {
        onSearch(query.trim());
      } else if (onSeeAll) {
        onSeeAll(query.trim());
      }
      setShowDropdown(false);
    }
  };

  // Determine active search results
  const activeResults: SearchResultItem[] = (() => {
    if (results !== undefined) return results;
    // Fallback demo filtering
    const q = query.trim().toLowerCase();
    if (!q) return FALLBACK_DEMO_RESULTS;
    return FALLBACK_DEMO_RESULTS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.seller?.toLowerCase().includes(q),
    );
  })();

  const formatPrice = (p?: number) => {
    if (p === undefined) return "";
    return `₹${p.toLocaleString("en-IN")}`;
  };

  const alignClasses =
    align === "right"
      ? "right-0 origin-right"
      : align === "center"
      ? "left-1/2 -translate-x-1/2 origin-center"
      : "left-0 origin-left";

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="icon"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExpand}
            aria-label="Search"
            className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-[#D5C2A5]/70 bg-[#FAF4EB]/90 text-[#493022] shadow-[0_2px_8px_rgba(73,48,34,0.08)] backdrop-blur-md transition-colors hover:bg-[#F3E5D2] hover:border-[#BF9B30]/60 focus:outline-none focus:ring-2 focus:ring-[#8C5E3C]/30"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </motion.button>
        ) : (
          <motion.form
            key="input"
            initial={{ width: 44, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 44, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 340,
              damping: 28,
            }}
            onSubmit={handleSubmit}
            className={`relative ${alignClasses}`}
            style={{ maxWidth: "calc(100vw - 32px)" }}
          >
            <motion.div
              initial={{ backdropFilter: "blur(0px)" }}
              animate={{ backdropFilter: "blur(14px)" }}
              className="relative flex items-center gap-2 overflow-hidden rounded-full border border-[#CBB693] bg-[#FAF4EB]/95 shadow-[0_4px_16px_rgba(73,48,34,0.12)] backdrop-blur-md ring-2 ring-[#493022]/10 transition-shadow focus-within:ring-[#493022]/25 focus-within:border-[#8C5E3C]"
            >
              <div className="ml-3.5 flex items-center justify-center text-[#8C745A]">
                <Search className="h-4 w-4" strokeWidth={2.2} />
              </div>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                  if (onSearch) onSearch(e.target.value);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder={placeholder}
                autoFocus
                className="h-10 sm:h-11 flex-1 bg-transparent pr-2 font-sans text-sm text-[#332417] placeholder:text-[#9C856C] outline-none"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                    if (onSearch) onSearch("");
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[#8C745A] hover:bg-[#EBDDC8] hover:text-[#493022] transition-colors"
                  aria-label="Clear query"
                >
                  <X className="h-3 w-3" />
                </button>
              )}

              <motion.button
                type="button"
                onClick={handleCollapse}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="mr-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[#6D533E] hover:bg-[#E8D9C0] hover:text-[#332417] transition-all"
                aria-label="Close search"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.4} />
              </motion.button>
            </motion.div>

            {/* Floating Dropdown Results with Vintage Scrapbook Aesthetic */}
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className={`absolute top-full mt-2.5 z-50 w-[320px] sm:w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#D5C2A5] bg-[#FAF4EB]/98 p-3 shadow-[0_12px_36px_rgba(73,48,34,0.18)] backdrop-blur-xl ${
                    align === "right" ? "right-0" : "left-0"
                  }`}
                  style={{
                    boxShadow: "0 18px 40px -10px rgba(50, 32, 20, 0.25), 0 0 0 1px rgba(197, 172, 140, 0.45)",
                  }}
                >
                  {/* Results Section */}
                  <div>
                    <div className="flex items-center justify-between px-1 mb-1.5">
                      <span className="text-[11px] font-medium tracking-wide uppercase text-[#8C745A]">
                        {query ? `Results (${activeResults.length})` : "Fresh on the rail"}
                      </span>
                    </div>

                    <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
                      {activeResults.length > 0 ? (
                        activeResults.slice(0, 5).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (onSelectResult) {
                                onSelectResult(item);
                              }
                              handleCollapse();
                            }}
                            className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all hover:bg-[#EDE0CD]/80 group"
                          >
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.title}
                                className="h-11 w-11 rounded-lg object-cover border border-[#D5C2A5]/60 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="h-11 w-11 rounded-lg bg-[#EBDDC8] flex items-center justify-center text-[#8C745A] shrink-0">
                                <Search className="h-4 w-4" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-[#332417] truncate group-hover:text-[#8C5E3C] transition-colors">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-[#8C745A] truncate">
                                {item.condition ? `${item.condition} · ` : ""}
                                {item.seller || item.category || "Vintage"}
                              </p>
                            </div>

                            {item.price !== undefined && (
                              <span className="font-serif text-[13px] font-semibold text-[#493022] shrink-0">
                                {formatPrice(item.price)}
                              </span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="py-6 text-center text-xs text-[#8C745A]">
                          No pieces found matching &ldquo;{query}&rdquo;.
                        </div>
                      )}
                    </div>

                    {/* View all button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onSeeAll) {
                          onSeeAll(query.trim());
                        } else if (onSearch) {
                          onSearch(query.trim());
                        }
                        handleCollapse();
                      }}
                      className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#493022] py-2 px-3 text-xs font-semibold text-[#FAF4EB] shadow-sm transition-all hover:bg-[#332014] active:scale-[0.99]"
                    >
                      <span>See all listings {query ? `for "${query}"` : ""}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExpandingSearchDock;

