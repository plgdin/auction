import { SHELL_HTML } from "./_shell.generated";
import { renderRoute } from "./lib/render";

/** Vercel function: server-rendered metadata + genuine 404 for SPA routes. */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/";
  const result = await renderRoute(path, url.searchParams, SHELL_HTML);

  if (result.redirect) {
    return new Response(null, { status: result.status, headers: { Location: result.redirect } });
  }

  return new Response(result.html, {
    status: result.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control":
        result.status === 200 ? "public, max-age=0, s-maxage=300" : "no-store",
    },
  });
}
