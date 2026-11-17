import { startTransition, useEffect, useState } from "react";

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

function readCurrentRoute(): Route {
  const routeSource =
    window.location.hash ||
    (window.location.pathname !== "/"
      ? `#${window.location.pathname}${window.location.search}`
      : "");
  return parseRoute(routeSource);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readCurrentRoute);
  useEffect(() => {
    const onChange = () => {
      startTransition(() => {
        setRoute(readCurrentRoute());
      });
    };
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);
  return route;
}

export function useHashValue(key: string): string {
  const route = useRoute();
  return route.query.get(key) ?? "";
}
