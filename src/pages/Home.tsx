import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Gavel,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import { ParallaxComponent } from "@/components/ui/parallax-scrolling";
import { ClothingRailHero } from "@/components/ui/product-rail-gallery";
import { AuctionCard } from "../components/AuctionCard";
import { Link, navigate } from "../components/Link";
import { ProductCard } from "../components/ProductCard";
import { useStore } from "../lib/store";

const categoryTiles = [
  { name: "Outerwear", image: "/images/leather.jpg", label: "Jackets & layers" },
  { name: "Tops & knits", image: "/images/knit.jpg", label: "Easy everyday" },
  { name: "Denim", image: "/images/jeans.jpg", label: "Built to last" },
  { name: "Accessories", image: "/images/bag.jpg", label: "The finishing piece" },
];

export function HomePage() {
  const { db, addToCart, user } = useStore();
  const active = db.products.filter((product) => product.status === "active");
  const recent = [...active]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
  const live = db.auctions.filter((auction) => auction.status === "live");
  const upcoming = db.auctions
    .filter((auction) => auction.status === "scheduled")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 3);
  const completed = db.auctions
    .filter((auction) => auction.status === "completed")
    .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime())
    .slice(0, 3);
  const sold = db.products.filter((product) => product.status === "sold").slice(0, 4);

  const railItems = active.slice(0, 8).map((product) => ({
    id: product.id,
    name: product.title,
    description: product.description,
    image: product.images[0],
    tag: product.size,
    details: [product.condition, product.category, product.sellerName],
  }));

  const buyFirst = () => {
    const product = active.find((item) => item.sellerId !== user?.id) ?? active[0];
    if (!product) {
      navigate("#/products");
      return;
    }
    const result = addToCart(product.id);
    if (result.ok) navigate("#/cart");
  };

  return (
    <main id="top" className="marketplace-home">
      <ParallaxComponent />

      <div className="promise-strip">
        <span>
          <ShoppingBag size={17} /> Buy now or make an offer
        </span>
        <span>
          <ShieldCheck size={18} /> Condition and seller details shown
        </span>
        <span>
          <Gavel size={17} /> Optional live auctions, never the default
        </span>
        <span>
          <Truck size={17} /> Doorstep delivery across Trivandrum
        </span>
      </div>

      <section className="rail-section" id="rack">
        {railItems.length > 0 ? (
          <ClothingRailHero
            items={railItems}
            hanger="none"
            autoplay={true}
            eyebrow="ON THE RAIL · FRESH FROM THE CLOSET"
            heading="Handle the pieces directly on the rack."
            caption="Slide the hangers, brush across to swing, or click any piece to lift and rotate front and back."
            action={
              <Link href="#/products" className="button button-olive inline-flex items-center gap-2">
                Shop the full rail <ArrowRight size={16} />
              </Link>
            }
          />
        ) : (
          <div className="section-wrap rail-empty">
            <div className="eyebrow">THE RAIL IS EMPTY</div>
            <h2>Be the first to hang something up.</h2>
            <Link href="#/sell" className="button button-olive">
              Start selling <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </section>

      <section className="home-search-strip">
        <div className="home-search-inner section-wrap">
          <div>
            <div className="eyebrow">FIND SOMETHING GOOD</div>
            <h2>What are you hunting for?</h2>
          </div>
          <form
            className="home-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const query = String(data.get("q") || "").trim();
              navigate(`#/products${query ? `?q=${encodeURIComponent(query)}` : ""}`);
            }}
          >
            <Search size={18} />
            <input name="q" placeholder="Denim, knitwear, a leather jacket…" aria-label="Search listings" />
            <button type="submit" className="button button-olive">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="shop-section section-wrap" aria-labelledby="recent-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">RECENTLY LISTED</div>
            <h2 id="recent-title">New on the rail.</h2>
            <p className="section-intro">
              Straight from local closets. Every price is the seller&apos;s asking price — no bidding required.
            </p>
          </div>
          <Link href="#/products" className="text-link">
            View all listings <ArrowUpRight size={18} />
          </Link>
        </div>
        {recent.length ? (
          <div className="product-grid">
            {recent.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <ShoppingBag size={34} />
            <h2>Nothing listed yet.</h2>
            <p>Be the first to sell something from your closet.</p>
            <Link href="#/sell" className="button button-olive">
              List an item
            </Link>
          </div>
        )}
        <div className="shop-footnote">
          <ShieldCheck size={15} />
          <span>
            Ask a question, make a private offer, or buy instantly. Auctions only happen when a seller opts in.
          </span>
        </div>
      </section>

      <section className="auction-home-section" id="live-auctions">
        <div className="section-wrap">
          <div className="section-heading section-heading-light">
            <div>
              <div className="eyebrow">THE RANDOM AUCTION</div>
              <h2>A few pieces go live. Then they&apos;re gone.</h2>
              <p className="section-intro">
                A handful of opted-in listings are picked each day for a short, anonymous live auction.
                Everyone else stays buy-now.
              </p>
            </div>
            <Link href="#/auctions" className="text-link text-link-light">
              All auctions <ArrowUpRight size={18} />
            </Link>
          </div>

          {live.length ? (
            <div className="auction-grid">
              {live.slice(0, 3).map((auction) => {
                const product = db.products.find((item) => item.id === auction.productId);
                return product ? (
                  <AuctionCard key={auction.id} auction={auction} product={product} />
                ) : null;
              })}
            </div>
          ) : (
            <div className="auction-empty">
              <Clock3 size={24} />
              <p>No auction running right now. The marketplace is still open.</p>
              <Link href="#/products" className="button button-light">
                Shop normally
              </Link>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="upcoming-strip">
              <span className="upcoming-label">UP NEXT</span>
              {upcoming.map((auction) => {
                const product = db.products.find((item) => item.id === auction.productId);
                if (!product) return null;
                return (
                  <Link key={auction.id} href={`#/auction/${auction.id}`} className="upcoming-item">
                    <img src={product.images[0]} alt={product.title} />
                    <span>
                      <strong>{product.title}</strong>
                      <em>
                        {new Date(auction.startsAt).toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </em>
                    </span>
                    <ArrowUpRight size={15} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="collections-section section-wrap" id="collections">
        <div className="section-heading">
          <div>
            <div className="eyebrow">BROWSE QUICKLY</div>
            <h2>Start with a category.</h2>
          </div>
          <span className="section-aside">Shortcuts into the pieces people are browsing now.</span>
        </div>
        <div className="collection-grid collection-grid-four">
          {categoryTiles.map((tile, index) => (
            <Link
              key={tile.name}
              href={`#/products?category=${encodeURIComponent(tile.name)}`}
              className={`collection-card ${index % 2 === 0 ? "collection-denim" : "collection-everyday"}`}
            >
              <img src={tile.image} alt={`${tile.name} listings`} />
              <span className="collection-number">CATEGORY / {String(index + 1).padStart(2, "0")}</span>
              <div className="collection-copy">
                <span>{tile.name.toUpperCase()}</span>
                <h3>{tile.label}</h3>
                <span className="collection-link">
                  Explore {tile.name.toLowerCase()} <ArrowUpRight size={18} />
                </span>
              </div>
              <span className="collection-arrow">
                <ArrowUpRight />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="how-it-works section-wrap" id="how-it-works" aria-labelledby="how-it-works-title">
        <div className="section-kicker">A SIMPLE WAY TO BUY BETTER</div>
        <h2 id="how-it-works-title">Know what happens before you pay.</h2>
        <div className="process-grid">
          <div className="process-step">
            <span className="process-number">01</span>
            <Search size={19} />
            <h3>Find a listing</h3>
            <p>Filter by category, then review the size, condition, seller, and asking price.</p>
          </div>
          <div className="process-step">
            <span className="process-number">02</span>
            <ShoppingBag size={19} />
            <h3>Buy or offer</h3>
            <p>Buy instantly, add to your cart, or send the seller a private offer on their asking price.</p>
          </div>
          <div className="process-step">
            <span className="process-number">03</span>
            <ShieldCheck size={19} />
            <h3>Get it delivered</h3>
            <p>Choose a Trivandrum address. The seller arranges pickup and you track the delivery.</p>
          </div>
        </div>
      </section>

      {completed.length > 0 && (
        <section className="recently-sold section-wrap">
          <div className="section-heading">
            <div>
              <div className="eyebrow">RECENT AUCTION RESULTS</div>
              <h2>Found a new home.</h2>
            </div>
            <Link href="#/auctions?tab=completed" className="text-link">
              Auction history <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="auction-grid">
            {completed.map((auction) => {
              const product = db.products.find((item) => item.id === auction.productId);
              return product ? <AuctionCard key={auction.id} auction={auction} product={product} /> : null;
            })}
          </div>
        </section>
      )}

      {sold.length > 0 && (
        <section className="sold-strip section-wrap">
          <div className="section-heading">
            <div>
              <div className="eyebrow">ALREADY GONE</div>
              <h2>Recently sold.</h2>
            </div>
            <span className="section-aside">A look at what just left the rail.</span>
          </div>
          <div className="sold-grid">
            {sold.map((product) => (
              <Link key={product.id} href={`#/product/${product.id}`} className="sold-item">
                <img src={product.images[0]} alt={product.title} />
                <span>
                  <strong>{product.title}</strong>
                  <em>Sold</em>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="seller-section" id="sell" aria-labelledby="seller-title">
        <div className="seller-section-inner section-wrap">
          <div className="seller-icon">
            <Store size={25} />
          </div>
          <div>
            <div className="eyebrow">SELL ON LELAM</div>
            <h2 id="seller-title">Your closet is someone&apos;s next favourite.</h2>
            <p>
              List the pieces you have stopped wearing, set your own price, and reach people already
              hunting for one-off clothes. Opt in to auctions only if you want to.
            </p>
          </div>
          <div className="seller-cta-group">
            <Link href="#/sell" className="button button-light">
              Start selling <ArrowUpRight size={16} />
            </Link>
            <button className="button button-ghost-light" onClick={buyFirst}>
              Try a buy-now listing
            </button>
          </div>
        </div>
      </section>

      <section className="newsletter">
        <div className="newsletter-inner section-wrap">
          <div className="newsletter-title">
            <Clock3 />
            <h2>
              New finds,
              <br />
              <em>not noise.</em>
            </h2>
          </div>
          <div className="newsletter-form">
            <p>
              Get a short email when new listings land and when the few live auctions are about to close.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                form.reset();
                const note = form.parentElement?.querySelector(".newsletter-note");
                if (note) note.textContent = "You're on the list. No daily promos, just useful alerts.";
              }}
            >
              <label className="sr-only" htmlFor="newsletter-email">
                Your email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                placeholder="Email address"
                required
                autoComplete="email"
              />
              <button aria-label="Join the lelam list" type="submit">
                <ArrowRight />
              </button>
            </form>
            <span className="newsletter-note" role="status">
              No daily promos. Just useful marketplace alerts.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
