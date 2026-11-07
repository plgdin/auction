import { useState, useMemo } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Layers,
  Clock,
} from "lucide-react";
import {
  FileTextIcon,
  InputIcon,
  GlobeIcon,
  CalendarIcon,
  BellIcon,
} from "@radix-ui/react-icons";
import { motion } from "framer-motion";
import { Hero } from "@/components/ui/animated-hero";
import { ClothingRailHero } from "@/components/ui/product-rail-gallery";
import { Marquee } from "@/components/ui/marquee";
import { GlareCard } from "@/components/ui/glare-card";
import NumberTicker from "@/components/ui/number-ticker-02";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { TaglineReveal } from "@/components/ui/tagline-reveal";
import { AuctionCard } from "../components/AuctionCard";
import { Link, navigate } from "../components/Link";
import { ProductCard } from "../components/ProductCard";
import { useStore } from "../lib/store";

const BRAND_LABELS = [
  "LEVI'S VINTAGE CLOTHING",
  "SCHOTT NYC",
  "RALPH LAUREN ARCHIVE",
  "CARHARTT WORKWEAR",
  "BARBOUR HERITAGE",
  "MAISON MARGIELA",
  "COMME DES GARÇONS",
  "ISSEY MIYAKE",
  "BURBERRY PRORSUM",
  "YOHJI YAMAMOTO",
];

const PROVENANCE_LABELS = [
  "TRIVANDRUM 695XXX COURIER",
  "100% MONEY BACK GUARANTEE",
  "CONFIDENTIAL PRIVATE OFFERS",
  "TIMED WEEKEND DROPS",
  "ZERO COUNTERFEITS",
  "HAND GRADED CONDITION TIERS",
  "LOCAL KERALA WARDROBES",
];

const categoryTiles = [
  { name: "Outerwear", image: "/images/leather.jpg", label: "Jackets and leather bombers" },
  { name: "Tops & knits", image: "/images/knit.jpg", label: "Heavyweight tees and knits" },
  { name: "Denim", image: "/images/jeans.jpg", label: "Archival Japanese denim" },
  { name: "Accessories", image: "/images/bag.jpg", label: "Leather bags and finishes" },
];

const CATEGORY_TABS = ["All Pieces", "Clothing", "Outerwear", "Denim", "Homeware"];

const steps = [
  {
    step: "01",
    title: "Discover and inspect",
    description: "Browse high resolution photography, fabric grade details, and verified garment measurements.",
  },
  {
    step: "02",
    title: "Buy, offer, or bid",
    description: "Purchase immediately at asking price, negotiate a private confidential offer, or compete in timed auctions.",
  },
  {
    step: "03",
    title: "Direct doorstep delivery",
    description: "Carefully packed and fulfilled straight to your home across Kerala with real time courier tracking.",
  },
];

const testimonials = [
  {
    quote: "Found an original 90s leather aviator jacket in Trivandrum. The condition rating was spot on and arrived the next afternoon.",
    author: "Rohan Mathew",
    role: "Vintage Collector · Kowdiar",
    item: "Purchased Schott Leather Bomber",
  },
  {
    quote: "Listing from my closet took under three minutes. Sold two Japanese selvedge denim pairs through private offers without any hassle.",
    author: "Ananya Pillai",
    role: "Seller · Vazhuthacaud",
    item: "Sold 3 pieces this month",
  },
  {
    quote: "The live auction countdown is genuinely exciting. Won an archival oversized trench coat below retail reserve.",
    author: "Devika Nair",
    role: "Buyer · Sasthamangalam",
    item: "Won Vintage Trench Auction",
  },
];

