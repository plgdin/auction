import { useEffect } from "react";

const SITE_URL = "https://lelam.co";
const DEFAULT_TITLE = "Lelam — Pre-Loved Fashion & Surprise Auctions";
const DEFAULT_DESCRIPTION =
  "Shop one-of-a-kind pre-loved fashion on Lelam. Discover curated finds, make private offers, or bid in surprise auctions for a chance at a better price.";
const DEFAULT_IMAGE = `${SITE_URL}/images/gpt/hero-jacket.jpg`;

export interface SeoOptions {
  title: string;
  description: string;
  /** Path only, e.g. "/product/p-1". Resolved against SITE_URL. */
  path: string;
  image?: string;
  imageAlt?: string;
  type?: string;
  /** Optional JSON-LD object, e.g. a schema.org Product. */
  jsonLd?: Record<string, unknown>;
  /** Keep unknown pages out of search indexes. */
  noIndex?: boolean;
}

function setContent(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", url);
}

function setJsonLd(data?: Record<string, unknown>) {
  const id = "lelam-seo-jsonld";
  document.getElementById(id)?.remove();
  if (!data) return;
  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/** Applies route-specific head metadata. Restores homepage defaults on cleanup. */
export function applySeo(options: SeoOptions | null) {
  const title = options?.title ?? DEFAULT_TITLE;
  const description = options?.description ?? DEFAULT_DESCRIPTION;
  const path = options?.path ?? "/";
  const url = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const rawImage = options?.image ?? DEFAULT_IMAGE;
  const image = /^https?:\/\//.test(rawImage)
    ? rawImage
    : `${SITE_URL}${rawImage.startsWith("/") ? rawImage : `/${rawImage}`}`;
  const imageAlt = options?.imageAlt ?? "Pre-loved jacket featured on lelam.co";
  const type = options?.type ?? "website";

  document.title = title;
  setCanonical(url);
  setContent("name", "robots", options?.noIndex ? "noindex, follow" : "index, follow");
  setContent("name", "description", description);
  setContent("property", "og:type", type);
  setContent("property", "og:url", url);
  setContent("property", "og:title", title);
  setContent("property", "og:description", description);
  setContent("property", "og:image", image);
  setContent("property", "og:image:alt", imageAlt);
  setContent("name", "twitter:card", "summary_large_image");
  setContent("name", "twitter:title", title);
  setContent("name", "twitter:description", description);
  setContent("name", "twitter:image", image);
  setJsonLd(options?.jsonLd);
}

export function useSeo(options: SeoOptions | null) {
  const key = options
    ? [
        options.path,
        options.title,
        options.description,
        options.image ?? "",
        options.imageAlt ?? "",
        options.type ?? "",
        options.noIndex ?? false,
        options.jsonLd ? JSON.stringify(options.jsonLd) : "",
      ].join("|")
    : "";
  useEffect(() => {
    if (!options) return;
    const appliedUrl = `${SITE_URL}${options.path.startsWith("/") ? options.path : `/${options.path}`}`;
    applySeo(options);
    return () => {
      // Lazy-loaded pages keep the previous page mounted briefly. Only restore
      // defaults if no newer route has replaced this page's metadata.
      const current = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (current?.getAttribute("href") === appliedUrl) applySeo(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
