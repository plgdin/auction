import { useState } from "react";
import LiquidLoading from "@/components/ui/liquid-loader";

export default function DotLoaderDemo() {
  const [variant, setVariant] = useState<"website" | "rainbow">("website");

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center rounded-lg border bg-stone-950 p-6 text-white">
      <div className="mb-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setVariant("website")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-all cursor-pointer ${
            variant === "website"
              ? "bg-[#5d6446] text-white shadow-lg"
              : "border border-white/20 text-white/60 hover:text-white"
          }`}
        >
          Website Palette (Olive & Gold)
        </button>
        <button
          type="button"
          onClick={() => setVariant("rainbow")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-all cursor-pointer ${
            variant === "rainbow"
              ? "bg-purple-600 text-white shadow-lg"
              : "border border-white/20 text-white/60 hover:text-white"
          }`}
        >
          Rainbow Spectrum
        </button>
      </div>

      <LiquidLoading variant={variant} />

      <p className="mt-8 text-xs uppercase tracking-[0.2em] text-white/50">
        lelam.co fluid physics loader
      </p>
    </div>
  );
}