const faqs = [
  {
    question: "How do you verify the condition of pre owned garments?",
    answer: "Every seller submits multi angle photography covering the collar, cuffs, fabric care tags, and hardware. Pieces are graded into four strict tiers: New, Like new, Good, and Fair. Misrepresented items are covered under our full refund guarantee.",
  },
  {
    question: "How do private offers work between buyers and sellers?",
    answer: "When browsing any direct listing, you can tap Make an Offer to propose a reasonable price. The seller receives an instant private notification to accept or counter. If accepted, your checkout reservation is held for 12 hours.",
  },
  {
    question: "What are the rules for live timed auctions?",
    answer: "Auctions open with a minimum starting price and set increment (typically ₹100 or ₹250). Bids placed in the final 60 seconds trigger a 60 second anti snipe extension. The highest bidder at expiration wins the lot.",
  },
  {
    question: "How fast is delivery across Trivandrum and regional Kerala?",
    answer: "Deliveries within Trivandrum city pin codes (695001 to 695043) arrive within 24 to 36 hours. Outer districts across Kerala are dispatched via tracked regional courier within 2 to 3 business days.",
  },
  {
    question: "How do sellers get paid after an item sells?",
    answer: "Payouts are transferred directly to the seller bank account via UPI or IMPS within 24 hours of successful buyer delivery confirmation. Sellers keep 90% of the sale value.",
  },
  {
    question: "Can I return an item if it does not fit?",
    answer: "Exact measurements (chest, length, waist) are documented on every product page. If an item arrives with undisclosed flaws or inaccurate measurements, you can request a return within 48 hours of delivery.",
  },
];

