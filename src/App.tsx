import { LelamNavbar } from "@/components/ui/lelam-navbar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {

  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Gavel,
  Heart,

  Search,
  ShieldCheck,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  categories,
  money,
  products,
  type Category,
  type Product,
} from "./data";
import { ParallaxComponent } from "@/components/ui/parallax-scrolling";
import { ClothingRailHero, RAIL_DEMO_ITEMS } from "@/components/ui/product-rail-gallery";
import HalftoneWordmarkFooter from "@/components/ui/halftone-wordmark-footer";
type AuctionInfo = {
  bids: number;
  ends: string;
  seller: string;
  condition: string;
};

const auctionInfo: Record<number, AuctionInfo> = {
  1: { bids: 12, ends: "2h 18m", seller: "Second Story Vintage", condition: "Excellent" },
  2: { bids: 7, ends: "5h 42m", seller: "Sunday Archive", condition: "Very good" },
  3: { bids: 18, ends: "1h 06m", seller: "Found Object Co.", condition: "Good" },
  4: { bids: 9, ends: "8h 24m", seller: "Blue Room Supply", condition: "Good" },
  5: { bids: 21, ends: "3h 51m", seller: "After Hours Studio", condition: "Very good" },
  6: { bids: 5, ends: "11h 10m", seller: "Common Thread", condition: "Excellent" },
  7: { bids: 14, ends: "1h 45m", seller: "DHxWHY Studio", condition: "Pristine" },
  8: { bids: 19, ends: "4h 12m", seller: "CCgather Archive", condition: "Excellent" },
  9: { bids: 8, ends: "3h 20m", seller: "Maestiq Vault", condition: "Like New" },
  10: { bids: 23, ends: "0h 48m", seller: "Heritage Knitwear", condition: "Mint" },
  11: { bids: 16, ends: "6h 15m", seller: "Maestiq Vault", condition: "Excellent" },
  12: { bids: 11, ends: "2h 05m", seller: "DHxWHY Studio", condition: "Pristine" },
  13: { bids: 6, ends: "7h 30m", seller: "CCgather Archive", condition: "Very good" },
  14: { bids: 15, ends: "5h 10m", seller: "Common Thread", condition: "Excellent" },
  15: { bids: 20, ends: "1h 15m", seller: "Sunday Archive", condition: "Mint" },
  16: { bids: 13, ends: "4h 50m", seller: "CCgather Archive", condition: "Excellent" },
};

function getAuctionInfo(product: Product): AuctionInfo {
  return auctionInfo[product.id] ?? {
    bids: 0,
    ends: "New listing",
    seller: "Independent seller",
    condition: "See details",
  };
}

