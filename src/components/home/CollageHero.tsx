import { motion } from "framer-motion";
import { Gavel, Tag, ShieldCheck, Truck } from "lucide-react";
import { navigate } from "../Link";

export function CollageHero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-8 py-20 sm:py-28 overflow-hidden bg-[#0c0e09] border-b border-white/10">
      {/* Subtle SVG Grid & Grain */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Ambient Warm Gradient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#E4472B]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#E9B949]/10 blur-3xl pointer-events-none" />

      {/* Floating Collage Item 1: Leather Jacket (Top Left) */}
      <motion.div
        className="collage-item absolute -top-4 left-2 sm:left-12 lg:left-20 w-36 sm:w-48 lg:w-60 z-10 hidden sm:block pointer-events-auto"
        animate={{ y: [0, -12, 0], rotate: [-4, -2, -4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="masking-tape -top-3 left-10" />
        <svg viewBox="0 0 200 200" className="w-full filter drop-shadow-2xl">
          <path
            d="M 50,40 L 80,30 L 100,50 L 120,30 L 150,40 L 175,90 L 150,110 L 140,170 L 60,170 L 50,110 L 25,90 Z"
            fill="#22201d"
            stroke="#E9B949"
            strokeWidth="2.5"
          />
          <path d="M 100,50 L 100,170" stroke="#E9B949" strokeWidth="2" strokeDasharray="3,3" />
          <path d="M 80,30 L 100,50 L 120,30" fill="none" stroke="#E4472B" strokeWidth="2.5" />
          <circle cx="100" cy="110" r="3" fill="#E4472B" />
        </svg>
        <div className="hang-tag top-12 -right-6">
          <span className="font-mono text-[9px] text-[#E4472B] font-bold">LOT 042</span>
          <span className="font-mono text-xs font-black text-[#161412]">₹2,400</span>
          <span className="text-[8px] text-stone-600 font-mono">14m left</span>
        </div>
      </motion.div>

      {/* Floating Collage Item 2: 35mm Camera (Top Right) */}
      <motion.div
        className="collage-item absolute top-8 right-2 sm:right-10 lg:right-24 w-32 sm:w-44 lg:w-52 z-10 hidden sm:block pointer-events-auto"
        animate={{ y: [0, 14, 0], rotate: [5, 8, 5] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div className="masking-tape -top-2 left-8" />
        <svg viewBox="0 0 180 140" className="w-full filter drop-shadow-2xl">
          <rect x="20" y="30" width="140" height="90" rx="8" fill="#1e1e1e" stroke="#F3EBDD" strokeWidth="2.5" />
          <circle cx="90" cy="75" r="32" fill="#2d2b27" stroke="#E9B949" strokeWidth="3" />
          <circle cx="90" cy="75" r="18" fill="#141414" stroke="#E4472B" strokeWidth="2" />
          <circle cx="84" cy="69" r="5" fill="#ffffff" opacity="0.6" />
          <rect x="120" y="16" width="24" height="14" rx="2" fill="#E4472B" />
          <rect x="36" y="20" width="18" height="10" rx="1" fill="#c89b3c" />
        </svg>
        <div className="hang-tag -bottom-4 left-6">
          <span className="font-mono text-[9px] text-[#E4472B] font-bold">LOT 088</span>
          <span className="font-mono text-xs font-black text-[#161412]">₹4,200</span>
          <span className="text-[8px] text-stone-600 font-mono">06m left</span>
        </div>
      </motion.div>

      {/* Floating Collage Item 3: Retro Sneaker (Bottom Left) */}
      <motion.div
        className="collage-item absolute bottom-6 left-4 sm:left-14 lg:left-28 w-36 sm:w-48 lg:w-56 z-10 hidden md:block pointer-events-auto"
        animate={{ y: [0, -10, 0], rotate: [-6, -3, -6] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <div className="masking-tape -top-2 left-12" />
        <svg viewBox="0 0 200 120" className="w-full filter drop-shadow-2xl">
          <path
            d="M 25,85 C 40,85 50,60 85,60 C 120,60 140,25 160,25 C 175,25 185,45 185,85 L 20,85 Z"
            fill="#E4472B"
            stroke="#F3EBDD"
            strokeWidth="2.5"
          />
          <rect x="15" y="85" width="175" height="18" rx="4" fill="#F3EBDD" stroke="#161412" strokeWidth="2" />
          <path d="M 60,60 C 90,60 110,40 145,40" fill="none" stroke="#E9B949" strokeWidth="4" />
          <circle cx="160" cy="45" r="7" fill="#F3EBDD" stroke="#161412" strokeWidth="1.5" />
        </svg>
        <div className="hang-tag -top-4 right-4">
          <span className="font-mono text-[9px] text-[#E4472B] font-bold">LOT 014</span>
          <span className="font-mono text-xs font-black text-[#161412]">₹3,100</span>
          <span className="text-[8px] text-stone-600 font-mono">22m left</span>
        </div>
      </motion.div>

      {/* Floating Collage Item 4: Ceramic Studio Mug (Bottom Right) */}
      <motion.div
        className="collage-item absolute bottom-8 right-6 sm:right-16 lg:right-32 w-28 sm:w-36 lg:w-44 z-10 hidden md:block pointer-events-auto"
        animate={{ y: [0, 12, 0], rotate: [4, 7, 4] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <div className="masking-tape -top-2 left-6" />
        <svg viewBox="0 0 140 140" className="w-full filter drop-shadow-2xl">
          <rect x="30" y="30" width="70" height="85" rx="10" fill="#9DB29A" stroke="#161412" strokeWidth="2.5" />
          <path d="M 100,45 C 125,45 125,85 100,85" fill="none" stroke="#9DB29A" strokeWidth="10" strokeLinecap="round" />
          <path d="M 100,45 C 125,45 125,85 100,85" fill="none" stroke="#161412" strokeWidth="2.5" />
          <circle cx="50" cy="55" r="4" fill="#E4472B" />
          <circle cx="75" cy="70" r="5" fill="#E9B949" />
          <circle cx="60" cy="90" r="3" fill="#161412" />
        </svg>
        <div className="hang-tag -bottom-4 right-2">
          <span className="font-mono text-[9px] text-[#E4472B] font-bold">LOT 103</span>
          <span className="font-mono text-xs font-black text-[#161412]">₹650</span>
          <span className="text-[8px] text-stone-600 font-mono">18m left</span>
        </div>
      </motion.div>

      {/* Center Copy */}
      <div className="relative z-20 max-w-4xl mx-auto text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="stamp-badge mb-6"
        >
          ★ PEER-TO-PEER THRIFT AUCTION HOUSE · TRIVANDRUM ★
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-normal tracking-tight text-[#F3EBDD] font-serif leading-[1.04]"
        >
          Everything deserves a <span className="italic text-[#E4472B] font-serif">second life.</span>{" "}
          <span className="block mt-2 sm:mt-3 underline decoration-[#E9B949] decoration-wavy decoration-2">
            Bid on it.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-stone-300 text-base sm:text-xl max-w-2xl mx-auto mt-6 leading-relaxed font-sans"
        >
          The browsing ease of modern thrifting meets the soul of a vintage zine and a live flea-market auction.
          Rare garments, verified curios, and transparent countdowns.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mt-8 sm:mt-10"
        >
          <button
            type="button"
            onClick={() => {
              document.getElementById("live-auctions")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="btn-stamp inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-base font-bold uppercase tracking-wider"
          >
            <Gavel size={18} />
            <span>Start Bidding</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("#/sell")}
            className="btn-tape-outline inline-flex items-center justify-center gap-2.5 px-7 py-3 text-base font-bold uppercase tracking-wider text-[#F3EBDD]"
          >
            <Tag size={17} className="text-[#E9B949]" />
            <span>Sell Your Closet</span>
          </button>
        </motion.div>

        <div className="flex items-center gap-6 mt-10 text-xs font-mono text-stone-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E4472B] animate-pulse" /> 18 Live Lots Now
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#E9B949]" /> Anti-Snipe Protected
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <Truck size={14} className="text-[#9DB29A]" /> Kerala 24-48h Delivery
          </span>
        </div>
      </div>
    </section>
  );
}

