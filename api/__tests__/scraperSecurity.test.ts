import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAllowedOrigin, setCorsHeaders } from '../utils/cors.js';

// Mock Supabase client
const deletedTables: string[] = [];

const mockSupabase = {
  from: (table: string) => ({
    delete: (opts?: any) => ({
      neq: (col: string, val: string) => {
        deletedTables.push(table);
        return Promise.resolve({ data: null, count: 42, error: null });
      },
    }),
    insert: () => Promise.resolve({ data: null, error: null }),
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
        single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
      }),
    }),
  }),
  auth: {
    getUser: (token: string) => {
      if (token === 'valid-admin-token') {
        return Promise.resolve({
          data: {
            user: {
              id: 'admin-user-123',
              email: 'admin@lelam.co',
              app_metadata: { role: 'admin' },
              user_metadata: { role: 'admin' },
            },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { user: null }, error: new Error('Invalid token') });
    },
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));

describe('API Security & CORS Origin Protection', () => {
  describe('CORS Allowlist Enforcement (api/utils/cors.ts)', () => {
    it('allows verified local development origins', () => {
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    });

    it('rejects unauthorized external origins without wildcard leakage', () => {
      expect(isAllowedOrigin('https://malicious-site.com')).toBe(false);
      expect(isAllowedOrigin('http://attacker.com')).toBe(false);
      expect(isAllowedOrigin('')).toBe(false);
      expect(isAllowedOrigin(undefined)).toBe(false);
    });

    it('sets CORS headers strictly for allowed origins and omits for disallowed', () => {
      const headers: Record<string, string> = {};
      const mockRes = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
      };

      // Disallowed origin
      setCorsHeaders({ headers: { origin: 'https://evil.org' } }, mockRes);
      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();

      // Allowed origin
      setCorsHeaders({ headers: { origin: 'http://localhost:5173' } }, mockRes);
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
      expect(headers['Vary']).toBe('Origin');
    });
  });

  describe('Destructive Endpoint Safety & Real Execution (api/scraper.ts)', () => {
    beforeEach(() => {
      deletedTables.length = 0;
    });

    it('rejects /api/scraper/clear-db/start when confirmation header is missing', async () => {
      const { default: handler } = await import('../scraper.js');

      let responseStatus = 0;
      let responseBody: any = null;

      const mockReq = {
        method: 'POST',
        url: '/api/scraper/clear-db/start',
        headers: {
          authorization: 'Bearer valid-admin-token',
        },
      };

      const mockRes = {
        setHeader: () => {},
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      };

      await handler(mockReq, mockRes);

      expect(responseStatus).toBe(400);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('CONFIRMATION_REQUIRED');
      expect(deletedTables.length).toBe(0);
    });

    it('executes real database purge when admin provides confirmation header', async () => {
      const { default: handler } = await import('../scraper.js');

      let responseStatus = 0;
      let responseBody: any = null;

      const mockReq = {
        method: 'POST',
        url: '/api/scraper/clear-db/start',
        headers: {
          authorization: 'Bearer valid-admin-token',
          'x-destructive-confirm': 'CONFIRM_PURGE_ALL_SCRAPED_DATA',
        },
      };

      const mockRes = {
        setHeader: () => {},
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      };

      await handler(mockReq, mockRes);

      expect(responseStatus).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(deletedTables).toContain('baanknet_auctions');
      expect(deletedTables).toContain('baanknet_auction_photos');
      expect(deletedTables).toContain('gem_auctions');
      expect(deletedTables).toContain('gem_bids');
      expect(deletedTables).toContain('mstc_auctions');
    });
  });
});