function readSaved(key: string): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is number =>
                typeof id === "number" && products.some((p) => p.id === id),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function Modal({
  children,
  title,
  onClose,
  drawer = false,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  drawer?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${drawer ? "drawer" : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <span>{title}</span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

type Overlay =
  | "search"
  | "bag"
  | "saved"
  | "shipping"
  | "contact"
  | "checkout"
  | null;

export default function App() {
  const [category, setCategory] = useState<Category>("All finds");
  const [expanded, setExpanded] = useState(false);
  const [favorites, setFavorites] = useState<number[]>(() => {
    const modern = readSaved("lelam-favorites");
    return modern.length ? modern : readSaved("sunday-favorites");
  });
  const [bag, setBag] = useState<number[]>(() => {
    const modern = readSaved("lelam-bag");
    return modern.length ? modern : readSaved("sunday-bag");
  });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  
  const [toast, setToast] = useState("");
  
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("lelam-favorites", JSON.stringify(favorites));
      localStorage.setItem("sunday-favorites", JSON.stringify(favorites));
    } catch {
      /* Storage may be unavailable in private browsers. */
    }
  }, [favorites]);
  useEffect(() => {
    try {
      localStorage.setItem("lelam-bag", JSON.stringify(bag));
      localStorage.setItem("sunday-bag", JSON.stringify(bag));
    } catch {
      /* Keep the session usable without storage. */
    }
  }, [bag]);
  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(""), 3200);
      return () => window.clearTimeout(timer);
    }
  }, [toast]);

  const favorite = (id: number) =>
    setFavorites((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  const addToBag = (product: Product) => {
    if (bag.includes(product.id)) {
      setSelected(null);
      setOverlay("bag");
      return;
    }
    setBag((previous) => [...previous, product.id]);
    setToast(`${product.name} — added to your bid list.`);
  };
  const browse = (next: Category = "All finds") => {
    setCategory(next);
    setExpanded(true);
    
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
  };
  const visibleProducts = products
    .filter(
      (product) => category === "All finds" || product.category === category,
    )
    .slice(0, expanded || category !== "All finds" ? products.length : 4);
  const bagProducts = products.filter((product) => bag.includes(product.id));
  const subtotal = bagProducts.reduce(
    (total, product) => total + product.price,
    0,
  );
  const searchResults = products.filter((product) =>
    `${product.name} ${product.category} ${product.era}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );

  function ProductCard({ product }: { product: Product }) {
    const auction = getAuctionInfo(product);
    return (
      <article className="product-card">
        <div
          className="product-image"
          style={{ backgroundColor: product.color }}
        >
          <button
            className="product-image-link"
            onClick={() => setSelected(product)}
            aria-label={`View ${product.name}`}
          >
            <img src={product.image} alt={product.name} />
          </button>
          {product.tag && <span className="product-tag">{product.tag}</span>}
          <button
            className={`favorite-button ${favorites.includes(product.id) ? "is-saved" : ""}`}
            aria-label={`${favorites.includes(product.id) ? "Unsave" : "Save"} ${product.name}`}
            aria-pressed={favorites.includes(product.id)}
            onClick={() => favorite(product.id)}
          >
            <Heart
              size={17}
              fill={favorites.includes(product.id) ? "currentColor" : "none"}
            />
          </button>
          <button className="quick-add" onClick={() => addToBag(product)}>
            {bag.includes(product.id) ? "View bid list" : "Place a bid"}
            {bag.includes(product.id) ? (
              <Check size={15} />
            ) : (
              <Gavel size={15} />
            )}
          </button>
        </div>
        <div className="product-eyebrow">
          <span className="auction-status"><i /> Live auction</span>
          <span><Clock3 size={11} /> {auction.ends} left</span>
        </div>
        <div className="product-name-row">
          <button onClick={() => setSelected(product)}>{product.name}</button>
          <span>Current bid {money(product.price)}</span>
        </div>
        <div className="auction-card-meta">
          <span>{auction.bids} bids</span>
          <span>{auction.seller}</span>
        </div>
      </article>
    );
  }

  return (
    <>
      <LelamNavbar
        favoritesCount={favorites.length}
        bagCount={bag.length}
        onOpenSearch={() => setOverlay("search")}
        onOpenWatchlist={() => setOverlay("saved")}
        onOpenBag={() => setOverlay("bag")}
        onSelectCategory={(cat) => setCategory(cat)}
      />

      <main id="top">
        <ParallaxComponent />
        <div className="promise-strip">
          <span>
            <Gavel size={17} /> Live auctions from independent sellers
          </span>
          <span>
            <ShieldCheck size={18} /> Condition and seller details shown
          </span>
          <span>
            <Clock3 size={18} /> Closing times you can plan around
          </span>
          <span>
            <Store size={17} /> A new channel for thrift stores
          </span>
        </div>

        <section className="rail-section" id="rack">
          <ClothingRailHero
            items={RAIL_DEMO_ITEMS}
            hanger="none"
            autoplay={true}
            eyebrow="ON THE RAIL · VERIFIED ARCHIVES"
            heading="Handle the pieces directly on the rack."
            caption="Slide the hangers, brush across to swing, or click any piece to lift and rotate front and back."
            action={
              <a
                href="#shop"
                className="button button-olive inline-flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Bid on live pieces <ArrowRight size={16} />
              </a>
            }
          />
        </section>

        <section className="how-it-works section-wrap" id="how-it-works" aria-labelledby="how-it-works-title">
          <div className="section-kicker">A SIMPLE WAY TO BUY BETTER</div>
          <h2 id="how-it-works-title">Know what happens before you bid.</h2>
          <div className="process-grid">
            <div className="process-step">
              <span className="process-number">01</span>
              <Search size={19} />
              <h3>Find a listing</h3>
              <p>Filter by category, then review the size, condition, seller, and current bid.</p>
            </div>
            <div className="process-step">
              <span className="process-number">02</span>
              <Gavel size={19} />
              <h3>Follow the auction</h3>
              <p>Save pieces to your watchlist or add them to your bid list while they are live.</p>
            </div>
            <div className="process-step">
              <span className="process-number">03</span>
              <ShieldCheck size={19} />
              <h3>Buy with clarity</h3>
              <p>See the closing time and seller information up front, without hidden details.</p>
            </div>
          </div>
        </section>

        <section className="shop-section section-wrap" id="shop" aria-labelledby="shop-title">
          <div className="section-heading">
            <div>
              <div className="eyebrow">LIVE AUCTIONS</div>
              <h2 id="shop-title">Bid on pieces with a past.</h2>
              <p className="section-intro">Every listing is one item from one seller. Review the current bid, time remaining, and details before you decide.</p>
            </div>
            <button
              className="text-link"
              onClick={() => {
                setCategory("All finds");
                setExpanded(!expanded);
              }}
            >
              {expanded ? "Show featured auctions" : "View all auctions"}
              <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="shop-toolbar">
            <div
              className="category-tabs"
                aria-label="Filter auctions by category"
            >
              {categories.map((item) => (
                <button
                  key={item}
                  className={category === item ? "active" : ""}
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                >
                  {item === "All finds" ? "All auctions" : item}
                  {item === "All finds" && (
                    <span>{products.length.toString().padStart(2, "0")}</span>
                  )}
                </button>
              ))}
            </div>
            <span className="one-kind">
              <span /> LIVE LISTINGS · ONE ITEM EACH
            </span>
          </div>
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="shop-footnote">
            <ShieldCheck size={15} />
            <span>Review the full listing before bidding. Measurements and condition notes are provided by each seller.</span>
          </div>
        </section>

        <section className="collections-section section-wrap" id="collections">
          <div className="section-heading">
            <div>
              <div className="eyebrow">BROWSE QUICKLY</div>
              <h2>Start with a category.</h2>
            </div>
            <span className="section-aside">
              Shortcuts to the auctions people are browsing now.
            </span>
          </div>
          <div className="collection-grid">
            <button
              className="collection-card collection-denim"
              onClick={() => browse("Denim")}
            >
              <img src="/images/jeans.jpg" alt="Denim apparel available in live auctions" />
              <span className="collection-number">CATEGORY / 01</span>
              <div className="collection-copy">
                <span>DENIM AUCTIONS</span>
                <h3>Built to last.</h3>
                <span className="collection-link">
                  Explore the denim edit <ArrowUpRight size={18} />
                </span>
              </div>
              <span className="collection-arrow">
                <ArrowUpRight />
              </span>
            </button>
            <button
              className="collection-card collection-everyday"
              onClick={() => browse("Tops & knits")}
            >
              <img
                src="/images/knit.jpg"
                alt="Knitwear and tops available in live auctions"
              />
              <span className="collection-number">CATEGORY / 02</span>
              <div className="collection-copy">
                <span>TOPS & KNITS</span>
                <h3>Easy layers.</h3>
                <span className="collection-link">
                  Browse tops and knits <ArrowUpRight size={18} />
                </span>
              </div>
              <span className="collection-arrow">
                <ArrowUpRight />
              </span>
            </button>
          </div>
        </section>

        <section className="seller-section" id="sell" aria-labelledby="seller-title">
          <div className="seller-section-inner section-wrap">
            <div className="seller-icon"><Store size={25} /></div>
            <div>
              <div className="eyebrow">FOR THRIFT STORES</div>
              <h2 id="seller-title">Turn your next rack into an auction.</h2>
              <p>List one-of-one apparel, reach people already looking for pre-owned pieces, and keep your store in control of the listing.</p>
            </div>
            <button className="button button-light" onClick={() => setOverlay("contact")}>Talk to the lelam team <ArrowUpRight size={16} /></button>
          </div>
        </section>

        <section className="newsletter">
          <div className="newsletter-inner section-wrap">
            <div className="newsletter-title">
              <Clock3 />
              <h2>
                Don’t miss
                <br />
                <em>the close.</em>
              </h2>
            </div>
            <div className="newsletter-form">
              <p>Get a short email when new apparel auctions open and when saved listings are close to ending.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubscribed(true);
                }}
              >
                <label className="sr-only" htmlFor="newsletter-email">
                  Your email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setSubscribed(false);
                  }}
                  required
                  autoComplete="email"
                />
                <button aria-label="Join the lelam list" type="submit">
                  {subscribed ? <Check /> : <ArrowRight />}
                </button>
              </form>
              <span className="newsletter-note" role="status">
                {subscribed
                  ? "You’re on the preview list! Your email is saved for this session."
                  : "No daily promos. Just useful auction alerts."}
              </span>
            </div>
          </div>
        </section>
      </main>

      <HalftoneWordmarkFooter
        wordmark="lelam.co"
        label="lelam.co Archive"
        meta="©2026 · Curated Vintage & Thrift Marketplace"
        preset="night"
        palette={{
          background: "#080808",
          ink: "#f4f4f5",
          warm: "#e9762b",
        }}
        dotGap={6}
        radius={140}
        crop={0.22}
        grain={0.4}
        interactive={true}
        height="560px"
        columns={[
          {
            title: "Marketplace",
            links: [
              { label: "Live auctions", href: "#shop" },
              { label: "On the rail", href: "#rack" },
              { label: "How it works", href: "#how-it-works" },
            ],
          },
          {
            title: "Sellers",
            links: [
              { label: "Sell on lelam", href: "#sell" },
              { label: "Seller guidelines", href: "#sell" },
              { label: "Verification", href: "#how-it-works" },
            ],
          },
          {
            title: "Support",
            links: [
              { label: "Policies & Terms", href: "#shop" },
              { label: "hello@lelam.co", href: "mailto:hello@lelam.co" },
              { label: "Back to top", href: "#top" },
            ],
          },
        ]}
      />

      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            onClick={() => {
              setToast("");
              setSelected(null);
              setOverlay("bag");
            }}
          >
            View bid list <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {selected && (
        <Modal title="A closer look" onClose={() => setSelected(null)}>
          <div className="product-detail">
            <img src={selected.image} alt={selected.name} />
            <div>
              <div className="eyebrow">LIVE AUCTION · {getAuctionInfo(selected).ends} LEFT</div>
              <h2>{selected.name}</h2>
              <span className="detail-price">Current bid {money(selected.price)}</span>
              <p>{selected.description}</p>
              <div className="size-label">
                SIZE {selected.size} · {getAuctionInfo(selected).condition} CONDITION · {getAuctionInfo(selected).bids} BIDS
              </div>
              <button
                className="button button-olive"
                onClick={() => addToBag(selected)}
              >
                {bag.includes(selected.id)
                  ? "View bid list"
                  : "Add to bid list"}
                <Gavel size={18} />
              </button>
              <button
                className="detail-save"
                onClick={() => favorite(selected.id)}
              >
                <Heart
                  size={16}
                  fill={
                    favorites.includes(selected.id) ? "currentColor" : "none"
                  }
                />
                {favorites.includes(selected.id)
                  ? "On your watchlist"
                  : "Save to watchlist"}
              </button>
              <div className="detail-shipping">
                <Truck size={17} /> Shipping and pickup details are set by the seller.
              </div>
            </div>
          </div>
        </Modal>
      )}

      {overlay && (
        <Modal
          title={
            overlay === "bag"
              ? `Your bid list (${bag.length})`
              : overlay === "search"
                ? "Search live auctions"
                : overlay === "saved"
                  ? "Your watchlist"
                  : overlay === "checkout"
                    ? "Bid list preview"
                    : overlay === "shipping"
                      ? "Auction policies"
                      : "Seller support"
          }
          onClose={() => {
            setOverlay(null);
            setQuery("");
          }}
          drawer={overlay === "bag"}
        >
          {overlay === "bag" && (
            <div className="bag-content">
              {bagProducts.length ? (
                <>
                  <p className="modal-subtitle">
                    Listings you are considering. This preview does not submit bids or take payment.
                  </p>
                  <div className="bag-items">
                    {bagProducts.map((product) => (
                      <div className="bag-item" key={product.id}>
                        <img src={product.image} alt={product.name} />
                        <div>
                          <h3>{product.name}</h3>
                          <span>SIZE {product.size} · CURRENT BID</span>
                          <strong>{money(product.price)}</strong>
                        </div>
                        <button
                          className="icon-button"
                          onClick={() =>
                            setBag((previous) =>
                              previous.filter((id) => id !== product.id),
                            )
                          }
                          aria-label={`Remove ${product.name}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="bag-summary">
                    <p className="shipping-progress">
                      {bag.length === 1
                        ? "Review the listing details before placing a live bid."
                        : `${bag.length} listings are ready for review.`}
                    </p>
                    <div className="progress-track">
                      <span style={{ width: `${Math.min(subtotal, 100)}%` }} />
                    </div>
                    <div className="subtotal">
                      <span>Current bid total</span>
                      <strong>{money(subtotal)}</strong>
                    </div>
                    <p>Final price, shipping, and payment are confirmed with the seller after an auction closes.</p>
                    <button
                      className="button button-olive"
                      onClick={() => setOverlay("checkout")}
                    >
                      Review bid list <ArrowRight size={18} />
                    </button>
                    <span className="checkout-note">
                      Demo only — no bid or order will be placed.
                    </span>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <Gavel size={45} strokeWidth={1} />
                  <h2>
                    Your bid list is
                    <br />
                    <em>empty.</em>
                  </h2>
                  <p>Save or add a live auction here so you can review it before bidding.</p>
                  <button
                    className="button button-olive"
                    onClick={() => {
                      setOverlay(null);
                      browse();
                    }}
                  >
                    Let’s find it <ArrowUpRight size={18} />
                  </button>
                </div>
              )}
            </div>
          )}
          {overlay === "search" && (
            <div className="search-content">
              <div className="search-input">
                <Search size={21} />
                <input
                  aria-label="Search products"
                  autoFocus
                  placeholder="Try denim, knits, a little leather…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    className="icon-button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <p className="modal-subtitle">
                {query
                  ? `${searchResults.length} ${searchResults.length === 1 ? "auction" : "auctions"} for “${query}”`
                  : "Search by item name, category, or era."}
              </p>
              <div className="modal-product-grid">
                {searchResults.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {!searchResults.length && (
                <div className="empty-state">
                  <Search size={34} />
                  <h2>
                    No auctions <em>match that search.</em>
                  </h2>
                  <p>Try denim, leather, knit, or a category name.</p>
                </div>
              )}
            </div>
          )}
          {overlay === "saved" && (
            <div className="saved-content">
              {favorites.length ? (
                <>
                  <p className="modal-subtitle">
                    Listings you saved to compare before bidding.
                  </p>
                  <div className="modal-product-grid">
                    {products
                      .filter((product) => favorites.includes(product.id))
                      .map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <Heart size={44} strokeWidth={1} />
                  <h2>
                    Your watchlist is <em>empty.</em>
                  </h2>
                  <p>Tap the heart on an auction to keep it here.</p>
                  <button
                    className="button button-olive"
                    onClick={() => {
                      setOverlay(null);
                      browse();
                    }}
                  >
                    Browse live auctions <ArrowUpRight size={18} />
                  </button>
                </div>
              )}
            </div>
          )}
          {overlay === "shipping" && (
            <div className="prose">
              <div className="eyebrow">AUCTION POLICIES</div>
              <h2>
                Clear terms.
                <br />
                <em>Before you bid.</em>
              </h2>
              <h3>Listing information</h3>
              <p>
                Sellers provide the size, condition, and delivery or pickup details for each item. Read the full listing before adding it to your bid list.
              </p>
              <h3>Closing times</h3>
              <p>
                The time shown on a listing is the planned auction close. A live version of lelam.co will confirm the final bid and winner through the connected auction service.
              </p>
              <h3>Preview status</h3>
              <p>
                This design preview does not accept bids, take payment, or place orders.
              </p>
            </div>
          )}
          {overlay === "contact" && (
            <div className="prose">
              <h2>
                Build your <em>auction channel.</em>
              </h2>
              <p>
                Are you a thrift store or curated reseller? The marketplace is designed for one-of-one apparel listings with clear seller information and auction windows.
              </p>
              <p>
                This preview is ready for the next integration step: seller onboarding, live bid submission, payments, and order fulfillment.
              </p>
              <button
                className="button button-olive"
                onClick={() => {
                  setOverlay(null);
                  browse();
                }}
              >
                Back to live auctions <ArrowUpRight size={18} />
              </button>
            </div>
          )}
          {overlay === "checkout" && (
            <div className="prose checkout-preview">
              <div className="eyebrow">BID LIST PREVIEW</div>
              <h2>
                Ready for the
                <br />
                <em>auction flow?</em>
              </h2>
              <p>
                Your selected listings are saved on this device. This preview is not connected to a live auction service, so no bid will be submitted, no payment will be taken, and no order will be placed.
              </p>
              <div className="checkout-totals">
                <div>
                  <span>Current bid total</span>
                  <strong>{money(subtotal)}</strong>
                </div>
                <div>
                  <span>Listings selected</span>
                  <strong>{bag.length}</strong>
                </div>
                <div>
                  <span>Next step</span>
                  <strong>Live integration</strong>
                </div>
              </div>
              <button
                className="button button-olive"
                onClick={() => setOverlay("bag")}
              >
                Back to your bid list <Gavel size={18} />
              </button>
              <p className="checkout-note">
                Live bidding, payments, seller verification, and fulfillment connect here when the store launches.
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
