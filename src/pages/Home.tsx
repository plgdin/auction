import { useState, useMemo, useEffect } from "react";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { ClothingRailHero } from "@/components/ui/product-rail-gallery";
import { Link } from "../components/Link";
import { ProductCard } from "../components/ProductCard";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";

// Modular Home Components
import { CollageHero } from "../components/home/CollageHero";
import { MarketBulletinTicker } from "../components/home/MarketBulletinTicker";
import { EndingSoonRow, type LiveLot } from "../components/home/EndingSoonRow";
import { ClotheslineCategories } from "../components/home/ClotheslineCategories";
import { ZineStoryboard } from "../components/home/ZineStoryboard";
import { CuratorSpotlight } from "../components/home/CuratorSpotlight";
import { SustainabilitySection } from "../components/home/SustainabilitySection";
import { TrustStrip } from "../components/home/TrustStrip";
import { TearOffCoupon } from "../components/home/TearOffCoupon";

const CATEGORY_TABS = ["All Pieces", "Clothing", "Outerwear", "Denim", "Homeware"];

const INITIAL_LOTS: LiveLot[] = [
  {
    id: "lot-1",
    title: "1992 Schott Leather Flight Bomber",
    category: "Outerwear · Size 42",
    currentBid: 3200,
    bidCount: 24,
    secondsRemaining: 412,
    leader: "@vintage_hunter",
    imageSvgType: "jacket",
    lotNumber: "LOT 042",
  },
  {
    id: "lot-2",
    title: "1974 Olympus OM-1 35mm SLR",
    category: "Curios · Tested Working",
    currentBid: 4800,
    bidCount: 31,
    secondsRemaining: 540,
    leader: "@analog_kerala",
    imageSvgType: "camera",
    lotNumber: "LOT 088",
  },
  {
    id: "lot-3",
    title: "1985 Nike Dunk High 'Be True'",
    category: "Footwear · UK 9",
    currentBid: 5600,
    bidCount: 42,
    secondsRemaining: 1840,
    leader: "@archival_sole",
    imageSvgType: "sneaker",
    lotNumber: "LOT 014",
  },
  {
    id: "lot-4",
    title: "Big E Levi's 501 Selvedge 1984",
    category: "Denim · W32 L32",
    currentBid: 2900,
    bidCount: 19,
    secondsRemaining: 2310,
    leader: "@denimhead_tvm",
    imageSvgType: "denim",
    lotNumber: "LOT 029",
  },
  {
    id: "lot-5",
    title: "Gucci 1970s Monogram Webbing Tote",
    category: "Bags · Authentic Serial",
    currentBid: 6800,
    bidCount: 38,
    secondsRemaining: 3420,
    leader: "@clara_vintage",
    imageSvgType: "bag",
    lotNumber: "LOT 055",
  },
  {
    id: "lot-6",
    title: "Mid-Century Studio Splatter Jug",
    category: "Home & Decor · Stoneware",
    currentBid: 950,
    bidCount: 12,
    secondsRemaining: 510,
    leader: "@ceramic_soul",
    imageSvgType: "mug",
    lotNumber: "LOT 103",
  },
];

