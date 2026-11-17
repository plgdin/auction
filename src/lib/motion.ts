/**
 * Motion tuning for touch devices.
 *
 * Phones pay for every reveal animation with main-thread + paint budget, and long
 * choreographed entrances read as "laggy" while scrolling. These helpers keep the
 * same motion language but shorten it and strip the stagger on coarse pointers.
 * `prefers-reduced-motion` is handled separately by framer-motion / CSS.
 */

const coarseQuery = "(pointer: coarse)";

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(coarseQuery).matches;
}

/** Value evaluated once per module load — viewport input type doesn't change mid-session. */
export const COARSE = isCoarsePointer();
export const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Shortened duration on touch devices, unchanged on desktop. */
export function revealDuration(base: number): number {
  if (REDUCED_MOTION) return 0;
  return COARSE ? Math.min(base, 0.4) : base;
}

/** Reveal stagger collapses to a single short beat on touch devices. */
export function revealDelay(base: number): number {
  if (REDUCED_MOTION) return 0;
  return COARSE ? Math.min(base, 0.05) : base;
}

/** Smaller travel distance on touch devices (less paint area per frame). */
export function revealLift(base: number): number {
  if (REDUCED_MOTION) return 0;
  return COARSE ? Math.min(base, 16) : base;
}
