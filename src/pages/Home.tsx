import {
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
} from "lucide-react";
import { ParallaxComponent } from "@/components/ui/parallax-scrolling";
import { ClothingRailHero } from "@/components/ui/product-rail-gallery";
import { Link } from "../components/Link";
import { ProductCard } from "../components/ProductCard";
import { CATEGORY_TILES } from "../lib/categories";
import { useStore } from "../lib/store";

export function HomePage() {
  const { db } = useStore();
  const active = db.products.filter((product) => product.status === "active");
  const recent = [...active]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const railItems = active.slice(0, 8).map((product) => ({
    id: product.id,
    name: product.title,
    description: product.description,
    image: product.images[0],
    tag: product.size,
    details: [product.condition, product.category, product.sellerName],
  }));

  return (
    <main id="top" className="marketplace-home">
      <ParallaxComponent
        eyebrow="A LOCAL MARKETPLACE FOR PRE-LOVED FINDS"
        title="Good pieces. New stories."
        subtitle="Discover one-of-a-kind pieces from local closets."
        showContent={false}
      />

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
      </section>

      <section className="home-auction-link section-wrap" aria-label="Auctions">
        <p>Looking for a little excitement?</p>
        <Link href="#/auctions" className="text-link">
          Explore live auctions <ArrowUpRight size={16} />
        </Link>
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
          {CATEGORY_TILES.map((tile, index) => (
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

      <section className="home-sell-link section-wrap" id="sell">
        <div>
          <div className="eyebrow">SELL ON LELAM</div>
          <h2>Ready to pass a piece along?</h2>
        </div>
        <Link href="#/sell" className="button button-olive">
          Start selling <ArrowUpRight size={16} />
        </Link>
      </section>
    </main>
  );
}