export function HomePage() {
  const { db } = useStore();
  const [activeCategory, setActiveCategory] = useState("All Pieces");
  const [lots, setLots] = useState<LiveLot[]>(INITIAL_LOTS);
  const [floatingBids, setFloatingBids] = useState<{ [lotId: string]: boolean }>({});

  // Real-time ticking auction countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setLots((prev) =>
        prev.map((lot) => ({
          ...lot,
          secondsRemaining: lot.secondsRemaining > 0 ? lot.secondsRemaining - 1 : 0,
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePlaceBid = (lotId: string) => {
    setLots((prev) =>
      prev.map((l) => {
        if (l.id === lotId) {
          return {
            ...l,
            currentBid: l.currentBid + 100,
            bidCount: l.bidCount + 1,
            isWinning: true,
            leader: "YOU",
          };
        }
        return l;
      })
    );

    setFloatingBids((prev) => ({ ...prev, [lotId]: true }));
    setTimeout(() => {
      setFloatingBids((prev) => ({ ...prev, [lotId]: false }));
    }, 800);

    toast("Bid placed! You are currently winning this lot.");
  };

  const active = useMemo(
    () => db.products.filter((product) => product.status === "active"),
    [db.products]
  );

  const filteredProducts = useMemo(() => {
    if (activeCategory === "All Pieces") return active;
    if (activeCategory === "Outerwear") {
      return active.filter(
        (p) =>
          p.title.toLowerCase().includes("jacket") ||
          p.title.toLowerCase().includes("coat") ||
          p.description.toLowerCase().includes("leather")
      );
    }
    if (activeCategory === "Denim") {
      return active.filter(
        (p) =>
          p.title.toLowerCase().includes("denim") ||
          p.title.toLowerCase().includes("jeans") ||
          p.description.toLowerCase().includes("denim")
      );
    }
    return active.filter((p) => p.category.toLowerCase() === activeCategory.toLowerCase());
  }, [active, activeCategory]);

  const railItems = useMemo(() => {
    const clothingOnly = db.products.filter((product) => {
      if (product.status !== "active" && product.status !== "pending") return false;
      const cat = (product.category || "").toLowerCase();
      const title = (product.title || "").toLowerCase();
      if (cat.includes("bag") || cat.includes("accessories") || cat.includes("homeware")) return false;
      if (
        title.includes("bag") ||
        title.includes("jeans") ||
        title.includes("501") ||
        title.includes("pant") ||
        title.includes("wallet") ||
        title.includes("tote")
      ) {
        return false;
      }
      return true;
    });

    const getGarmentKind = (title: string, desc: string): "jacket" | "hoodie" | "knit" | "shirt" | "tee" | "coat" => {
      const text = `${title} ${desc}`.toLowerCase();
      if (text.includes("hoodie")) return "hoodie";
      if (text.includes("leather") || text.includes("jacket") || text.includes("bomber")) return "jacket";
      if (text.includes("coat") || text.includes("trench")) return "coat";
      if (
        text.includes("knit") ||
        text.includes("cardigan") ||
        text.includes("sweater") ||
        text.includes("sweatshirt") ||
        text.includes("breton")
      )
        return "knit";
      if (text.includes("shirt") || text.includes("polo") || text.includes("oxford") || text.includes("henley"))
        return "shirt";
      return "tee";
    };

    return clothingOnly.slice(0, 8).map((product) => {
      const kind = getGarmentKind(product.title, product.description);
      return {
        id: product.id,
        name: product.title,
        description: product.description,
        kind,
        image: product.images[0],
        color: product.color || "#dfded9",
        tag: `₹${Math.round(product.askingPrice / 100)}`,
        details: [
          `Condition: ${product.condition}`,
          `Size: ${product.size || "M"}`,
          `Brand: ${product.brand}`,
          `Seller: ${product.sellerName}`,
          `Location: ${product.location}`,
        ],
      };
    });
  }, [db.products]);

  return (
    <main id="top" className="relic-marketplace-home bg-[#0c0e09] text-[#F3EBDD] overflow-hidden">
      {/* 1. Hero Section: "Collage Meets Auction House" */}
      <CollageHero />

      {/* 2. Live Market Bulletin Ticker */}
      <MarketBulletinTicker />

      {/* 3. The Signature Brass Clothing Rail (KEPT INTACT!) */}
      <section className="rail-section w-full bg-[#0c0e09] border-b border-white/10" id="rack">
        {railItems.length > 0 && (
          <ClothingRailHero
            items={railItems}
            hanger="wood"
            autoplay={true}
            interval={3200}
            eyebrow="ON THE BRASS RAIL · LIVE CLOSET ARCHIVES"
            heading="Handle the garments directly on the rail"
            caption="Slide hangers along the brass pipe, brush across to swing, or click any piece to inspect details."
            action={
              <Link href="#/products" className="btn-stamp inline-flex items-center gap-2 px-6 py-2.5 text-xs">
                <span>Shop full wardrobe</span>
                <ArrowUpRight size={15} />
              </Link>
            }
          />
        )}
      </section>

      {/* 4. Ending Soon Live Auction Row */}
      <EndingSoonRow
        lots={lots}
        onPlaceBid={handlePlaceBid}
        floatingBids={floatingBids}
      />

      {/* 5. The Clothesline Categories */}
      <ClotheslineCategories />

      {/* 6. Fresh Drops on the Rail: Real Inventory Showcase */}
      <section className="shop-section section-wrap py-12 sm:py-16 border-t border-white/10" id="rail">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="stamp-badge mb-2">★ ONE OF A KIND VINTAGE ★</div>
            <h2 className="text-3xl sm:text-5xl font-serif text-white">
              Fresh Drops on the <span className="italic text-[#E4472B]">Rail</span>
            </h2>
            <p className="text-stone-300 text-sm sm:text-base max-w-xl mt-2">
              Every piece hand-inspected in Trivandrum for fabric integrity, original tags, and honest wear.
            </p>
          </div>
          <Link
            href="#/products"
            className="btn-tape-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold text-[#E9B949]"
          >
            <span>View All {active.length} Wardrobes</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const isSelected = activeCategory === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCategory(tab)}
                className={`px-4 py-1.5 text-xs font-mono font-bold uppercase rounded-md transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-[#E9B949] text-[#161412] shadow-[2px_2px_0_#161412]"
                    : "bg-white/5 text-stone-300 hover:bg-white/10 border border-white/10"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length > 0 ? (
          <div className="product-grid">
            {filteredProducts.slice(0, 8).map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-white/5 rounded-xl border border-white/10">
            <ShoppingBag size={32} className="mx-auto text-stone-500 mb-2" />
            <h3 className="text-base font-bold text-white">No items found</h3>
            <button
              type="button"
              onClick={() => setActiveCategory("All Pieces")}
              className="mt-3 px-4 py-2 text-xs font-mono font-bold rounded bg-[#E9B949] text-[#161412]"
            >
              Reset Filter
            </button>
          </div>
        )}
      </section>

      {/* 7. How It Works: 3-Step Zine Storyboard */}
      <ZineStoryboard />

      {/* 8. Curator Zine Spotlight */}
      <CuratorSpotlight />

      {/* 9. Lichen Sage Sustainability Section */}
      <SustainabilitySection />

      {/* 10. Stamped Trust Strip */}
      <TrustStrip />

      {/* 11. Perforated Tear-Off Coupon */}
      <TearOffCoupon />

      {/* Custom footer is preserved in App.tsx (<HalftoneWordmarkFooter />) */}
    </main>
  );
}

export default HomePage;
