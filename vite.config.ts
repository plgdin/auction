import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { spawn } from 'child_process'

let scraperProcess = null;
let workerProcess = null;
let scraperLogs = [];
let workerLogs = [];

const appendLog = (type, data) => {
  const lines = data.toString().split('\n');
  const target = type === 'scraper' ? scraperLogs : workerLogs;
  lines.forEach(line => {
    if (line.trim()) {
      target.push(`[${new Date().toLocaleTimeString()}] ${line.replace(/\r/g, '')}`);
      if (target.length > 500) target.shift();
    }
  });
};

const localApiPlugin = () => ({
  name: 'local-api-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api/scraper/')) {
        res.setHeader('Content-Type', 'application/json');
        
        if (req.url === '/api/scraper/status') {
          res.end(JSON.stringify({
            scraperRunning: scraperProcess !== null,
            workerRunning: workerProcess !== null,
            scraperLogs,
            workerLogs
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
            appendLog('scraper', 'Starting Scraper (npx tsx scraper.ts)...');
            scraperProcess = spawn('npx', ['tsx', 'scraper.ts'], { shell: true });
            
            scraperProcess.stdout.on('data', (data) => appendLog('scraper', data));
            scraperProcess.stderr.on('data', (data) => appendLog('scraper', data));
            scraperProcess.on('close', (code) => {
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
            appendLog('worker', 'Starting Asset Worker (npx tsx assetWorker.ts)...');
            workerProcess = spawn('npx', ['tsx', 'assetWorker.ts'], { shell: true });
            
            workerProcess.stdout.on('data', (data) => appendLog('worker', data));
            workerProcess.stderr.on('data', (data) => appendLog('worker', data));
            workerProcess.on('close', (code) => {
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
})
