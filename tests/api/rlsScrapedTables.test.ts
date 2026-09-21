import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../supabase/migrations/20260920120000_lockdown_rls_scraped_tables.sql'
);
const SQL_TEST_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../supabase/tests/rls_scraped_tables.sql'
);

describe('RLS Lockdown on Scraped Tables (Prompt 0)', () => {
  describe('Migration Static Integrity & Safety Audit', () => {
    it('exists and contains valid SQL drops for the four primary scraped tables', () => {
      expect(existsSync(MIGRATION_PATH)).toBe(true);
      const sqlContent = readFileSync(MIGRATION_PATH, 'utf-8');

      // 1. Check the 4 mandatory prompt tables
      expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Allow service role complete access on GeM" ON public\.gem_auctions;/);
      expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Allow service role complete access on GeM bids" ON public\.gem_bids;/);
      expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Allow service role complete access on BaankNet" ON public\.baanknet_auctions;/);
      expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Allow service role access on BaankNet photos" ON public\.baanknet_auction_photos;/);

      // 2. Check additional scraped-data tables
      expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Allow service role complete access" ON public\.mstc_auctions;/);
      expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Allow service role complete access on ocr_cache" ON public\.ocr_cache;/);
      expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Allow service role complete access on metalmandi_live_rates" ON public\.metalmandi_live_rates;/);
      expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Allow service role write to location_daily_stats" ON public\.location_daily_stats;/);

      // 3. Ensure no public read or admin policies are accidentally dropped
      expect(sqlContent).not.toMatch(/DROP POLICY.*read/i);
      expect(sqlContent).not.toMatch(/DROP POLICY.*admin/i);
      expect(sqlContent).not.toMatch(/DROP POLICY.*select/i);
    });

    it('ships the SQL verification test script', () => {
      expect(existsSync(SQL_TEST_SCRIPT_PATH)).toBe(true);
      const testSql = readFileSync(SQL_TEST_SCRIPT_PATH, 'utf-8');
      expect(testSql).toContain("SET LOCAL ROLE anon;");
      expect(testSql).toContain("PERFORM count(*) FROM public.gem_auctions;");
      expect(testSql).toContain("INSERT INTO public.gem_auctions");
      expect(testSql).toContain("ROLLBACK;");
    });
  });

  const testUrl = process.env.SUPABASE_TEST_URL;
  const testAnonKey = process.env.SUPABASE_TEST_ANON_KEY;

  describe.skipIf(!testUrl || !testAnonKey)('Live Supabase Integration Tests (skipped unless SUPABASE_TEST_URL is set)', () => {
    const anonClient = testUrl && testAnonKey ? createClient(testUrl, testAnonKey) : null;

    const tables = [
      'gem_auctions',
      'gem_bids',
      'baanknet_auctions',
      'baanknet_auction_photos',
    ] as const;

    for (const table of tables) {
      it(`allows anon to SELECT from ${table}`, async () => {
        const { error } = await anonClient.from(table).select('*').limit(1);
        expect(error).toBeNull();
      });

      it(`rejects anon INSERT into ${table}`, async () => {
        const payload: Record<string, unknown> = {
          gem_auctions: {
            gem_auction_id: `test_attack_${Date.now()}`,
            title: 'Malicious Injected Auction',
            auction_start_date: new Date().toISOString(),
            auction_end_date: new Date(Date.now() + 86400000).toISOString(),
            location: 'India',
          },
          gem_bids: {
            bid_number: `test_bid_attack_${Date.now()}`,
            items: 'Malicious Bid Items',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 86400000).toISOString(),
          },
          baanknet_auctions: {
            baanknet_auction_id: `test_bn_attack_${Date.now()}`,
            title: 'Malicious Property',
            bank_name: 'Fake Bank',
            auction_start_date: new Date().toISOString(),
            auction_end_date: new Date(Date.now() + 86400000).toISOString(),
            location: 'India',
          },
          baanknet_auction_photos: {
            baanknet_auction_id: 'non_existent_or_spoofed',
            photo_url: 'https://malicious.example.com/exploit.jpg',
          },
        }[table] || {};

        const { error } = await anonClient.from(table).insert(payload as any);
        expect(error).not.toBeNull();
      });

      it(`rejects anon UPDATE on ${table}`, async () => {
        const { error } = await anonClient
          .from(table)
          .update({ updated_at: new Date().toISOString() } as any)
          .neq('id', '00000000-0000-0000-0000-000000000000');

        // Either RLS throws permission denied error or returns 0 rows updated without error
        if (error) {
          expect(error.message).toMatch(/policy|permission|violation/i);
        }
      });

      it(`rejects anon DELETE on ${table}`, async () => {
        const { error } = await anonClient
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          expect(error.message).toMatch(/policy|permission|violation/i);
        }
      });
    }
  });
});
