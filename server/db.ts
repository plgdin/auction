import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

let dbInstance: PGlite | null = null;
let initPromise: Promise<PGlite> | null = null;

/** Serialises write transactions because PGlite uses a single connection. */
let txChain: Promise<unknown> = Promise.resolve();

export async function getDb(): Promise<PGlite> {
  if (!initPromise) {
    initPromise = init();
  }
  return initPromise;
}

async function init(): Promise<PGlite> {
  const dir = process.env.PGLITE_DIR || path.resolve(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  dbInstance = new PGlite(dir);
  await dbInstance.waitReady;
  await migrate(dbInstance);
  return dbInstance;
}

async function migrate(db: PGlite) {
  const migrationsDir = path.resolve(process.cwd(), "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) return;
  await db.exec(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql") && !name.includes("_cloud") && !name.includes("_rls"))
    .sort();
  const applied = await db.query<{ filename: string }>("select filename from schema_migrations");
  const appliedSet = new Set(applied.rows.map((row) => row.filename));
  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await db.exec("begin");
    try {
      await db.exec(sql);
      await db.query("insert into schema_migrations (filename) values ($1)", [file]);
      await db.exec("commit");
      console.log(`[db] applied ${file}`);
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  }
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  const result = await db.query<T>(sql, params);
  return result.rows;
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export type Tx = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T | null>;
};

export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const run = async () => {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const wrapped: Tx = {
        query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          const res = await tx.query<R>(sql, params);
          return res.rows;
        },
        one: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          const res = await tx.query<R>(sql, params);
          return res.rows[0] ?? null;
        },
      };
      return fn(wrapped);
    });
  };
  const next = txChain.then(run, run);
  txChain = next.catch(() => undefined);
  return next;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    initPromise = null;
  }
}
