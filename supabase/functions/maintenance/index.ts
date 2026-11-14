// Manual sweep for environments where pg_cron is unavailable.
// Deploy with: supabase functions deploy maintenance --no-verify-jwt
// Secrets: MAINTENANCE_SECRET (any long random string)
import { createClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("MAINTENANCE_SECRET");
  const provided =
    request.headers.get("x-maintenance-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const { data, error } = await admin.rpc("run_maintenance");
  if (error) {
    console.error("run_maintenance", error);
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, result: data });
});
