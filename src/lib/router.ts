import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export interface Route {
  path: string;
  query: URLSearchParams;
  anchor: string;
  raw: string;
}

/**
 * Backwards-compatible view of the current location.
 * React Router owns the history; this adapter keeps the `useRoute()` contract
 * used across the app (path / query / anchor / raw) unchanged.
 */
export function useRoute(): Route {
  const location = useLocation();
  return useMemo(
    () => ({
      path: location.pathname,
      query: new URLSearchParams(location.search),
      anchor: location.hash.replace(/^#/, ""),
      raw: `${location.pathname}${location.search}${location.hash}`,
    }),
    [location.pathname, location.search, location.hash],
  );
}

export function useHashValue(key: string): string {
  const route = useRoute();
  return route.query.get(key) ?? "";
}

/** Current clean path including query, for auth redirects and analytics. */
export function currentPath(): string {
  return `${window.location.pathname}${window.location.search}` || "/";
}
