import { runAssetPipelineQueue } from '../scraper/assetWorker.js';
import { clearAll } from '../scratch/clear_db.js';
import { executeBackfill } from '../scratch/backfill.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse path from req.url
  const url = req.url || '';
  const cleanUrl = url.split('?')[0];

  try {
    // 1. Status Check
    if (cleanUrl === '/api/scraper/status') {
      res.status(200).json({
        isServerless: true,
        scraperRunning: false,
        workerRunning: false,
        clearDbRunning: false,
        backfillRunning: false,
        scraperLogs,
        workerLogs,
        clearDbLogs,
        backfillLogs
      });
      return;
    }

    // 2. POST Endpoints
    if (req.method === 'POST') {
      // Scraper
      if (cleanUrl === '/api/scraper/start') {
        res.status(400).json({
          success: false,
          message: 'The interactive MSTC Portal Scraper requires a browser GUI to solve CAPTCHAs, which is not supported in Vercel Serverless Functions. Please run this scraper locally using "npm run dev".'
        });
        return;
      }
      if (cleanUrl === '/api/scraper/stop' || cleanUrl === '/api/scraper/input') {
        res.status(200).json({ success: true });
        return;
      }

      // Worker (Single-loop batch)
      if (cleanUrl === '/api/scraper/worker/start') {
        workerLogs.push(`[${new Date().toLocaleTimeString()}] Triggered serverless batch queue processor...`);
        // Execute one batch loop
        runAssetPipelineQueue()
          .then(() => {
            workerLogs.push(`[${new Date().toLocaleTimeString()}] Batch loop completed successfully! Check the "Scraped Catalogs" tab or audit logs.`);
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
          .then(() => {
            clearDbLogs.push(`[${new Date().toLocaleTimeString()}] Database and storage wiped successfully!`);
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

      // Backfiller (Text-parsing only, skipping Puppeteer previews to prevent timeouts)
      if (cleanUrl === '/api/scraper/backfill/start') {
        backfillLogs.push(`[${new Date().toLocaleTimeString()}] Starting database catalog parser backfill...`);
        executeBackfill('parse')
          .then(() => {
            backfillLogs.push(`[${new Date().toLocaleTimeString()}] Catalog parser backfill complete!`);
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
    res.status(404).json({ error: 'Endpoint not found or method not supported' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
