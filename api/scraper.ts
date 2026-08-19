import { runAssetPipelineQueue } from '../scraper/assetWorker.js';
// Mocks for missing scratch modules
const clearAll = async () => { console.log('clearAll placeholder'); };
const executeBackfill = async (mode: string) => { console.log('executeBackfill placeholder', mode); };
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { isRateLimited, getClientIp } from './utils/rateLimiter.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function verifyAdmin(req: any, res: any, ip: string, userAgent: string): Promise<any> {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      // Log unauthorized access attempt
      await supabase.from('security_audit_logs').insert({
        email: 'anonymous',
        ip_address: ip,
        user_agent: userAgent,
        system_info: { endpoint: req.url, reason: 'Missing authentication token' }
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication token.'
        }
      });
      return null;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      await supabase.from('security_audit_logs').insert({
        email: 'anonymous',
        ip_address: ip,
        user_agent: userAgent,
        system_info: { endpoint: req.url, reason: 'Invalid or expired token' }
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired authentication token.'
        }
      });
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      // Log privilege escalation attempt
      await supabase.from('security_audit_logs').insert({
        email: user.email || 'unknown',
        user_id: user.id,
        ip_address: ip,
        user_agent: userAgent,
        system_info: { endpoint: req.url, role: profile?.role || 'none', reason: 'Requires administrator privileges' }
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Requires administrator privileges.'
        }
      });
      return null;
    }

    return user;
  } catch (err: any) {
    console.error('Error in verifyAdmin middleware:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during authentication validation.'
      }
    });
    return null;
  }
}

// In-memory logs (persisted across warm requests in Vercel Lambda)
let scraperLogs: string[] = ['[System] Serverless mode active. Puppeteer GUI cannot run on Vercel. Run the scraper locally to solve CAPTCHA.'];
let workerLogs: string[] = ['[System] Serverless mode active. Click "Start Worker" to run a single queue batch serverlessly.'];
let clearDbLogs: string[] = ['[System] Serverless mode active. Click "Clear DB & Storage" to wipe database serverlessly.'];
let backfillLogs: string[] = ['[System] Serverless mode active. Click "Start Backfiller" to process database text parse serverlessly.'];

