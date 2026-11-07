import {
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
} from "lucide-react";
import { motion } from "framer-motion";
import { Hero } from "@/components/ui/animated-hero";
import { ClothingRailHero } from "@/components/ui/product-rail-gallery";
import { Link } from "../components/Link";
import { ProductCard } from "../components/ProductCard";
import { useStore } from "../lib/store";

const categoryTiles = [
  { name: "Women", image: "/images/denim.jpg", label: "Clothing & more" },
  { name: "Men", image: "/images/knit.jpg", label: "Outerwear to basics" },
  { name: "Electronics", image: "/images/jeans.jpg", label: "Tech, tested" },
  { name: "Sports", image: "/images/bag.jpg", label: "Gear up" },
];

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
      <Hero />

      <motion.section
        className="rail-section"
        id="rack"
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
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
      </motion.section>

      <motion.section
        className="shop-section section-wrap"
        aria-labelledby="recent-title"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
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
            {recent.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  duration: 0.6,
                  delay: idx * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <ProductCard product={product} />
              </motion.div>
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
      </motion.section>

      <motion.section
        className="home-auction-link section-wrap"
        aria-label="Auctions"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-70px" }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <p>Looking for a little excitement?</p>
        <Link href="#/auctions" className="text-link">
          Explore live auctions <ArrowUpRight size={16} />
        </Link>
      </motion.section>

      <motion.section
        className="collections-section section-wrap"
        id="collections"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="section-heading">
          <div>
            <div className="eyebrow">BROWSE QUICKLY</div>
            <h2>Start with a category.</h2>
          </div>
          <span className="section-aside">Shortcuts into the pieces people are browsing now.</span>
        </div>
        <div className="collection-grid collection-grid-four">
          {categoryTiles.map((tile, index) => (
            <motion.div
              key={tile.name}
              initial={{ opacity: 0, y: 35, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.65,
                delay: index * 0.09,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link
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
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="home-sell-link section-wrap"
        id="sell"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <div className="eyebrow">SELL ON LELAM</div>
          <h2>Ready to pass a piece along?</h2>
        </div>
        <Link href="#/sell" className="button button-olive">
          Start selling <ArrowUpRight size={16} />
        </Link>
      </motion.section>
    </main>
  );
}