export function HomePage() {
  const { db } = useStore();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState("All Pieces");

  const active = useMemo(
    () => db.products.filter((product) => product.status === "active"),
    [db.products]
  );

  const filteredProducts = useMemo(() => {
    if (activeCategory === "All Pieces") return active;
    if (activeCategory === "Outerwear") {
      return active.filter((p) =>
        p.title.toLowerCase().includes("jacket") ||
        p.title.toLowerCase().includes("coat") ||
        p.description.toLowerCase().includes("leather")
      );
    }
    if (activeCategory === "Denim") {
      return active.filter((p) =>
        p.title.toLowerCase().includes("denim") ||
        p.title.toLowerCase().includes("jeans") ||
        p.description.toLowerCase().includes("denim")
      );
    }
    return active.filter((p) => p.category.toLowerCase() === activeCategory.toLowerCase());
  }, [active, activeCategory]);

  const activeAuctions = useMemo(
    () => db.auctions.filter((a) => a.status === "live" || a.status === "scheduled").slice(0, 3),
    [db.auctions]
  );

  const railItems = useMemo(() => {
    // Strictly filter to clothing only (exclude bags, accessories, pants/jeans, homeware)
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
      if (text.includes("knit") || text.includes("cardigan") || text.includes("sweater") || text.includes("sweatshirt") || text.includes("breton")) return "knit";
      if (text.includes("shirt") || text.includes("polo") || text.includes("oxford") || text.includes("henley")) return "shirt";
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
    <main id="top" className="marketplace-home bg-[#0c0e09] text-white">
      {/* 1. Hero Section - B5 rules: 680px capped, left-to-right text gradient, single primary CTA */}
      <Hero />

      {/* 2. 21st.dev Component: Double Infinite Marquee */}
      <section className="w-full bg-[#131209] border-y border-white/10 py-3 overflow-hidden select-none space-y-2">
        <Marquee duration={28} pauseOnHover={true} fade={true} className="gap-8">
          {BRAND_LABELS.map((brand, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-6 text-xs uppercase tracking-[0.24em] font-medium text-white/50 hover:text-white transition-colors cursor-default"
            >
              <span>{brand}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#c89b3c]" />
            </div>
          ))}
        </Marquee>

        <Marquee duration={34} direction="right" pauseOnHover={true} fade={true} className="gap-8 opacity-75">
          {PROVENANCE_LABELS.map((item, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-6 text-[11px] uppercase tracking-[0.22em] font-medium text-[#c89b3c]/80 hover:text-[#c89b3c] transition-colors cursor-default"
            >
              <span>{item}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            </div>
          ))}
        </Marquee>
      </section>

      {/* 3. The Signature Interactive Clothing Rail (Brass Pipe & Real Hangers) */}
      <section className="rail-section w-full bg-[#0c0e09] border-b border-white/10" id="rack">
        {railItems.length > 0 && (
          <ClothingRailHero
            items={railItems}
            hanger="wood"
            autoplay={true}
            interval={3200}
            eyebrow="ON THE RAIL · LIVE CLOSET ARCHIVES"
            heading="Handle the garments directly on the rail"
            caption="Slide hangers along the brass pipe, brush across to swing, or click any piece to inspect details."
            action={
              <Link href="#/products" className="button button-olive inline-flex items-center gap-2">
                <span>Shop full wardrobe</span>
                <ArrowUpRight size={16} />
              </Link>
            }
          />
        )}
      </section>

      {/* 3. 21st.dev Component: Realtime Animated NumberTicker Metrics Bar */}
      <section className="w-full bg-[#0c0e09] border-b border-white/10 py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-xs uppercase tracking-widest text-stone-400 font-medium mb-1.5 flex items-center gap-1.5">
              <Layers size={14} className="text-[#c89b3c]" /> Verified Archives Listed
            </span>
            <div className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              <NumberTicker value={1240} decimals={0} />
              <span className="text-[#c89b3c] font-normal">+</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-xs uppercase tracking-widest text-stone-400 font-medium mb-1.5 flex items-center gap-1.5">
              <Clock size={14} className="text-[#c89b3c]" /> Timed Auction Drops
            </span>
            <div className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              <NumberTicker value={38} decimals={0} />
              <span className="text-[#c89b3c] font-normal"> lots</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-xs uppercase tracking-widest text-stone-400 font-medium mb-1.5 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-[#c89b3c]" /> Total Collector Volume
            </span>
            <div className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              <NumberTicker value={4820000} currency="INR" decimals={0} />
            </div>
          </div>
        </div>
      </section>

      {/* 4. 21st.dev Component: 3D Holographic GlareCard Showcase */}
      <section className="section-wrap py-8 sm:py-10" id="grails">
        <div className="section-heading flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="eyebrow text-sm sm:text-base font-bold uppercase tracking-[0.22em] text-[#c89b3c]">
              HOLOGRAPHIC SPOTLIGHT
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-2">
              Archival grails of the week
            </h2>
            <p className="text-stone-300 text-base sm:text-lg max-w-xl mt-2 leading-relaxed">
              Hover and tilt to inspect holographic glare physics and fabric sheen. One of a kind collector pieces.
            </p>
          </div>
          <span className="text-xs uppercase tracking-widest text-[#c89b3c] font-medium">
            3D Tilt Enabled
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 justify-items-center">
          {/* GlareCard 1 */}
          <div className="cursor-pointer" onClick={() => navigate("#/products")}>
            <GlareCard className="flex flex-col justify-end p-6 relative overflow-hidden group">
              <img
                src="/images/leather.jpg"
                alt="Vintage Schott Leather Bomber"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="relative z-10">
                <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold bg-[#c89b3c] text-[#0c0e09] rounded-full inline-block mb-2">
                  LOT 042 · VINTAGE GRAIL
                </span>
                <h3 className="text-lg font-bold text-white leading-snug">90s Leather Aviator Bomber</h3>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                  <span className="text-xs text-white/70">Kowdiar · Schott NYC</span>
                  <span className="text-sm font-semibold text-white">₹2,400</span>
                </div>
              </div>
            </GlareCard>
          </div>

          {/* GlareCard 2 */}
          <div className="cursor-pointer" onClick={() => navigate("#/products")}>
            <GlareCard className="flex flex-col justify-end p-6 relative overflow-hidden group">
              <img
                src="/images/jeans.jpg"
                alt="Japanese Selvedge Denim"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="relative z-10">
                <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold bg-[#c89b3c] text-[#0c0e09] rounded-full inline-block mb-2">
                  LOT 018 · RAW ARCHIVE
                </span>
                <h3 className="text-lg font-bold text-white leading-snug">Japanese Selvedge Denim</h3>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                  <span className="text-xs text-white/70">Vazhuthacaud · Edwin 503</span>
                  <span className="text-sm font-semibold text-white">₹1,800</span>
                </div>
              </div>
            </GlareCard>
          </div>

          {/* GlareCard 3 */}
          <div className="cursor-pointer" onClick={() => navigate("#/products")}>
            <GlareCard className="flex flex-col justify-end p-6 relative overflow-hidden group">
              <img
                src="/images/knit.jpg"
                alt="Heavyweight Wool Knitwear"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="relative z-10">
                <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold bg-[#c89b3c] text-[#0c0e09] rounded-full inline-block mb-2">
                  LOT 009 · HEIRLOOM WEAVE
                </span>
                <h3 className="text-lg font-bold text-white leading-snug">Heavyweight Ribbed Knit</h3>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                  <span className="text-xs text-white/70">Sasthamangalam · Woolmark</span>
                  <span className="text-sm font-semibold text-white">₹1,200</span>
                </div>
              </div>
            </GlareCard>
          </div>
        </div>
      </section>

      {/* 5. Fresh Drops on the Rail - Real B2C Product Showcase */}
      <section className="shop-section section-wrap py-8 sm:py-10" id="rail">
        <div className="section-heading flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="eyebrow text-sm sm:text-base font-bold uppercase tracking-[0.22em] text-[#c89b3c]">
              CURATED COLLECTION
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-2">
              Fresh drops on the rail
            </h2>
            <p className="text-stone-300 text-base sm:text-lg max-w-xl mt-2 leading-relaxed">
              One of a kind vintage garments inspected for authenticity and fabric condition. Ready for instant purchase or private offer.
            </p>
          </div>
          <Link href="#/products" className="text-link text-sm font-semibold inline-flex items-center gap-1.5 text-[#c89b3c] hover:underline shrink-0">
            <span>View all {active.length} listings</span>
            <ArrowUpRight size={18} />
          </Link>
        </div>

        {/* B2C Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const isSelected = activeCategory === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCategory(tab)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-[#c89b3c] text-[#0c0e09] font-semibold shadow-md"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Real Product Photography Grid */}
        {filteredProducts.length > 0 ? (
          <div className="product-grid">
            {filteredProducts.slice(0, 8).map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.5,
                  delay: idx * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="empty-state p-12 text-center bg-white/5 rounded-2xl border border-white/10">
            <ShoppingBag size={34} className="mx-auto text-white/40 mb-3" />
            <h3 className="text-lg font-medium text-white">No pieces in this category yet</h3>
            <p className="text-sm text-stone-400 mt-1">Check back soon or explore the full wardrobe archive.</p>
            <button
              type="button"
              onClick={() => setActiveCategory("All Pieces")}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-full bg-[#c89b3c] text-[#0c0e09]"
            >
              Reset filter
            </button>
          </div>
        )}
      </section>

      {/* 6. Mandatory B11 Tagline Reveal Section */}
      <TaglineReveal
        eyebrow="THE MANIFESTO"
        lines={[
          "Every garment carries a past life and honest character.",
          "Hand inspected in Trivandrum and delivered to your doorstep.",
        ]}
      />

      {/* 7. 21st.dev Component: BentoGrid & BentoCard Value Propositions */}
      <section className="section-wrap py-16 sm:py-20" aria-labelledby="bento-title">
        <div className="landing-section-head mb-10 text-center max-w-2xl mx-auto">
          <span className="eyebrow text-sm sm:text-base font-bold uppercase tracking-[0.24em] text-[#c89b3c]">
            WHY CHOOSE LELAM
          </span>
          <h2 id="bento-title" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-2">
            Built for mindful fashion collectors
          </h2>
          <p
            className="text-stone-300 text-base sm:text-lg max-w-xl mx-auto mt-3 leading-relaxed"
            style={{ textWrap: "balance" }}
          >
            No fast fashion landfill. Every garment is selected for longevity, honest condition, and unique provenance.
          </p>
        </div>

        <BentoGrid className="lg:grid-rows-3 max-w-6xl mx-auto">
          <BentoCard
            name="Archival Quality Inspection"
            className="lg:row-start-1 lg:row-end-4 lg:col-start-2 lg:col-end-3"
            background={
              <img className="absolute -right-20 -top-20 opacity-20 object-cover w-full h-full" src="/images/leather.jpg" alt="" />
            }
            Icon={FileTextIcon}
            description="Every vintage piece undergoes physical inspection for seam integrity, authentic care tags, and hardware wear before listing."
            href="#/products"
            cta="Explore archives"
          />

          <BentoCard
            name="Confidential Private Offers"
            className="lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3"
            background={
              <img className="absolute -right-20 -top-20 opacity-20 object-cover w-full h-full" src="/images/jeans.jpg" alt="" />
            }
            Icon={InputIcon}
            description="Propose direct offers without public bidding pressure. 12 hour checkout reservation held on seller acceptance."
            href="#/products"
            cta="Make an offer"
          />

          <BentoCard
            name="Local Kerala Courier"
            className="lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4"
            background={
              <img className="absolute -right-20 -top-20 opacity-20 object-cover w-full h-full" src="/images/bag.jpg" alt="" />
            }
            Icon={GlobeIcon}
            description="Direct doorstep delivery across Trivandrum 695xxx pin codes in 24 to 48 hours."
            href="#/products"
            cta="Check delivery"
          />

          <BentoCard
            name="Timed Weekend Drops"
            className="lg:col-start-3 lg:col-end-3 lg:row-start-1 lg:row-end-2"
            background={
              <img className="absolute -right-20 -top-20 opacity-20 object-cover w-full h-full" src="/images/knit.jpg" alt="" />
            }
            Icon={CalendarIcon}
            description="Rare archival lots run on transparent countdown clocks with anti-snipe extensions."
            href="#/auctions"
            cta="View live drops"
          />

          <BentoCard
            name="Live Outbid Signals"
            className="lg:col-start-3 lg:col-end-3 lg:row-start-2 lg:row-end-4"
            background={
              <img className="absolute -right-20 -top-20 opacity-20 object-cover w-full h-full" src="/images/leather.jpg" alt="" />
            }
            Icon={BellIcon}
            description="Instant real time notification when another collector places a higher bid on your watched lots."
            href="#/auctions"
            cta="Register alerts"
          />
        </BentoGrid>
      </section>

      {/* 8. Live Auctions Section with 21st.dev NumberTicker Live Bids */}
      {activeAuctions.length > 0 && (
        <section className="section-wrap py-8 sm:py-10" aria-labelledby="live-auctions-title">
          <div className="section-heading flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="eyebrow text-sm sm:text-base font-bold uppercase tracking-[0.22em] text-[#c89b3c]">
                LIVE BIDDING ARENA
              </div>
              <h2 id="live-auctions-title" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-2">
                Active auction drops
              </h2>
              <p className="text-stone-300 text-base sm:text-lg max-w-xl mt-2 leading-relaxed">
                Timed public lots with active countdown clocks, dynamic NumberTicker bid updates, and transparent reserve thresholds.
              </p>
            </div>
            <Link href="#/auctions" className="text-link text-sm font-semibold inline-flex items-center gap-1.5 text-[#c89b3c] hover:underline shrink-0">
              <span>View all auctions</span>
              <ArrowUpRight size={18} />
            </Link>
          </div>

          <div className="auction-grid">
            {activeAuctions.map((auction) => {
              const product = db.products.find((p) => p.id === auction.productId);
              if (!product) return null;
              return <AuctionCard key={auction.id} auction={auction} product={product} />;
            })}
          </div>
        </section>
      )}

      {/* 9. Curated Categories - Real Photography Tiles */}
      <section className="collections-section section-wrap py-8 sm:py-10" id="collections">
        <div className="section-heading flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="eyebrow text-sm sm:text-base font-bold uppercase tracking-[0.22em] text-[#c89b3c]">
              CURATED DIRECTORIES
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-2">
              Browse by category
            </h2>
          </div>
          <span className="text-xs uppercase tracking-widest text-[#c89b3c] font-semibold">
            Direct shortcuts into the most active wardrobe rails
          </span>
        </div>

        <div className="collection-grid collection-grid-four">
          {categoryTiles.map((tile, index) => (
            <motion.div
              key={tile.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.55,
                delay: index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link
                href={`#/products?category=${encodeURIComponent(tile.name)}`}
                className={`collection-card ${index % 2 === 0 ? "collection-denim" : "collection-everyday"}`}
              >
                <img src={tile.image} alt={`${tile.name} archives`} />
                <span className="collection-number">ARCHIVE / {String(index + 1).padStart(2, "0")}</span>
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
      </section>

      {/* 10. How It Works - 3 Clear Steps per A2 */}
      <section className="section-wrap py-8 sm:py-10" aria-labelledby="how-it-works-title">
        <div className="landing-section-head mb-6">
          <span className="eyebrow text-sm sm:text-base font-bold uppercase tracking-[0.22em] text-[#c89b3c]">
            THE SIMPLE PROCESS
          </span>
          <h2 id="how-it-works-title" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-2">
            How lelam works
          </h2>
          <p className="text-stone-300 text-base sm:text-lg max-w-xl mt-2 leading-relaxed">
            Three straightforward steps from discovery to doorstep delivery.
          </p>
        </div>

        <div className="how-grid">
          {steps.map((s, idx) => (
            <div key={idx} className="how-card">
              <span className="how-step-num">STEP {s.step}</span>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 11. Social Proof & Customer Reviews - B8 Real Content */}
      <section className="section-wrap py-8 sm:py-10" aria-labelledby="testimonials-title">
        <div className="landing-section-head mb-6">
          <span className="eyebrow text-sm sm:text-base font-bold uppercase tracking-[0.22em] text-[#c89b3c]">
            COMMUNITY REVIEWS
          </span>
          <h2 id="testimonials-title" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-2">
            Trusted by collectors across Kerala
          </h2>
          <p className="text-stone-300 text-base sm:text-lg max-w-xl mt-2 leading-relaxed">
            Real feedback from verified buyers and mindful closet owners.
          </p>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((t, idx) => (
            <div key={idx} className="testimonial-card">
              <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">
                  {t.author
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="testimonial-info">
                  <strong>{t.author}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 12. Objection Handling FAQ Section - A2 / A4 */}
      <section className="section-wrap py-8 sm:py-10" aria-labelledby="faq-title">
        <div className="landing-section-head mb-6">
          <span className="eyebrow text-sm sm:text-base font-bold uppercase tracking-[0.22em] text-[#c89b3c]">
            FREQUENTLY ASKED
          </span>
          <h2 id="faq-title" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-2">
            Everything you need to know
          </h2>
          <p className="text-stone-300 text-base sm:text-lg max-w-xl mt-2 leading-relaxed">
            Clear answers about authenticity, private offers, delivery, and seller payouts.
          </p>
        </div>

        <div className="faq-list">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="faq-item">
                <button
                  type="button"
                  className="faq-trigger"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={`transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isOpen ? "rotate-180 text-stone-900" : "text-stone-400"
                    }`}
                  />
                </button>
                {isOpen && <div className="faq-answer">{faq.answer}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* 13. Final Risk Reversal Call to Action - A2 & A4 */}
      <section className="section-wrap pt-4 pb-12">
        <motion.div
          className="final-cta-section"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="final-cta-content">
            <span className="text-sm sm:text-base uppercase tracking-[0.22em] font-bold text-[#c89b3c] mb-3 inline-block">
              100% MONEY BACK AUTHENTICITY GUARANTEE
            </span>
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white mb-4">
              Find your next archival piece
            </h2>
            <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              Join hundreds of vintage collectors and mindful closet owners in Kerala. Fast local courier delivery, secure payments, and honest condition checks.
            </p>

            <div className="final-cta-actions flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <button
                type="button"
                onClick={() => navigate("#/products")}
                className="inline-flex items-center justify-center gap-2 rounded-full py-2 px-6 text-base font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-lg"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#0c0e09",
                  minHeight: "44px",
                }}
              >
                <ShoppingBag size={17} className="text-[#0c0e09]" />
                <span>Shop the collection</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("#/sell")}
                className="inline-flex items-center justify-center gap-2 rounded-full py-2 px-6 text-base font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  minHeight: "44px",
                }}
              >
                <Sparkles size={17} className="text-[#c89b3c]" />
                <span>Sell a closet piece</span>
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

export default HomePage;
