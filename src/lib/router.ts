import { useEffect, useState } from "react";

export interface Route {
  path: string;
  query: URLSearchParams;
  anchor: string;
  raw: string;
}

export function parseRoute(hash: string): Route {
  const raw = hash || "";
  if (!raw || raw === "#") return { path: "/", query: new URLSearchParams(), anchor: "", raw };
  if (!raw.startsWith("#/")) {
    return { path: "/", query: new URLSearchParams(), anchor: raw.replace("#", ""), raw };
  }
  const withoutHash = raw.slice(1);
  const [pathname, search = ""] = withoutHash.split("?");
  return {
    path: pathname || "/",
    query: new URLSearchParams(search),
    anchor: "",
    raw,
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function useHashValue(key: string): string {
  const route = useRoute();
  return route.query.get(key) ?? "";
}
