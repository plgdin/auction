"use client";

import { useSyncExternalStore } from "react";
import type { BjorkTone } from "./liquid-text-core-palette";

const subscribeNoop = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

export function useBjorkTone(tone?: BjorkTone): BjorkTone {
  const mounted = useSyncExternalStore(subscribeNoop, getMounted, getServerMounted);
  if (tone) return tone;
  if (!mounted) return "light";
  return "light";
}
