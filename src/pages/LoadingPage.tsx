import { useState } from "react";
import LiquidLoading from "@/components/ui/liquid-loader";
import { ArrowLeft, Moon, Palette, Sun } from "lucide-react";
import { navigate } from "@/src/components/Link";

export function LoadingPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [liquidVariant, setLiquidVariant] = useState<"website" | "rainbow">("website");

  const isDark = theme === "dark";
  const bg = isDark ? "#0c0e09" : "#f4f2ec";

  return (
    <div
      className="fixed inset-0 z-[99999] w-screen h-screen overflow-hidden select-none flex flex-col items-center justify-between p-6 sm:p-10 transition-colors duration-500"
      style={{ backgroundColor: bg }}
    >
      {/* Floating control bar */}
      <div className="w-full flex items-center justify-between z-20">
        <button
          type="button"
          onClick={() => navigate("#/")}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-wider py-2 px-3.5 rounded-full border transition-all cursor-pointer shadow-sm backdrop-blur-md"
          style={{
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "#18181b",
            borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)",
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.8)",
          }}
        >
          <ArrowLeft size={13} />
          <span>Marketplace</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Liquid Loader Color Toggle */}
          <button
            type="button"
            onClick={() => setLiquidVariant((v) => (v === "website" ? "rainbow" : "website"))}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider py-2 px-3.5 rounded-full border transition-all cursor-pointer backdrop-blur-md"
            style={{
              color: isDark ? "rgba(255, 255, 255, 0.85)" : "#18181b",
              borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.12)",
              backgroundColor: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.8)",
            }}
          >
            <Palette size={13} />
            <span>Palette: {liquidVariant === "website" ? "Website Olive/Gold" : "Rainbow"}</span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="p-2 rounded-full border transition-all cursor-pointer backdrop-blur-md"
            aria-label="Toggle solid background theme"
            style={{
              color: isDark ? "rgba(255, 255, 255, 0.7)" : "#18181b",
              borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)",
              backgroundColor: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.8)",
            }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Main Centerpiece Loader */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <LiquidLoading variant={liquidVariant} size="lg" />
      </div>

      {/* Subtle bottom note */}
      <div className="w-full flex items-center justify-center pb-2 z-20">
        <p
          className="text-[11px] uppercase tracking-[0.28em] font-medium transition-colors"
          style={{ color: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)" }}
        >
          Liquid Wave Physics Loader
        </p>
      </div>
    </div>
  );
}

export default LoadingPage;
