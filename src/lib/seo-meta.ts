/**
 * Pure metadata builders shared by the browser (src/lib/seo.ts) and the
 * Vercel SEO functions (api/lib/meta.ts). No DOM or Node dependencies.
 */

export const SITE_URL = "https://lelam.co";

export const DEFAULT_TITLE = "Lelam — Pre-Loved Fashion & Surprise Auctions";
export const DEFAULT_DESCRIPTION =
  "Shop one-of-a-kind pre-loved fashion on Lelam. Discover curated finds, make private offers, or bid in surprise auctions for a chance at a better price.";
export const DEFAULT_IMAGE = `${SITE_URL}/images/gpt/hero-jacket.jpg`;
export const DEFAULT_IMAGE_ALT = "Pre-loved jacket featured on lelam.co";

export interface SeoMeta {
  title: string;
  description: string;
  /** Path only, e.g. "/product/p-1". Resolved against SITE_URL. */
  path: string;
  image?: string;
  imageAlt?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
  noIndex?: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function absoluteUrl(pathOrUrl?: string | null, fallback = DEFAULT_IMAGE): string {
  const raw = typeof pathOrUrl === "string" && pathOrUrl.trim() ? pathOrUrl.trim() : fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SITE_URL}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export function pageUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function homepageMeta(): SeoMeta {
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
    image: DEFAULT_IMAGE,
    imageAlt: DEFAULT_IMAGE_ALT,
    type: "website",
  };
}

export function notFoundMeta(path: string): SeoMeta {
  return {
    title: "Page not found | Lelam",
    description: "This page is off the rail. It may have moved, or the piece may have sold.",
    path,
    noIndex: true,
  };
}

export function productsMeta(category?: string | null): SeoMeta {
  const value = category?.trim();
  if (value) {
    return {
      title: `${value} · Pre-Loved Fashion | Lelam`,
      description: `Browse pre-loved ${value.toLowerCase()} on Lelam. Curated second-hand finds with private offers and surprise auctions across India.`,
      path: `/products?category=${encodeURIComponent(value)}`,
    };
  }
  return {
    title: "Shop Pre-Loved Fashion & Thrift | Lelam",
    description:
      "Browse every pre-loved find on Lelam — curated thrift fashion, private offers, and surprise auctions across India.",
    path: "/products",
  };
}

export function auctionsMeta(): SeoMeta {
  return {
    title: "Live & Upcoming Surprise Auctions | Lelam",
    description:
      "Bid on curated pre-loved fashion in Lelam surprise auctions. Anonymous bids, anti-sniping protection and a chance at a better price.",
    path: "/auctions",
  };
}

export function formatRupees(paise: number): string {
  return Math.round(paise / 100).toLocaleString("en-IN");
}

export function formatMoney(paise: number): string {
  const rupees = paise / 100;
  const hasFraction = Math.abs(paise % 100) > 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(rupees);
}

/** Minimal view of a public product needed for metadata. */
export interface SeoProduct {
  id: string;
  title: string;
  description?: string | null;
  condition?: string | null;
  size?: string | null;
  brand?: string | null;
  sellerName?: string | null;
  askingPrice: number;
  images?: string[] | null;
  status?: string | null;
}

export function productMeta(product: SeoProduct): SeoMeta {
  const path = `/product/${product.id}`;
  const image = absoluteUrl(product.images?.[0]);
  const description = `${product.title} — ${product.condition ?? "Good"} condition, size ${product.size ?? "one size"}, by ${product.sellerName ?? "Seller"}. ${product.description ?? ""}`
    .replace(/\s+/g, " ")
    .slice(0, 158);

  return {
    title: `${product.title} · ₹${formatRupees(product.askingPrice)} | Lelam`,
    description,
    path,
    image,
    imageAlt: product.title,
    type: "product",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description,
      image: (product.images?.length ? product.images : [DEFAULT_IMAGE]).map((src) => absoluteUrl(src)),
      brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
      itemCondition: "https://schema.org/UsedCondition",
      offers: {
        "@type": "Offer",
        price: (product.askingPrice / 100).toFixed(2),
        priceCurrency: "INR",
        availability:
          product.status === "active"
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        url: pageUrl(path),
      },
    },
  };
}

/** Minimal view of a public auction + its product needed for metadata. */
export interface SeoAuction {
  id: string;
  productId: string;
  status: string;
  startingPrice: number;
  currentBid?: number | null;
}

export function auctionMeta(auction: SeoAuction, product: SeoProduct): SeoMeta {
  const bid = auction.currentBid ?? auction.startingPrice;
  const label =
    auction.status === "live"
      ? "Live Auction"
      : auction.status === "scheduled"
        ? "Upcoming Auction"
        : "Auction";

  return {
    title: `${product.title} · ${label} | Lelam`,
    description: `Bid on ${product.title} (${product.condition ?? "Good"}, size ${product.size ?? "one size"}) in a Lelam surprise auction. Anonymous bids, anti-sniping protection, ${formatMoney(bid)} current bid.`,
    path: `/auction/${auction.id}`,
    image: absoluteUrl(product.images?.[0]),
    imageAlt: product.title,
    type: "product",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: `Surprise auction on Lelam. Current bid ${formatMoney(bid)}.`,
      image: (product.images?.length ? product.images : [DEFAULT_IMAGE]).map((src) => absoluteUrl(src)),
      offers: {
        "@type": "Offer",
        price: (bid / 100).toFixed(2),
        priceCurrency: "INR",
        availability:
          auction.status === "live" || auction.status === "scheduled"
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        url: pageUrl(`/auction/${auction.id}`),
      },
    },
  };
}

/** Unique, crawler-visible head tags for a route. */
export function renderHeadTags(meta: SeoMeta): string {
  const url = pageUrl(meta.path);
  const title = meta.title;
  const description = meta.description;
  const image = absoluteUrl(meta.image);
  const imageAlt = meta.imageAlt ?? DEFAULT_IMAGE_ALT;
  const type = meta.type ?? "website";
  const isFallbackImage = image === DEFAULT_IMAGE;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${meta.noIndex ? "noindex, follow" : "index, follow"}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="${escapeHtml(type)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:site_name" content="lelam.co" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    ...(isFallbackImage
      ? [`<meta property="og:image:width" content="900" />`, `<meta property="og:image:height" content="1125" />`]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ];
  if (meta.jsonLd) {
    const json = JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c");
    tags.push(`<script id="lelam-seo-jsonld" type="application/ld+json">${json}</script>`);
  }
  return tags.join("\n    ");
}
