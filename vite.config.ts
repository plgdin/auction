import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { spawn } from 'child_process'

let scraperProcess: any = null;
let workerProcess: any = null;
let clearDbProcess: any = null;
let backfillProcess: any = null;

let scraperLogs: string[] = [];
let workerLogs: string[] = [];
let clearDbLogs: string[] = [];
let backfillLogs: string[] = [];

const appendLog = (type: string, data: any) => {
  const lines = data.toString().split('\n');
  let target;
  if (type === 'scraper') target = scraperLogs;
  else if (type === 'worker') target = workerLogs;
  else if (type === 'clear-db') target = clearDbLogs;
  else if (type === 'backfill') target = backfillLogs;
  else return;

  lines.forEach((line: string) => {
    if (line.trim()) {
      target.push(`[${new Date().toLocaleTimeString()}] ${line.replace(/\r/g, '')}`);
      if (target.length > 500) target.shift();
    }
  });
};

const localApiPlugin = () => ({
  name: 'local-api-plugin',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      // Route serverless API endpoints in local dev server
      if (req.url) {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname;

        if (
          pathname === '/api/users' || 
          pathname === '/api/pdf' || 
          pathname === '/api/scraper/reset-failed' || 
          pathname === '/api/scraper/reset-single' ||
          pathname === '/api/scraper/unlock-processing'
        ) {
          // Add Vercel response helper methods
          res.status = (code: number) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
          };
          res.send = (data: any) => {
            res.end(data);
            return res;
          };

          if (pathname === '/api/users') {
            import('./api/users.ts').then((m) => m.default(req, res)).catch(next);
            return;
          } else if (pathname === '/api/pdf') {
            import('./api/pdf.ts').then((m) => m.default(req, res)).catch(next);
            return;
          } else if (
            pathname === '/api/scraper/reset-failed' || 
            pathname === '/api/scraper/reset-single' ||
            pathname === '/api/scraper/unlock-processing'
          ) {
            import('./api/scraper.ts').then((m) => m.default(req, res)).catch(next);
            return;
          }
        }
      }

      if (req.url && req.url.startsWith('/api/scraper/')) {
        res.setHeader('Content-Type', 'application/json');
        
        if (req.url === '/api/scraper/status') {
          res.end(JSON.stringify({
            scraperRunning: scraperProcess !== null,
            workerRunning: workerProcess !== null,
            clearDbRunning: clearDbProcess !== null,
            backfillRunning: backfillProcess !== null,
            scraperLogs,
            workerLogs,
            clearDbLogs,
            backfillLogs
          }));
          return;
        }
        
        if (req.method === 'POST') {
          if (req.url === '/api/scraper/start') {
            if (scraperProcess) {
              res.end(JSON.stringify({ success: false, message: 'Scraper already running' }));
              return;
            }
            scraperLogs = [];
            appendLog('scraper', 'Starting Scraper (npx tsx scraper/scraper.ts)...');
            scraperProcess = spawn('npx', ['tsx', 'scraper/scraper.ts'], { shell: true });
            
            scraperProcess.stdout.on('data', (data: any) => appendLog('scraper', data));
            scraperProcess.stderr.on('data', (data: any) => appendLog('scraper', data));
            scraperProcess.on('close', (code: any) => {
              appendLog('scraper', `Scraper process terminated with exit code ${code}`);
              scraperProcess = null;
            });
            
            res.end(JSON.stringify({ success: true }));
            return;
          }
          
          if (req.url === '/api/scraper/stop') {
            if (scraperProcess) {
              scraperProcess.kill('SIGINT');
              scraperProcess = null;
              appendLog('scraper', 'Scraper process stopped by user request.');
            }
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (req.url === '/api/scraper/input') {
            if (scraperProcess && scraperProcess.stdin) {
              scraperProcess.stdin.write('\n');
              appendLog('scraper', 'Sent [Enter] keypress to process stdin');
              res.end(JSON.stringify({ success: true }));
            } else {
              res.end(JSON.stringify({ success: false, message: 'Scraper not running or stdin not available' }));
            }
            return;
          }
          
          if (req.url === '/api/scraper/worker/start') {
            if (workerProcess) {
              res.end(JSON.stringify({ success: false, message: 'Worker already running' }));
              return;
            }
            workerLogs = [];
            appendLog('worker', 'Starting Asset Worker (npx tsx scraper/assetWorker.ts)...');
            workerProcess = spawn('npx', ['tsx', 'scraper/assetWorker.ts'], { shell: true });
            
            workerProcess.stdout.on('data', (data: any) => appendLog('worker', data));
            workerProcess.stderr.on('data', (data: any) => appendLog('worker', data));
            workerProcess.on('close', (code: any) => {
              appendLog('worker', `Worker process terminated with exit code ${code}`);
              workerProcess = null;
            });
            
            res.end(JSON.stringify({ success: true }));
            return;
          }
          
          if (req.url === '/api/scraper/worker/stop') {
            if (workerProcess) {
              workerProcess.kill('SIGINT');
              workerProcess = null;
              appendLog('worker', 'Worker process stopped by user request.');
            }
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (req.url === '/api/scraper/clear-db/start') {
            if (clearDbProcess) {
              res.end(JSON.stringify({ success: false, message: 'Clear DB already running' }));
              return;
            }
            clearDbLogs = [];
            appendLog('clear-db', 'Starting Database & Storage Clear (npx tsx scratch/clear_db.ts)...');
            clearDbProcess = spawn('npx', ['tsx', 'scratch/clear_db.ts'], { shell: true });
            
            clearDbProcess.stdout.on('data', (data: any) => appendLog('clear-db', data));
            clearDbProcess.stderr.on('data', (data: any) => appendLog('clear-db', data));
            clearDbProcess.on('close', (code: any) => {
              appendLog('clear-db', `Clear DB process terminated with exit code ${code}`);
              clearDbProcess = null;
            });
            
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (req.url === '/api/scraper/clear-db/stop') {
            if (clearDbProcess) {
              clearDbProcess.kill('SIGINT');
              clearDbProcess = null;
              appendLog('clear-db', 'Clear DB process stopped by user.');
            }
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (req.url === '/api/scraper/backfill/start') {
            if (backfillProcess) {
              res.end(JSON.stringify({ success: false, message: 'Backfill already running' }));
              return;
            }
            backfillLogs = [];
            appendLog('backfill', 'Starting Batch Backfill (npx tsx scratch/backfill.ts)...');
            backfillProcess = spawn('npx', ['tsx', 'scratch/backfill.ts'], { shell: true });
            
            backfillProcess.stdout.on('data', (data: any) => appendLog('backfill', data));
            backfillProcess.stderr.on('data', (data: any) => appendLog('backfill', data));
            backfillProcess.on('close', (code: any) => {
              appendLog('backfill', `Backfill process terminated with exit code ${code}`);
              backfillProcess = null;
            });
            
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (req.url === '/api/scraper/backfill/stop') {
            if (backfillProcess) {
              backfillProcess.kill('SIGINT');
              backfillProcess = null;
              appendLog('backfill', 'Backfill process stopped by user.');
            }
            res.end(JSON.stringify({ success: true }));
            return;
          }
        }
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), localApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@xenova') || id.includes('onnxruntime')) {
              return 'transformers';
            }
            if (id.includes('antd') || id.includes('@ant-design')) {
              return 'antd-vendor';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'recharts-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
