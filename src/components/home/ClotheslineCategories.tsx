import { motion } from "framer-motion";
import { navigate } from "../Link";

const CLOTHESLINE_CATEGORIES = [
  { id: "tees", label: "Vintage Tees", count: 48, icon: "👕", tag: "FROM ₹450" },
  { id: "denim", label: "Raw Denim", count: 32, icon: "👖", tag: "SELVEDGE" },
  { id: "outerwear", label: "Outerwear", count: 24, icon: "🧥", tag: "LEATHER/WOOL" },
  { id: "sneakers", label: "Sneakers", count: 19, icon: "👟", tag: "RETRO" },
  { id: "bags", label: "Leather Bags", count: 15, icon: "👜", tag: "ARCHIVAL" },
  { id: "homeware", label: "Home & Curios", count: 28, icon: "🏺", tag: "CERAMICS" },
  { id: "vinyl", label: "Books & Vinyl", count: 41, icon: "📻", tag: "1ST PRESS" },
  { id: "accessories", label: "Accessories", count: 37, icon: "🕶️", tag: "VERIFIED" },
];

export function ClotheslineCategories() {
  return (
    <section className="section-wrap py-14 sm:py-20 border-t border-white/10" id="categories">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="stamp-badge mb-2">★ HANDMADE DIRECTORIES ★</div>
        <h2 className="text-3xl sm:text-5xl font-serif text-white">
          The Clothesline <span className="italic text-[#E9B949]">Categories</span>
        </h2>
        <p className="text-stone-300 text-sm sm:text-base mt-2">
          Pegged directly to the wire. Hover to catch the sway, click to jump to the curated archive.
        </p>
      </div>

      <div className="relative pt-6">
        <div className="clothesline-rope absolute top-0 left-0 w-full" />

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 pt-2">
          {CLOTHESLINE_CATEGORIES.map((cat, idx) => (
            <motion.div
              key={cat.id}
              className="clothespin-card cursor-pointer group"
              onClick={() => navigate(`#/products?category=${encodeURIComponent(cat.label)}`)}
              whileHover={{ rotate: idx % 2 === 0 ? 4 : -4, y: 4 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <div className="wooden-peg" />

              <div className="clothespin-card-body group-hover:border-[#E9B949] transition-colors">
                <span className="text-2xl">{cat.icon}</span>
                <div className="font-bold text-xs text-white leading-tight mt-1">{cat.label}</div>
                <span className="font-mono text-[9px] text-[#E4472B] font-bold">{cat.tag}</span>
                <span className="font-mono text-[9px] text-stone-400">{cat.count} items</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

