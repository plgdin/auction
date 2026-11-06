"use client";

import { LiquidText } from "./liquid-text";

export default function LiquidTextDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f7f5ec] px-8">
      <LiquidText
        text="lelam.co"
        ariaLabel="lelam.co"
        color="#302e28"
        accentColor="#626d44"
        tone="light"
        fontSize={240}
        fontWeight={800}
        fontFamily="Gumela Arabic, DM Sans, sans-serif"
        className="w-full max-w-5xl"
      />
    </div>
  );
}
