/**
 * Bundles the SEO endpoints into self-contained Vercel functions.
 *
 * Vercel transpiles every file under `api/` on its own (this package is
 * `type: module`), so a deployed function that imports `./lib/foo` at runtime
 * dies with "Cannot find module '.../lib/foo'". Bundling here means each
 * deployed function is ONE file with no relative imports left to resolve.
 *
 * Sources live in `server/` (never deployed directly); `npm run build`
 * regenerates `api/render.js`, `api/sitemap.js` and `api/health.js`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "api");
const entries = ["render", "sitemap", "health"];

fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
  if (file.endsWith(".js") || file.endsWith(".js.map")) {
    fs.rmSync(path.join(outDir, file));
  }
}

for (const name of entries) {
  const outfile = path.join(outDir, `${name}.js`);
  await build({
    entryPoints: [path.join(root, "server", `${name}.ts`)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    minify: true,
    legalComments: "none",
    logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"' },
    // Bundled CommonJS packages (dotenv, supabase-js deps) call require() for
    // Node builtins; ESM output has no require, so provide one.
    banner: {
      js: 'import{createRequire as __cr}from"node:module";const require=__cr(import.meta.url);',
    },
  });

  const size = fs.statSync(outfile).size;
  console.log(`[build-api] api/${name}.js (${(size / 1024).toFixed(0)} kB, self-contained)`);
}
