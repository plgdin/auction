import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  Leaf,
  ShieldCheck,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Hero } from "@/components/ui/animated-hero";
import { ClothingRailHero } from "@/components/ui/product-rail-gallery";
import { Link, navigate } from "../components/Link";
import { useStore } from "../lib/store";

/** Toggles the interactive clothing rail section on the homepage. Kept in code, hidden for now. */
const SHOW_RAIL = false;

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
      className="flex w-48 flex-col items-center text-center group relative z-10 sm:w-56 md:w-60 lg:w-44 xl:w-56 2xl:w-60"
    >
      {/* Polaroid frame */}
      <div
        className={`relative bg-[#FAF7F2] p-2 pb-4 sm:p-2.5 sm:pb-5 shadow-[0_10px_22px_rgba(73,48,34,0.12)] border border-[#E5DACB]/70 rounded-[2px] transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_18px_36px_rgba(73,48,34,0.18)] ${rotate}`}
      >
        <WashiTape className="-top-2.5 left-1/2 -translate-x-1/2" width="w-16 sm:w-20" rotate="-rotate-1" />
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-[#E9DFC8] rounded-[1px] border border-black/5">
          <img
            src={imageSrc}
            alt={imageAlt}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      </div>

      {/* Number badge and text */}
      <div className="mt-5 flex flex-col items-center max-w-[240px]">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#B58B64] text-[#FAF7F2] font-serif font-bold text-base flex items-center justify-center shadow-sm mb-2.5">
          {stepNumber}
        </div>
        <h3
          className="text-xl sm:text-2xl font-medium text-[#493022] tracking-tight mb-1"
          style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
        >
          {title}
        </h3>
        <p className="text-sm sm:text-base text-[#6B5646] leading-relaxed">
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
      className="marketplace-home relative w-full overflow-hidden text-[#302116]"
      style={{
        backgroundColor: "#F3E5D2",
        backgroundImage: 'url("/images/Warm Ivory Handmade Paper Texture.png")',
        backgroundSize: "100% auto",
        backgroundRepeat: "repeat-y",
        backgroundPosition: "top center",
      }}
    >
      {/* 1. TOP HERO SECTION */}
      <Hero />

      {/* 3. PRESERVED INTERACTIVE CLOTHING RAIL GALLERY (hidden for now — flip SHOW_RAIL to restore) */}
      {SHOW_RAIL && (
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
      )}

      {/* 4. "HOW SELLING ON LELAM.CO WORKS" STORYBOARD */}
      <section className="relative w-full py-10 sm:py-12 md:py-16 px-5 sm:px-8 md:px-12 lg:px-16">
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

            {/* Cursive taped note on a torn blush paper banner (Asset 03) */}
            <motion.div
              initial={{ opacity: 0, rotate: 2 }}
              whileInView={{ opacity: 1, rotate: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative self-start md:self-auto w-full max-w-xs min-h-[92px] px-6 py-4 -rotate-1"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none select-none absolute inset-0 -z-10"
              >
                <img
                  src="/images/Vintage Torn Paper Sheet.png"
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-fill drop-shadow-[0_6px_16px_rgba(73,48,34,0.16)]"
                />
              </span>
              <WashiTape className="-top-3 left-1/2 -translate-x-1/2" width="w-20" rotate="rotate-2" />
              <p
                className="relative z-10 text-2xl sm:text-[1.7rem] text-[#493022] leading-tight text-center"
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
              imageSrc="/images/gpt/step-list.png"
              imageAlt="Folded knitwear ready to be photographed"
              rotate="-rotate-1"
              delay={0.1}
            />

            <SketchArrow />

            <StepPolaroidCard
              stepNumber={2}
              title="Get Discovered"
              description="Your item goes live on lelam.co for buyers to find and buy."
              imageSrc="/images/gpt/step-discover.png"
              imageAlt="Laptop displaying closet listings"
              rotate="rotate-1"
              delay={0.2}
            />

            <SketchArrow />

            <StepPolaroidCard
              stepNumber={3}
              title="Sell & Ship"
              description="Accept an order, pack it neatly, and hand it over to our pickup partner."
              imageSrc="/images/gpt/step-ship.png"
              imageAlt="Shipping cardboard box packed with tissue paper"
              rotate="-rotate-1.5"
              delay={0.3}
            />

            <SketchArrow />

            <StepPolaroidCard
              stepNumber={4}
              title="Get Paid"
              description="Receive your earnings safely and directly to your account."
              imageSrc="/images/gpt/step-paid.png"
              imageAlt="Mobile screen showing payment received checkmark"
              rotate="rotate-2"
              delay={0.4}
            />
          </div>
        </div>
      </section>

      {/* 5. EDITORIAL MANIFESTO on one un-cropped torn paper strip */}
      <section className="relative w-full overflow-hidden">
        <img
          src="/images/Torn Cream Paper Strip.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        />

        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 md:px-12 py-14 sm:py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7 }}
            className="relative flex flex-col md:flex-row items-center gap-6 sm:gap-10 md:gap-12"
          >
            {/* Real cardboard hangtag on twine string */}
            <div className="shrink-0 -mt-6 sm:-mt-10 md:-mt-0 md:-ml-14 w-32 sm:w-40 md:w-48 select-none pointer-events-none">
              <img
                src="/images/Kraft Tag with Recycled Symbol and Twine.png"
                alt="Recycled cardboard hangtag"
                className="w-full h-auto object-contain"
              />
            </div>

            {/* Manifesto Quote */}
            <div className="flex-1 text-center md:text-left">
              <blockquote
                className="text-3xl sm:text-4xl md:text-[2.75rem] text-[#493022] leading-tight font-normal"
                style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
              >
                “Good Clothes <br className="hidden sm:block" />
                Deserve{" "}
                <span className="relative isolate inline-block italic font-serif">
                  <span aria-hidden="true" className="paper-marker-highlight pointer-events-none absolute -z-10" />
                  Another Chapter.
                </span>”
              </blockquote>
            </div>

            {/* Vertical divider */}
            <div className="hidden md:block w-px h-24 bg-[#493022]/15" aria-hidden="true" />

            {/* Supporting paragraph */}
            <div className="md:w-[38%] text-base sm:text-lg text-[#6B5646] leading-relaxed text-center md:text-left">
              From clearing out what you no longer wear to earning from it — selling on{" "}
              <span className="font-serif italic text-[#493022] font-semibold">lelam.co</span> is a smarter, more sustainable choice.
            </div>
          </motion.div>
        </div>
      </section>
      {/* 6. "WHY SELL ON LELAM.CO?" BENEFIT GRID & RACK POLAROID */}
      <section className="relative w-full pt-4 pb-0 sm:pt-6 md:pt-8 px-5 sm:px-8 md:px-12 lg:px-16">
        <div className="max-w-7xl mx-auto">
          {/* Section Heading */}
          <div className="mb-8 sm:mb-10">
            <h2
              className="text-3xl sm:text-4xl md:text-5xl text-[#493022] font-normal tracking-tight"
              style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
            >
              Why Sell on <span className="italic font-serif">lelam.co?</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: 2x2 Benefits Grid (approx 60%) */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-6 lg:gap-5 items-start">
              {/* Benefit 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex flex-col items-center text-center lg:border-r border-[#493022]/15 lg:pr-4"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#493022] mb-3">
                  <Coins className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <h3
                  className="text-xl sm:text-2xl font-medium text-[#493022] mb-1.5"
                  style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
                >
                  Turn clutter into cash
                </h3>
                <p className="text-base text-[#6B5646] leading-relaxed">
                  Give unused items a new home and earn while you declutter.
                </p>
              </motion.div>

              {/* Benefit 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col items-center text-center lg:border-r border-[#493022]/15 lg:pr-4"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#493022] mb-3">
                  <Leaf className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <h3
                  className="text-xl sm:text-2xl font-medium text-[#493022] mb-1.5"
                  style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
                >
                  A more sustainable you
                </h3>
                <p className="text-base text-[#6B5646] leading-relaxed">
                  Reduce textile waste and be part of a circular fashion cycle.
                </p>
              </motion.div>

              {/* Benefit 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col items-center text-center lg:border-r border-[#493022]/15 lg:pr-4"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#493022] mb-3">
                  <ShieldCheck className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <h3
                  className="text-xl sm:text-2xl font-medium text-[#493022] mb-1.5"
                  style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
                >
                  Simple & secure
                </h3>
                <p className="text-base text-[#6B5646] leading-relaxed">
                  Verified buyers, safe transactions, and reliable support.
                </p>
              </motion.div>

              {/* Benefit 4 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#493022] mb-3">
                  <Users className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <h3
                  className="text-xl sm:text-2xl font-medium text-[#493022] mb-1.5"
                  style={{ fontFamily: '"Canela", "Ogg", "PPEditorialNew", "DM Serif Display", Georgia, serif' }}
                >
                  A community that values pre-loved
                </h3>
                <p className="text-base text-[#6B5646] leading-relaxed">
                  Connect with mindful shoppers who love quality and unique finds.
                </p>
              </motion.div>
            </div>

            {/* Right Column: Polaroid of Rack with Dried Botanical Flowers (approx 40%) */}
            <div className="lg:col-span-4 relative flex justify-center items-center">
              {/* Delicate dried baby's breath wildflower stem behind */}
              <div className="absolute -top-10 -right-4 sm:-right-6 w-28 sm:w-36 h-44 select-none pointer-events-none opacity-80 z-0">
                <svg className="w-full h-full text-[#6B5038]/75 drop-shadow-sm" viewBox="0 0 130 170" fill="none">
                  <path
                    d="M13 161C45 115 61 73 104 11M40 119c-16-3-24-13-27-29 16 1 27 8 27 29Zm23-42c-17-2-27-12-30-28 17 1 29 9 30 28Zm23-38c-15-4-21-14-21-29 15 3 23 12 21 29Zm-18 64c15-12 29-12 43-5-11 13-26 16-43 5Zm20-39c15-12 28-12 42-5-11 12-25 15-42 5Z"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#E9DFC8] rounded-[1px] border border-black/5">
                  <img
                    src="/images/gpt/wardrobe-rail.png"
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
      <section className="relative flex w-full flex-col items-center overflow-hidden pt-0 pb-5 text-center">
        <div className="relative z-10 max-w-3xl mx-auto px-5">
          {/* Pencil rays around Ready to sell? */}
          <div className="inline-flex items-center gap-3 sm:gap-4 mb-6">
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

          <div>
            <button
              type="button"
              onClick={() => navigate("#/sell")}
              style={{ backgroundColor: "#493022", color: "#F5EBDD" }}
              className="group relative inline-flex items-center gap-3 px-8 py-3.5 sm:px-9 sm:py-4 rounded-[10px] text-base sm:text-lg font-medium shadow-[0_8px_24px_rgba(73,48,34,0.28)] transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <span>Start Selling Now</span>
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </div>
        </div>

      </section>
    </main>
  );
}
