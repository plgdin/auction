"use client";

import NumberFlow, { type Value } from "@number-flow/react";

export type NumberTickerProps = {
  value: Value;
  currency?: string;
  decimals?: number;
  className?: string;
};

/**
 * NumberTicker 02 - Money Flow
 * Premium currency display with smooth high-fidelity rolls.
 */
export default function NumberTicker({
  value,
  currency,
  decimals = 0,
  className,
}: NumberTickerProps) {
  const format = currency
    ? {
        style: "currency" as const,
        currency: currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }
    : {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      };

  return (
    <div className="inline-flex items-center gap-1">
      <NumberFlow
        value={value}
        format={format}
        className={className}
      />
    </div>
  );
}

export { NumberTicker };

