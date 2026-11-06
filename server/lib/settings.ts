import { query } from "../db";

export type SettingsMap = Record<string, unknown>;

let cache: { value: SettingsMap; at: number } | null = null;

export async function getSettings(force = false): Promise<SettingsMap> {
  if (!force && cache && Date.now() - cache.at < 5000) return cache.value;
  const rows = await query<{ key: string; value: unknown }>(
    "select key, value from platform_settings",
  );
  const value = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  cache = { value, at: Date.now() };
  return value;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const settings = await getSettings();
  return (settings[key] as T) ?? fallback;
}

export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const value = await getSetting<unknown>(key, fallback);
  return typeof value === "number" ? value : Number(value) || fallback;
}

export async function getBoolSetting(key: string, fallback: boolean): Promise<boolean> {
  const value = await getSetting<unknown>(key, fallback);
  return typeof value === "boolean" ? value : Boolean(value);
}

export async function setSetting(key: string, value: unknown) {
  await query(
    `insert into platform_settings (key, value, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
  cache = null;
}
