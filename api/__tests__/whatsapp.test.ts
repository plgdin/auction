import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  sendWhatsAppInteractiveButtons,
} from '../utils/whatsapp.js';
import webhookHandler from '../whatsapp-webhook.js';
import transactionalHandler from '../send-transactional-whatsapp.js';

describe('WhatsApp Automation Test Suite', () => {
  describe('Phone Number Normalization', () => {
    it('normalizes 10-digit Indian numbers with country code', () => {
      expect(normalizePhoneNumber('9876543210')).toBe('919876543210');
      expect(normalizePhoneNumber('09876543210')).toBe('919876543210');
      expect(normalizePhoneNumber('+91 98765-43210')).toBe('919876543210');
    });

    it('preserves valid international numbers without + or symbols', () => {
      expect(normalizePhoneNumber('+1 (555) 234-5678')).toBe('15552345678');
      expect(normalizePhoneNumber('+44 7911 123456')).toBe('447911123456');
    });

    it('returns empty string for invalid or empty input', () => {
      expect(normalizePhoneNumber('')).toBe('');
      expect(normalizePhoneNumber('abc')).toBe('');
    });
  });

  describe('Mock / Development Mode Dispatches', () => {
    it('safely mocks text message dispatch without error', async () => {
      const res = await sendWhatsAppText('9876543210', 'Test notification');
      expect(res.success).toBe(true);
      expect(res.isMock).toBe(true);
      expect(res.messageId).toMatch(/^mock_wam_/);
    });

    it('safely mocks template message dispatch', async () => {
      const res = await sendWhatsAppTemplate('9876543210', 'bid_confirmation', 'en', [
        {
          type: 'body',
          parameters: [{ type: 'text', text: 'Rajesh' }],
        },
      ]);
      expect(res.success).toBe(true);
      expect(res.isMock).toBe(true);
      expect(res.messageId).toMatch(/^mock_wam_/);
    });

    it('safely mocks interactive button dispatch', async () => {
      const res = await sendWhatsAppInteractiveButtons(
        '9876543210',
        'Choose option:',
        [{ id: 'btn_1', title: 'Option 1' }]
      );
      expect(res.success).toBe(true);
      expect(res.isMock).toBe(true);
    });
  });

  describe('Webhook Challenge Verification', () => {
    it('responds with challenge on matching hub.mode and verify_token', async () => {
      let responseBody = '';
      let statusCode = 0;

      const req = {
        method: 'GET',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'lelam_whatsapp_verify_secret',
          'hub.challenge': 'test_challenge_12345',
        },
      };

      const res = {
        writeHead(code: number) { statusCode = code; },
        end(data: string) { responseBody = data; },
        status(code: number) { statusCode = code; return this; },
        json(data: any) { responseBody = JSON.stringify(data); return this; },
      };

      await webhookHandler(req, res);
      expect(statusCode).toBe(200);
      expect(responseBody).toBe('test_challenge_12345');
    });

    it('rejects verification with 403 on invalid verify_token', async () => {
      let statusCode = 0;
      const req = {
        method: 'GET',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_secret',
          'hub.challenge': 'test_challenge_12345',
        },
      };

      const res = {
        writeHead(code: number) { statusCode = code; },
        end() {},
        status(code: number) { statusCode = code; return this; },
        json() { return this; },
      };

      await webhookHandler(req, res);
      expect(statusCode).toBe(403);
    });
  });

  describe('Transactional Endpoint Security', () => {
    it('rejects requests without authentication with 401', async () => {
      let statusCode = 0;
      const req = {
        method: 'POST',
        headers: {},
        body: {
          type: 'bid_confirmation',
          payload: { bidder_id: '123', auction_id: '456', amount: 10000 },
        },
      };

      const res = {
        status(code: number) { statusCode = code; return this; },
        json() { return this; },
      };

      await transactionalHandler(req, res);
      expect(statusCode).toBe(401);
    });
  });
});