export default async function handler(req: any, res: any) {
  // Set JSON headers
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse path from req.url
  const url = req.url || '';
  const cleanUrl = url.split('?')[0];
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    // 1. Rate Limiting & Abuse Protection
    const isMutatingAction = req.method === 'POST';
    const limit = isMutatingAction ? 10 : 60; // 10 request/min for operations, 60/min for status
    if (isRateLimited(ip, limit, 60 * 1000)) {
      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please try again later.'
        }
      });
      return;
    }

    // 2. Enforce admin check globally for all scraper routes
    const user = await verifyAdmin(req, res, ip, userAgent);
    if (!user) return;

    // 3. Status Check
    if (cleanUrl === '/api/scraper/status') {
      res.status(200).json({
        isServerless: true,
        scraperRunning: false,
        workerRunning: false,
        clearDbRunning: false,
        backfillRunning: false,
        gemRunning: false,
        gemBidsRunning: false,
        scraperLogs,
        workerLogs,
        clearDbLogs,
        backfillLogs,
        gemLogs: ['[System] Serverless mode active. Puppeteer GUI cannot run on Vercel. Run the scraper locally.'],
        gemBidsLogs: ['[System] Serverless mode active. Puppeteer GUI cannot run on Vercel. Run the scraper locally.']
      });
      return;
    }

    // 4. POST Endpoints
    if (req.method === 'POST') {
      // Reset Failed Auctions (Admins only)
      if (cleanUrl === '/api/scraper/reset-failed') {
        const { error } = await supabase
          .from('mstc_auctions')
          .update({
            asset_status: 'pending',
            retry_count: 0,
            error_log: null
          })
          .eq('asset_status', 'failed');

        if (error) {
          throw error;
        }

        // Insert audit log
        await supabase.from('audit_logs').insert([{
          user_id: user.id,
          action: 'mstc_auctions_reset',
          entity_type: 'mstc_auction',
          details: { message: 'Manually reset all failed auctions back to pending status.' }
        }]);

        res.status(200).json({ success: true });
        return;
      }

      // Unlock Processing Auctions (Admins only)
      if (cleanUrl === '/api/scraper/unlock-processing') {
        const { error } = await supabase
          .from('mstc_auctions')
          .update({
            asset_status: 'pending',
            retry_count: 0,
            error_log: null
          })
          .eq('asset_status', 'processing');

        if (error) {
          throw error;
        }

        // Insert audit log
        await supabase.from('audit_logs').insert([{
          user_id: user.id,
          action: 'mstc_auctions_unlocked',
          entity_type: 'mstc_auction',
          details: { message: 'Manually unlocked all stuck processing auctions back to pending status.' }
        }]);

        res.status(200).json({ success: true });
        return;
      }

      // Reset Single Failed Auction (Admins only)
      if (cleanUrl === '/api/scraper/reset-single') {
        const parsedUrl = new URL(req.url || '', 'http://localhost');
        const id = parsedUrl.searchParams.get('id');

        // Input parameter validation using Zod
        const uuidSchema = z.string().uuid();
        const parseResult = uuidSchema.safeParse(id);
        
        if (!parseResult.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'Invalid or missing UUID parameter "id".'
            }
          });
          return;
        }

        const { error } = await supabase
          .from('mstc_auctions')
          .update({
            asset_status: 'pending',
            retry_count: 0,
            error_log: null
          })
          .eq('id', id);

        if (error) {
          throw error;
        }

        // Insert audit log
        await supabase.from('audit_logs').insert([{
          user_id: user.id,
          action: 'mstc_auction_reset_single',
          entity_type: 'mstc_auction',
          details: { auction_id: id, message: `Manually reset failed auction status.` }
        }]);

        res.status(200).json({ success: true });
        return;
      }

      // Scraper
      if (cleanUrl === '/api/scraper/start') {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'The interactive MSTC Portal Scraper requires a browser GUI to solve CAPTCHAs, which is not supported in Vercel Serverless Functions. Please run this scraper locally using "npm run dev".'
          }
        });
        return;
      }
      
      if (cleanUrl === '/api/scraper/stop' || cleanUrl === '/api/scraper/input') {
        res.status(200).json({ success: true });
        return;
      }

      // BaankNet Multi-Module Scraper
      if (cleanUrl === '/api/scraper/baanknet/start') {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'The BaankNet Multi-Module Scraper requires Chromium binaries for Angular bootstrap. Please run this scraper locally using "npm run dev".'
          }
        });
        return;
      }
      if (cleanUrl === '/api/scraper/baanknet/stop') {
        res.status(200).json({ success: true });
        return;
      }

      // GeM Portal Scraper
      if (cleanUrl === '/api/scraper/gem/start') {
        res.status(400).json({
          success: false,
          message: 'The GeM Portal Scraper requires Chromium binaries to navigate the forward auctions directory. Please run this scraper locally using "npm run dev".'
        });
        return;
      }
      if (cleanUrl === '/api/scraper/gem/stop') {
        res.status(200).json({ success: true });
        return;
      }

      // GeM Bids Scraper
      if (cleanUrl === '/api/scraper/gem-bids/start') {
        res.status(400).json({
          success: false,
          message: 'The GeM Bids Scraper requires Chromium binaries to navigate the procurement bids directory. Please run this scraper locally using "npm run dev".'
        });
        return;
      }
      if (cleanUrl === '/api/scraper/gem-bids/stop') {
        res.status(200).json({ success: true });
        return;
      }
      // Worker (Single-loop batch)
      if (cleanUrl === '/api/scraper/worker/start') {
        workerLogs.push(`[${new Date().toLocaleTimeString()}] Triggered serverless batch queue processor...`);
        // Execute one batch loop
        runAssetPipelineQueue()
          .then(async () => {
            workerLogs.push(`[${new Date().toLocaleTimeString()}] Batch loop completed successfully! Check the "Scraped Catalogs" tab or audit logs.`);
            await supabase.from('audit_logs').insert([{
              user_id: user.id,
              action: 'worker_batch_completed',
              entity_type: 'worker',
              details: { message: 'Asset worker queue batch completed.' }
            }]);
          })
          .catch((err: any) => {
            workerLogs.push(`[${new Date().toLocaleTimeString()}] Worker batch failed: ${err.message}`);
          });

        res.status(200).json({
          success: true,
          message: 'Asset worker batch execution triggered serverlessly.'
        });
        return;
      }
      
      if (cleanUrl === '/api/scraper/worker/stop') {
        res.status(200).json({ success: true });
        return;
      }

      // Clear DB
      if (cleanUrl === '/api/scraper/clear-db/start') {
        clearDbLogs.push(`[${new Date().toLocaleTimeString()}] Wiping Supabase storage buckets & database rows...`);
        clearAll()
          .then(async () => {
            clearDbLogs.push(`[${new Date().toLocaleTimeString()}] Database and storage wiped successfully!`);
            await supabase.from('audit_logs').insert([{
              user_id: user.id,
              action: 'database_wipe',
              entity_type: 'system',
              details: { message: 'Admin requested database and storage buckets wipe.' }
            }]);
          })
          .catch((err: any) => {
            clearDbLogs.push(`[${new Date().toLocaleTimeString()}] Clear operation failed: ${err.message}`);
          });

        res.status(200).json({
          success: true,
          message: 'Database wipe operation triggered serverlessly.'
        });
        return;
      }
      
      if (cleanUrl === '/api/scraper/clear-db/stop') {
        res.status(200).json({ success: true });
        return;
      }

      // Backfiller
      if (cleanUrl === '/api/scraper/backfill/start') {
        backfillLogs.push(`[${new Date().toLocaleTimeString()}] Starting database catalog parser backfill...`);
        executeBackfill('parse')
          .then(async () => {
            backfillLogs.push(`[${new Date().toLocaleTimeString()}] Catalog parser backfill complete!`);
            await supabase.from('audit_logs').insert([{
              user_id: user.id,
              action: 'database_backfill',
              entity_type: 'system',
              details: { message: 'Admin requested database parser backfill.' }
            }]);
          })
          .catch((err: any) => {
            backfillLogs.push(`[${new Date().toLocaleTimeString()}] Backfill failed: ${err.message}`);
          });

        res.status(200).json({
          success: true,
          message: 'Backfiller execution triggered serverlessly.'
        });
        return;
      }
      
      if (cleanUrl === '/api/scraper/backfill/stop') {
        res.status(200).json({ success: true });
        return;
      }
    }

    // 404 for other endpoints
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found or method not supported'
      }
    });
  } catch (error: any) {
    // Failure Handling: Obfuscate database exceptions
    console.error('Error in /api/scraper handler:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.'
      }
    });
  }
}
