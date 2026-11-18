import { CATEGORIES, findTopForLegacy } from "../../src/lib/categories";
import { getPublicAuction, getPublicProduct } from "./data";
import { renderDocument } from "./html";
import {
  auctionMeta,
  homepageMeta,
  notFoundMeta,
  productMeta,
  productsMeta,
  auctionsMeta,
} from "./meta";

export interface RenderResult {
  status: number;
  html: string;
  redirect?: string;
}

/** Routes that render in the SPA but need no crawler-specific metadata. */
const PASSTHROUGH_ROUTES = new Set([
  "/shop",
  "/cart",
  "/checkout",
  "/login",
  "/register",
  "/sell",
  "/sell/new",
  "/seller",
  "/account",
  "/admin",
  "/terms",
  "/privacy",
  "/returns",
  "/auction-terms",
  "/payment-failed",
]);

const PASSTHROUGH_PATTERNS = [
  /^\/order-confirmed\/[^/]+$/,
  /^\/order-success\/[^/]+$/,
  /^\/payment-failed\/[^/]+$/,
  /^\/orders\/[^/]+$/,
];

function normalizedPath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

function categoryFrom(query: URLSearchParams): string | null {
  const raw = query.get("category");
  if (!raw) return null;
  if (CATEGORIES.includes(raw)) return raw;
  const legacy = findTopForLegacy(raw);
  return CATEGORIES.includes(legacy) ? legacy : null;
}

/**
 * Resolve a clean SPA path to server-generated HTML. Shared by the Vercel
 * function and the Vite dev middleware so local tests see the same response.
 */
export async function renderRoute(
  path: string,
  query: URLSearchParams,
  shellHtml: string,
): Promise<RenderResult> {
  const route = normalizedPath(path);

  // Legacy notification links used the singular /order/:id form.
  const legacyOrder = route.match(/^\/order\/([^/]+)$/);
  if (legacyOrder) {
    return { status: 308, html: "", redirect: `/orders/${legacyOrder[1]}` };
  }

  if (route === "/") {
    return { status: 200, html: shellHtml };
  }

  if (route === "/products") {
    return {
      status: 200,
      html: renderDocument(productsMeta(categoryFrom(query)), shellHtml),
    };
  }

  if (route === "/auctions") {
    return { status: 200, html: renderDocument(auctionsMeta(), shellHtml) };
  }

  const productMatch = route.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const product = await getPublicProduct(decodeURIComponent(productMatch[1]));
    if (!product) {
      return { status: 404, html: renderDocument(notFoundMeta(route), shellHtml) };
    }
    return {
      status: 200,
      html: renderDocument(
        productMeta({
          id: product.id,
          title: product.title,
          description: product.description,
          condition: product.condition,
          size: product.size,
          brand: product.brand,
          sellerName: product.seller_name,
          askingPrice: product.asking_price ?? 0,
          images: product.images,
          status: product.status,
        }),
        shellHtml,
      ),
    };
  }

  const auctionMatch = route.match(/^\/auction\/([^/]+)$/);
  if (auctionMatch) {
    const auction = await getPublicAuction(decodeURIComponent(auctionMatch[1]));
    if (!auction) {
      return { status: 404, html: renderDocument(notFoundMeta(route), shellHtml) };
    }
    const product = await getPublicProduct(auction.product_id);
    if (!product) {
      return { status: 404, html: renderDocument(notFoundMeta(route), shellHtml) };
    }
    return {
      status: 200,
      html: renderDocument(
        auctionMeta(
          {
            id: auction.id,
            productId: auction.product_id,
            status: auction.status,
            startingPrice: auction.starting_price_paise ?? 0,
            currentBid: auction.current_bid_paise,
          },
          {
            id: product.id,
            title: product.title,
            description: product.description,
            condition: product.condition,
            size: product.size,
            brand: product.brand,
            sellerName: product.seller_name,
            askingPrice: product.asking_price ?? 0,
            images: product.images,
            status: product.status,
          },
        ),
        shellHtml,
      ),
    };
  }

  if (PASSTHROUGH_ROUTES.has(route) || PASSTHROUGH_PATTERNS.some((re) => re.test(route))) {
    return { status: 200, html: shellHtml };
  }

  return { status: 404, html: renderDocument(notFoundMeta(route), shellHtml) };
}

/** Homepage metadata, exported for any caller that needs the default head. */
export { homepageMeta };
