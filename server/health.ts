/**
 * Vercel function: deployment diagnostics.
 *
 * Visit /api/health after deploying to see which server modules load, the
 * Node version and whether the Supabase env vars reached the function.
 * Never throws — every check reports its own error text.
 */
export default async function handler(_req: any, res: any): Promise<void> {
  const modules: Record<string, string> = {};
  const record = (name: string, error: unknown) => {
    modules[name] = error instanceof Error ? error.message : String(error);
  };

  try {
    await import("./lib/html");
    modules["lib/html"] = "ok";
  } catch (error) {
    record("lib/html", error);
  }
  try {
    await import("./lib/meta");
    modules["lib/meta"] = "ok";
  } catch (error) {
    record("lib/meta", error);
  }
  try {
    await import("./lib/data");
    modules["lib/data"] = "ok";
  } catch (error) {
    record("lib/data", error);
  }
  try {
    await import("./lib/render");
    modules["lib/render"] = "ok";
  } catch (error) {
    record("lib/render", error);
  }
  try {
    await import("./lib/sitemap");
    modules["lib/sitemap"] = "ok";
  } catch (error) {
    record("lib/sitemap", error);
  }
  try {
    await import("../src/lib/seed");
    modules["src/lib/seed"] = "ok";
  } catch (error) {
    record("src/lib/seed", error);
  }

  const payload = {
    ok: Object.values(modules).every((value) => value === "ok"),
    node: process.version,
    platform: process.platform,
    hasSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    ),
    modules,
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload, null, 2));
}
