import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  IndianRupee,
  Leaf,
  Recycle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Hero } from "@/components/ui/animated-hero";
import { ClothingRailHero } from "@/components/ui/product-rail-gallery";
import { Link, navigate } from "../components/Link";
import { useStore } from "../lib/store";

/** Translucent beige masking tape strip with torn edges and dashed fiber cuts */
function WashiTape({
  className = "",
  width = "w-20",
  rotate = "-rotate-1",
}: {
  className?: string;
  width?: string;
  rotate?: string;
}) {
  return (
    <div
      className={`absolute z-20 h-5 ${width} ${rotate} pointer-events-none select-none ${className}`}
      style={{
        backgroundColor: "rgba(238, 226, 198, 0.9)",
        backdropFilter: "blur(2px)",
        boxShadow: "0 1.5px 4px rgba(73, 48, 34, 0.14)",
        clipPath: "polygon(0% 3px, 2% 0%, 98% 2%, 100% 5%, 98% 100%, 96% 96%, 3% 98%, 0% 93%)",
        borderLeft: "1px dashed rgba(160, 135, 95, 0.45)",
        borderRight: "1px dashed rgba(160, 135, 95, 0.45)",
      }}
      aria-hidden="true"
    />
  );
}

/** Step polaroid photo card in the How Selling Works sequence */
function StepPolaroidCard({
  stepNumber,
  title,
  description,
  imageSrc,
  imageAlt,
  rotate = "rotate-0",
  delay = 0,
}: {
  stepNumber: number;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  rotate?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center text-center group relative z-10"
    >
      {/* Polaroid frame */}
      <div
        className={`relative bg-[#FAF7F2] p-2.5 pb-5 sm:p-3 sm:pb-6 shadow-[0_12px_28px_rgba(73,48,34,0.12),0_2px_6px_rgba(0,0,0,0.06)] border border-[#E5DACB]/90 rounded-[2px] transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_18px_36px_rgba(73,48,34,0.18)] ${rotate}`}
      >
        <WashiTape className="-top-2.5 left-1/2 -translate-x-1/2" width="w-16 sm:w-20" rotate="-rotate-1" />
        <div className="relative aspect-square w-44 sm:w-48 md:w-52 overflow-hidden bg-[#E9DFC8] rounded-[1px] border border-black/5">
          <img
            src={imageSrc}
            alt={imageAlt}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      </div>

      {/* Number badge and text */}
      <div className="mt-5 flex flex-col items-center max-w-[210px]">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#B58B64] text-[#FAF7F2] font-serif font-bold text-sm flex items-center justify-center shadow-sm mb-2.5">
          {stepNumber}
        </div>
        <h3
          className="text-lg sm:text-xl font-medium text-[#493022] tracking-tight mb-1"
          style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
        >
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-[#6B5646] leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

/** Connecting hand-drawn sketch arrow between steps */
function SketchArrow() {
  return (
    <div className="hidden lg:flex items-center justify-center -mx-2 mb-28 select-none pointer-events-none opacity-60 text-[#493022]">
      <svg width="42" height="24" viewBox="0 0 42 24" fill="none">
        <path
          d="M2 12 Q 20 22, 38 10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />
        <path
          d="M32 6 L 39 10 L 33 16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function HomePage() {
  const { db } = useStore();
  const active = db.products.filter((product) => product.status === "active");
  const railItems = active.slice(0, 8).map((product) => ({
    id: product.id,
    name: product.title,
    description: product.description,
    image: product.images[0],
    tag: product.size,
    details: [product.condition, product.category, product.sellerName],
  }));

  return (
    <main
      id="top"
      className="marketplace-home relative w-full overflow-hidden text-[#493022]"
      style={{
        backgroundColor: "#F5EBDD",
        backgroundImage: `
          radial-gradient(#D6C5B0 0.85px, transparent 0.85px),
          radial-gradient(#D6C5B0 0.85px, #F5EBDD 0.85px)
        `,
        backgroundSize: "32px 32px",
        backgroundPosition: "0 0, 16px 16px",
      }}
    >
      {/* 1. TOP HERO SECTION */}
      <Hero />

      {/* 2. TORN PAPER VALUE RIBBON */}
      <section className="relative w-full z-20 py-4 sm:py-5 overflow-hidden">
        {/* Torn top edge overlay */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
          <div
            className="relative w-full py-4 sm:py-5 px-6 sm:px-10 rounded-sm bg-[#EBDDC9]/90 border-y border-[#D6C5B0] shadow-[0_4px_16px_rgba(73,48,34,0.06)]"
            style={{
              clipPath: "polygon(0% 4px, 2% 0px, 98% 3px, 100% 0px, 100% calc(100% - 4px), 98% 100%, 2% calc(100% - 3px), 0% 100%)",
            }}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-center">
              {/* Point 1 */}
              <div className="flex items-center gap-3 sm:gap-4 lg:border-r border-[#493022]/15 lg:pr-4">
                <Leaf className="w-5 h-5 text-[#493022] shrink-0" strokeWidth={1.8} />
                <span className="text-xs sm:text-sm font-medium text-[#493022]">
                  Declutter your space
                </span>
              </div>

              {/* Point 2 */}
              <div className="flex items-center gap-3 sm:gap-4 lg:border-r border-[#493022]/15 lg:pr-4">
                <IndianRupee className="w-5 h-5 text-[#493022] shrink-0" strokeWidth={1.8} />
                <span className="text-xs sm:text-sm font-medium text-[#493022]">
                  Earn extra cash
                </span>
              </div>

              {/* Point 3 */}
              <div className="flex items-center gap-3 sm:gap-4 lg:border-r border-[#493022]/15 lg:pr-4">
                <Recycle className="w-5 h-5 text-[#493022] shrink-0" strokeWidth={1.8} />
                <span className="text-xs sm:text-sm font-medium text-[#493022]">
                  Give items a longer life
                </span>
              </div>

              {/* Point 4 */}
              <div className="flex items-center gap-3 sm:gap-4">
                <Sparkles className="w-5 h-5 text-[#493022] shrink-0" strokeWidth={1.8} />
                <span className="text-xs sm:text-sm font-medium text-[#493022]">
                  Support sustainable fashion
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRESERVED INTERACTIVE CLOTHING RAIL GALLERY */}
      <motion.section
        className="rail-section my-6 sm:my-10"
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
            caption="Slide the hangers, brush across to swing, or click any piece to lift and inspect front and back."
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

      {/* 4. "HOW SELLING ON LELAM.CO WORKS" STORYBOARD */}
      <section className="relative w-full py-12 sm:py-16 md:py-20 px-5 sm:px-8 md:px-12 lg:px-16">
        <div className="max-w-7xl mx-auto">
          {/* Header row with cursive taped note */}
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 sm:mb-16">
            <div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl text-[#493022] font-normal tracking-tight"
                style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
              >
                <span>How Selling</span>
                <br />
                <span>on </span>
                <span className="italic font-serif">lelam.co</span>
                <span> Works</span>
              </h2>
              {/* Hand-drawn pencil squiggle underline */}
              <svg
                width="120"
                height="12"
                viewBox="0 0 120 12"
                fill="none"
                className="text-[#493022]/70 mt-1 ml-1"
                aria-hidden="true"
              >
                <path
                  d="M2 8 C 30 2, 70 3, 118 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Cursive taped note: "It's simple, quick, and hassle-free." */}
            <motion.div
              initial={{ opacity: 0, rotate: 2 }}
              whileInView={{ opacity: 1, rotate: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative self-start md:self-auto bg-[#FAF7F2] px-6 py-4 rounded-sm shadow-[0_6px_20px_rgba(73,48,34,0.12)] border border-[#E5DACB] -rotate-1 max-w-xs"
            >
              <WashiTape className="-top-3 left-1/2 -translate-x-1/2" width="w-20" rotate="rotate-2" />
              <p
                className="text-2xl sm:text-[1.7rem] text-[#493022] leading-tight text-center"
                style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
              >
                It’s simple, quick, and hassle-free.
              </p>
            </motion.div>
          </div>

          {/* 4 Step Polaroid Cards with Arrows */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-2">
            <StepPolaroidCard
              stepNumber={1}
              title="List Your Item"
              description="Add photos, a short description, and your price in just a few clicks."
              imageSrc="/images/step_1.png"
              imageAlt="Folded knitwear ready to be photographed"
              rotate="-rotate-1"
              delay={0.1}
            />

            <SketchArrow />

            <StepPolaroidCard
              stepNumber={2}
              title="Get Discovered"
              description="Your item goes live on lelam.co for buyers to find and buy."
              imageSrc="/images/step_2.png"
              imageAlt="Laptop displaying closet listings"
              rotate="rotate-1"
              delay={0.2}
            />

            <SketchArrow />

            <StepPolaroidCard
              stepNumber={3}
              title="Sell & Ship"
              description="Accept an order, pack it neatly, and hand it over to our pickup partner."
              imageSrc="/images/step_3.png"
              imageAlt="Shipping cardboard box packed with tissue paper"
              rotate="-rotate-1.5"
              delay={0.3}
            />

            <SketchArrow />

            <StepPolaroidCard
              stepNumber={4}
              title="Get Paid"
              description="Receive your earnings safely and directly to your account."
              imageSrc="/images/step_4.png"
              imageAlt="Mobile screen showing payment received checkmark"
              rotate="rotate-2"
              delay={0.4}
            />
          </div>
        </div>
      </section>

      {/* 5. EDITORIAL MANIFESTO STRIP */}
      <section className="relative w-full py-8 sm:py-12 px-5 sm:px-8 md:px-12 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7 }}
            className="relative bg-[#FAF7F2] border border-[#E5DACB] rounded-sm p-6 sm:p-10 md:p-12 shadow-[0_16px_36px_rgba(73,48,34,0.1)] flex flex-col md:flex-row items-center gap-6 sm:gap-10 md:gap-12"
          >
            {/* Real cardboard hangtag on twine string */}
            <div className="shrink-0 -mt-6 sm:-mt-10 md:-mt-0 md:-ml-14 w-24 sm:w-28 md:w-32 filter drop-shadow-[0_8px_16px_rgba(73,48,34,0.18)] select-none pointer-events-none rotate-[-6deg] hover:rotate-[-2deg] transition-transform duration-300">
              <img
                src="/images/hangtag.png"
                alt="Recycled cardboard hangtag"
                className="w-full h-auto object-contain"
              />
            </div>

            {/* Manifesto Quote */}
            <div className="flex-1 text-center md:text-left">
              <blockquote
                className="text-2xl sm:text-3xl md:text-4xl text-[#493022] leading-tight font-normal"
                style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
              >
                “Good Clothes <br className="hidden sm:block" />
                Deserve{" "}
                <span className="relative inline-block italic font-serif">
                  <span
                    className="absolute inset-x-[-6px] inset-y-[2px] -rotate-1 rounded-[2px] -z-10"
                    style={{
                      backgroundColor: "rgba(201, 143, 125, 0.42)",
                      boxShadow: "0 0 10px rgba(201, 143, 125, 0.22)",
                    }}
                    aria-hidden="true"
                  />
                  Another Chapter.
                </span>”
              </blockquote>
            </div>

            {/* Vertical divider */}
            <div className="hidden md:block w-px h-24 bg-[#493022]/15" aria-hidden="true" />

            {/* Supporting paragraph */}
            <div className="md:w-[38%] text-sm sm:text-base text-[#6B5646] leading-relaxed text-center md:text-left">
              From clearing out what you no longer wear to earning from it — selling on{" "}
              <span className="font-serif italic text-[#493022] font-semibold">lelam.co</span> is a smarter, more sustainable choice.
            </div>
          </motion.div>
        </div>
      </section>

      {/* 6. "WHY SELL ON LELAM.CO?" BENEFIT GRID & RACK POLAROID */}
      <section className="relative w-full py-12 sm:py-16 md:py-20 px-5 sm:px-8 md:px-12 lg:px-16">
        <div className="max-w-7xl mx-auto">
          {/* Section Heading */}
          <div className="mb-10 sm:mb-14">
            <h2
              className="text-3xl sm:text-4xl md:text-5xl text-[#493022] font-normal tracking-tight"
              style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
            >
              Why Sell on <span className="italic font-serif">lelam.co?</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: 2x2 Benefits Grid (approx 60%) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10">
              {/* Benefit 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex flex-col items-start"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#493022] mb-3">
                  <Coins className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <h3
                  className="text-lg sm:text-xl font-medium text-[#493022] mb-1.5"
                  style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
                >
                  Turn clutter into cash
                </h3>
                <p className="text-sm text-[#6B5646] leading-relaxed">
                  Give unused items a new home and earn while you declutter.
                </p>
              </motion.div>

              {/* Benefit 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col items-start"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#493022] mb-3">
                  <Leaf className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <h3
                  className="text-lg sm:text-xl font-medium text-[#493022] mb-1.5"
                  style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
                >
                  A more sustainable you
                </h3>
                <p className="text-sm text-[#6B5646] leading-relaxed">
                  Reduce textile waste and be part of a circular fashion cycle.
                </p>
              </motion.div>

              {/* Benefit 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col items-start"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#493022] mb-3">
                  <ShieldCheck className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <h3
                  className="text-lg sm:text-xl font-medium text-[#493022] mb-1.5"
                  style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
                >
                  Simple & secure
                </h3>
                <p className="text-sm text-[#6B5646] leading-relaxed">
                  Verified buyers, safe transactions, and reliable support.
                </p>
              </motion.div>

              {/* Benefit 4 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-col items-start"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#493022] mb-3">
                  <Users className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <h3
                  className="text-lg sm:text-xl font-medium text-[#493022] mb-1.5"
                  style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
                >
                  A community that values pre-loved
                </h3>
                <p className="text-sm text-[#6B5646] leading-relaxed">
                  Connect with mindful shoppers who love quality and unique finds.
                </p>
              </motion.div>
            </div>

            {/* Right Column: Polaroid of Rack with Dried Botanical Flowers (approx 40%) */}
            <div className="lg:col-span-5 relative flex justify-center items-center">
              {/* Delicate dried baby's breath wildflower stem behind */}
              <div className="absolute -top-10 -right-6 sm:-right-8 w-32 sm:w-40 h-48 select-none pointer-events-none opacity-85 z-0">
                <img
                  src="/images/flower_cutout.png"
                  alt=""
                  className="w-full h-full object-contain filter drop-shadow-[2px_4px_8px_rgba(73,48,34,0.16)]"
                />
              </div>

              {/* Polaroid Frame of Clothing Rack */}
              <motion.div
                initial={{ opacity: 0, rotate: 4, scale: 0.95 }}
                whileInView={{ opacity: 1, rotate: 2, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                whileHover={{ rotate: 0, scale: 1.02 }}
                className="relative z-10 bg-[#FAF7F2] p-3 pb-8 sm:p-4 sm:pb-10 shadow-[0_20px_42px_rgba(73,48,34,0.18)] border border-[#E5DACB]/90 rounded-[2px] max-w-sm sm:max-w-md w-full"
              >
                <WashiTape className="-top-3 left-1/2 -translate-x-1/2" width="w-24 sm:w-28" rotate="-rotate-1" />
                <div className="relative aspect-[4/4.25] w-full overflow-hidden bg-[#E9DFC8] rounded-[1px] border border-black/5">
                  <img
                    src="/images/rack_polaroid.png"
                    alt="Wooden clothing rack full of pre-loved coats"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. BOTTOM CTA: "READY TO SELL?" */}
      <section className="relative w-full pt-12 sm:pt-16 pb-0 overflow-hidden flex flex-col items-center text-center">
        <div className="max-w-3xl mx-auto px-5 z-10">
          {/* Pencil rays around Ready to sell? */}
          <div className="inline-flex items-center gap-3 sm:gap-4 mb-4">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-[#493022]/70 -rotate-12">
              <path d="M4 22L12 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M15 24L22 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <h2
              className="text-4xl sm:text-5xl md:text-6xl text-[#493022] font-serif italic font-normal"
              style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
            >
              Ready to sell?
            </h2>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-[#493022]/70 rotate-12">
              <path d="M12 6L4 22" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M22 11L15 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate("#/sell")}
              className="group relative inline-flex items-center gap-3 px-8 py-3.5 sm:px-9 sm:py-4 rounded-[10px] text-base sm:text-lg font-medium text-[#F5EBDD] bg-[#493022] hover:bg-[#382317] shadow-[0_8px_24px_rgba(73,48,34,0.28)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <span>Start Selling Now</span>
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Bottom outer torn kraft-paper edge framing the section */}
        <div className="w-full mt-10 sm:mt-14 select-none pointer-events-none">
          <img
            src="/images/scrapbook_torn_bottom.png"
            alt=""
            className="w-full h-16 sm:h-24 md:h-28 lg:h-32 object-cover object-bottom drop-shadow-[0_-4px_12px_rgba(73,48,34,0.16)]"
          />
        </div>
      </section>
    </main>
  );
}
