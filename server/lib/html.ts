import { renderHeadTags, type SeoMeta } from "./meta";

const OWNED_META = /(?:name|property)\s*=\s*["'](?:description|robots|og:|twitter:)[^"']*["']/i;

/** Remove tags owned by the SEO layer so injected tags never duplicate defaults. */
function stripOwnedTags(html: string): string {
  return html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*\/?>/gi, "")
    .replace(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<meta\b[^>]*>/gi, (tag) => (OWNED_META.test(tag) ? "" : tag));
}

/** Inject crawler-visible metadata into the SPA shell without changing the app. */
export function renderDocument(meta: SeoMeta, shellHtml: string): string {
  const head = renderHeadTags(meta);
  return stripOwnedTags(shellHtml).replace(/<\/head>/i, `    ${head}\n  </head>`);
}
