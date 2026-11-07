import { Marquee } from "@/components/ui/marquee";

export function MarqueeDemo() {
  return (
    <div className="flex items-center justify-center min-h-[120px] w-full py-6 bg-stone-950 text-white">
      <Marquee pauseOnHover duration={25}>
        <span className="mx-8 text-sm font-semibold tracking-[0.2em] uppercase text-stone-400">
          Vintage Leather
        </span>
        <span className="mx-8 text-sm font-semibold tracking-[0.2em] uppercase text-[#c89b3c]">
          Trivandrum 695xxx
        </span>
        <span className="mx-8 text-sm font-semibold tracking-[0.2em] uppercase text-stone-400">
          Japanese Selvedge
        </span>
        <span className="mx-8 text-sm font-semibold tracking-[0.2em] uppercase text-[#788656]">
          Hand Inspected Quality
        </span>
        <span className="mx-8 text-sm font-semibold tracking-[0.2em] uppercase text-stone-400">
          Live Bidding Arena
        </span>
        <span className="mx-8 text-sm font-semibold tracking-[0.2em] uppercase text-[#c89b3c]">
          Private Offers
        </span>
      </Marquee>
    </div>
  );
}

export default MarqueeDemo;

