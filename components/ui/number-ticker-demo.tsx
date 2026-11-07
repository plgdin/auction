"use client";

import * as React from "react";
import NumberTicker from "@/components/ui/number-ticker-02";

export default function NumberTickerDemo() {
  const [val, setVal] = React.useState(1284.5);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setVal((prev) => prev + (Math.random() * 50 - 20));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 flex items-center justify-center">
      <NumberTicker
        value={val}
        currency="INR"
        decimals={0}
        className="text-foreground font-medium lg:text-5xl sm:text-4xl text-3xl tracking-tight"
      />
    </div>
  );
}

