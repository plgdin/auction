import { SHELL_HTML } from "./lib/shell.generated";

/**
 * Vercel function: server-rendered metadata + genuine 404 for SPA routes.
 *
 * Uses the classic Node.js handler signature (supported on every Vercel Node
 * runtime) and lazy-loads the renderer so a failure inside SEO/data code can
 * never take the page down — we simply serve the SPA shell instead.
 */
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }

  try {
    const origin = `https://${req.headers?.host ?? "lelam.co"}`;
    const url = new URL(req.url || "/", origin);
    const path = url.searchParams.get("path") || "/";

    const { renderRoute } = await import("./lib/render");
    const result = await renderRoute(path, url.searchParams, SHELL_HTML);

    if (result.redirect) {
      res.statusCode = result.status;
      res.setHeader("Location", result.redirect);
      res.end();
      return;
    }

    res.statusCode = result.status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      result.status === 200 ? "public, max-age=0, s-maxage=300" : "no-store",
    );
    res.end(result.html);
  } catch (error) {
    console.error("[api/render] falling back to SPA shell:", error);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(SHELL_HTML);
  }
}
