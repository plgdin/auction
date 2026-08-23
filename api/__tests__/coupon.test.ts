import { describe, it, expect, vi, beforeEach } from 'vitest';
import validateCouponHandler from '../validate-coupon';
import createOrderHandler from '../create-order';

// Mock Supabase client functions using vi.hoisted so they are available inside hoisted mocks
const { mockFrom, mockSelect, mockEq, mockMaybeSingle } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
  const mockEq = vi.fn(() => ({
    maybeSingle: mockMaybeSingle
  }));
  const mockSelect = vi.fn(() => ({
    eq: mockEq
  }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert
  }));
  return { mockFrom, mockSelect, mockEq, mockMaybeSingle };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: {
      getUser: vi.fn(async (token) => {
        if (token === 'valid-token') {
          return { data: { user: { id: 'test-user-id', email: 'test@example.com' } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      })
    }
  })
}));

// Mock Razorpay
vi.mock('razorpay', () => {
  return {
    default: class MockRazorpay {
      orders = {
        create: vi.fn(async (options) => {
          return { id: 'order_12345', amount: options.amount, currency: options.currency };
        })
      };
      subscriptions = {
        create: vi.fn(async () => {
          return { id: 'order_12345' };
        })
      };
    }
  };
});

describe('Coupon Validation & Calculation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/validate-coupon', () => {
    it('returns error if coupon code is missing', async () => {
      const req = { method: 'GET', query: {}, headers: {} };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      await validateCouponHandler(req, res);
      expect(statusValue).toBe(400);
      expect(jsonValue).toEqual({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Coupon code parameter is required.' }
      });
    });

    it('returns discount details if coupon code is valid', async () => {
      const req = { method: 'GET', query: { code: 'STAY30' }, headers: {} };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      // Mock database response for active STAY30 code (30% discount)
      mockMaybeSingle.mockResolvedValueOnce({
        data: { discount_percent: 30, is_active: true, expires_at: null },
        error: null
      });

      await validateCouponHandler(req, res);
      expect(statusValue).toBe(200);
      expect(jsonValue).toEqual({
        success: true,
        data: { code: 'STAY30', discount_percent: 30 }
      });
      expect(mockFrom).toHaveBeenCalledWith('promo_codes');
      expect(mockSelect).toHaveBeenCalledWith('discount_percent, is_active, expires_at');
      expect(mockEq).toHaveBeenCalledWith('code', 'STAY30');
    });

    it('returns 404 error if coupon code does not exist', async () => {
      const req = { method: 'GET', query: { code: 'NOEXIST' }, headers: {} };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      // Mock database response for non-existent code
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await validateCouponHandler(req, res);
      expect(statusValue).toBe(404);
      expect(jsonValue).toEqual({
        success: false,
        error: { code: 'INVALID_COUPON', message: 'Invalid coupon code.' }
      });
    });

    it('returns error if coupon is inactive', async () => {
      const req = { method: 'GET', query: { code: 'OLDCODE' }, headers: {} };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      mockMaybeSingle.mockResolvedValueOnce({
        data: { discount_percent: 15, is_active: false, expires_at: null },
        error: null
      });

      await validateCouponHandler(req, res);
      expect(statusValue).toBe(400);
      expect(jsonValue).toEqual({
        success: false,
        error: { code: 'COUPON_INACTIVE', message: 'This coupon code is no longer active.' }
      });
    });

    it('returns error if coupon has expired', async () => {
      const req = { method: 'GET', query: { code: 'EXPIRED10' }, headers: {} };
      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      mockMaybeSingle.mockResolvedValueOnce({
        data: { discount_percent: 10, is_active: true, expires_at: '2020-01-01T00:00:00Z' },
        error: null
      });

      await validateCouponHandler(req, res);
      expect(statusValue).toBe(400);
      expect(jsonValue).toEqual({
        success: false,
        error: { code: 'COUPON_EXPIRED', message: 'This coupon code has expired.' }
      });
    });
  });

  describe('POST /api/create-order', () => {
    it('secures checkout amount calculation by validating coupon and pricing backend-side', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          planId: 'pro',
          billingCycle: 'monthly',
          couponCode: 'STAY50', // 50% off -> 1499 - 750 = 749 INR -> 74900 paise
          amount: 74900
        }
      };

      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      // Mock database response for active STAY50 code (50% discount)
      mockMaybeSingle.mockResolvedValueOnce({
        data: { discount_percent: 50, is_active: true, expires_at: null },
        error: null
      });

      await createOrderHandler(req, res);
      expect(statusValue).toBe(200);
      expect(jsonValue).toEqual({
        success: true,
        data: {
          order_id: 'order_12345',
          amount: 74900,
          currency: 'INR'
        }
      });
    });

    it('rejects checkout creation if client tampers with the payment amount', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: {
          planId: 'pro',
          billingCycle: 'monthly',
          extraSeats: 0, // 1499 subtotal + 18% GST (270) = 1769 INR -> 176900 paise
          couponCode: '',
          amount: 100 // Tampered amount (1 INR)
        }
      };

      let statusValue = 200;
      let jsonValue = {};
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => { statusValue = code; return res; },
        json: (data: any) => { jsonValue = data; return res; }
      };

      await createOrderHandler(req, res);
      expect(statusValue).toBe(400);
      expect(jsonValue).toEqual({
        success: false,
        error: 'Security alert: Submitted amount does not match server calculation.'
      });
    });
  });
});
