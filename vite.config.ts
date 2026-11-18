import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import { renderRoute } from "./server/lib/render";
import { buildSitemap, type SitemapType } from "./server/lib/sitemap";

const SITEMAP_ROUTE = /^\/sitemap(?:-(static|categories|products|auctions))?\.xml$/;
const SEO_ROUTE = /^\/(?:products|product\/[^/]+|auctions|auction\/[^/]+|order\/[^/]+)\/?$/;
const VALID_ROUTE =
  /^\/(?:$|products\/?$|shop\/?$|product\/[^/]+\/?$|cart\/?$|checkout\/?$|auctions\/?$|auction\/[^/]+\/?$|login\/?$|register\/?$|sell(?:\/new)?\/?$|seller\/?$|account\/?$|admin\/?$|order-confirmed\/[^/]+\/?$|order-success\/[^/]+\/?$|payment-failed(?:\/[^/]+)?\/?$|orders\/[^/]+\/?$|terms\/?$|privacy\/?$|returns\/?$|auction-terms\/?$)/;
const SKIP_PREFIXES = [
  "/@",
  "/src/",
  "/node_modules/",
  "/api/",
  "/assets/",
  "/images/",
  "/fonts/",
  "/ass/",
  "/.well-known/",
];
const ROOT_FILE =
  /^\/(?:robots\.txt|llms\.txt|index\.html|favicon[^/]*|android-chrome[^/]*|apple-touch-icon[^/]*|site\.webmanifest)$/;
const HAS_EXTENSION = /\.[a-zA-Z0-9]+$/;

function shouldIntercept(pathname: string): boolean {
  if (SITEMAP_ROUTE.test(pathname)) return true;
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  if (ROOT_FILE.test(pathname) || HAS_EXTENSION.test(pathname)) return false;
  return SEO_ROUTE.test(pathname) || !VALID_ROUTE.test(pathname);
}

/** Embed the built SPA shell so the Vercel function can serve it without disk access. */
function generateShellPlugin(): Plugin {
  return {
    name: "lelam-generate-seo-shell",
    apply: "build",
    closeBundle() {
      const html = fs.readFileSync(path.resolve(process.cwd(), "dist/index.html"), "utf8");
      const target = path.resolve(process.cwd(), "server/lib/shell.generated.ts");
      fs.writeFileSync(
        target,
        `// Generated from dist/index.html by vite.config.ts. Do not edit.\nexport const SHELL_HTML = ${JSON.stringify(html)};\n`,
        "utf8",
      );
    },
  };
}

/** Mirrors the Vercel functions in `vite dev` so tests see real server HTML. */
function seoDevPlugin(): Plugin {
  return {
    name: "lelam-seo-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next();
        const url = new URL(req.url, "http://localhost");
        if (!shouldIntercept(url.pathname)) return next();

        try {
          const sitemap = url.pathname.match(SITEMAP_ROUTE);
          if (sitemap) {
            const xml = await buildSitemap((sitemap[1] || "index") as SitemapType);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/xml; charset=utf-8");
            res.end(xml);
            return;
          }

          const shell = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
          const result = await renderRoute(url.pathname, url.searchParams, shell);
          if (result.redirect) {
            res.statusCode = result.status;
            res.setHeader("Location", result.redirect);
            res.end();
            return;
          }
          const html = await server.transformIndexHtml(url.pathname, result.html, req.originalUrl);
          res.statusCode = result.status;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoDevPlugin(), generateShellPlugin()],
  build: {
    sourcemap: true,
    // Stable entry/CSS names keep the committed SEO shell valid even if a
    // platform bundles functions before running the build command.
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
