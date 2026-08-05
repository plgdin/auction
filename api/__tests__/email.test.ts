import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

let sendSignupEmailHandler: any;
let sendTransactionalEmailHandler: any;

beforeAll(async () => {
  process.env.INTERNAL_API_SECRET = 'test-secret';
  process.env.VERCEL_ENV = 'development';
  process.env.RESEND_API_KEY = 're_test';

  // Import dynamically to ensure environment variables are populated beforehand
  sendSignupEmailHandler = (await import('../send-signup-email')).default;
  sendTransactionalEmailHandler = (await import('../send-transactional-email')).default;
});

// Mock Supabase client functions using vi.hoisted
const {
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockUpdate,
  mockGetUser,
  mockGetUserById,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockUpdate = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }));
  const mockEq = vi.fn(() => ({
    single: mockSingle,
    update: mockUpdate,
  }));
  const mockSelect = vi.fn(() => ({
    eq: mockEq
  }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  }));
  const mockGetUser = vi.fn();
  const mockGetUserById = vi.fn();

  return {
    mockFrom,
    mockSelect,
    mockEq,
    mockSingle,
    mockUpdate,
    mockGetUser,
    mockGetUserById,
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
      admin: {
        getUserById: mockGetUserById
      }
    }
  })
}));

// Mock standard fetch globally
global.fetch = vi.fn(async () => {
  return {
    ok: true,
    json: async () => ({ id: 'email_id_123' })
  } as Response;
});

describe('Email Security and Delivery Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/send-signup-email', () => {
    it('rejects request without valid auth token', async () => {
      const req = {
        method: 'POST',
        headers: {},
      };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      await sendSignupEmailHandler(req, res);
      expect(statusValue).toBe(401);
      expect(jsonValue).toEqual({ success: false, error: 'Unauthorized: Missing token' });
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('processes dynamic email dispatch and prevents duplicates (idempotency)', async () => {
      const req = {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-user-token'
        }
      };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
        error: null
      });

      // Profile checks out: welcome_email_sent is false
      mockSingle.mockResolvedValueOnce({
        data: { first_name: 'Aditya', welcome_email_sent: false },
        error: null
      });

      await sendSignupEmailHandler(req, res);
      expect(statusValue).toBe(200);
      expect(jsonValue).toEqual({ success: true, message: 'Signup confirmation email sent successfully.' });
      
      // Check database update was called to flag email as sent
      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(mockUpdate).toHaveBeenCalledWith({ welcome_email_sent: true });
    });

    it('returns success and skips sending if welcome email has already been sent', async () => {
      const req = {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-user-token'
        }
      };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
        error: null
      });

      // Profile says: welcome_email_sent is true
      mockSingle.mockResolvedValueOnce({
        data: { first_name: 'Aditya', welcome_email_sent: true },
        error: null
      });

      await sendSignupEmailHandler(req, res);
      expect(statusValue).toBe(200);
      expect(jsonValue).toEqual({ success: true, message: 'Welcome email already sent.' });
      
      // Ensure sendEmail (fetch) was NOT triggered
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/send-transactional-email', () => {
    it('rejects trigger requests without internal secret authorization', async () => {
      const req = {
        method: 'POST',
        headers: {
          authorization: 'Bearer bad-secret'
        },
        body: {
          type: 'bid_confirmation',
          payload: { bidder_id: '123', auction_id: 'abc', amount: 500 }
        }
      };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      await sendTransactionalEmailHandler(req, res);
      expect(statusValue).toBe(401);
      expect(jsonValue).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('successfully triggers transactional outbid email via internal secret', async () => {
      const req = {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-secret'
        },
        body: {
          type: 'outbid_alert',
          payload: { bidder_id: 'user-456', auction_id: 'auction-789' }
        }
      };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      mockGetUserById.mockResolvedValueOnce({
        data: { user: { email: 'outbid@example.com', user_metadata: { first_name: 'Bob' } } },
        error: null
      });

      mockSingle.mockResolvedValueOnce({
        data: { first_name: 'Bob' },
        error: null
      });

      mockSingle.mockResolvedValueOnce({
        data: { title: 'Valuable Machinery Auction' },
        error: null
      });

      await sendTransactionalEmailHandler(req, res);
      expect(statusValue).toBe(200);
      expect(jsonValue).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
