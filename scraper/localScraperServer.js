import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 3001;
const LOGS_FILE = path.join(process.cwd(), 'scraper_logs.json');

// Initialize logs file if not exists
if (!fs.existsSync(LOGS_FILE)) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify([]));
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/start-scraper') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'started' }));

    console.log('Starting scraper process...');
    
    // Add an initial log
    const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    logs.push({ timestamp: new Date().toISOString(), message: 'Scraper started automatically via UI.' });
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));

    const scraper = spawn('npx', ['tsx', 'scraper/marketScraper.ts'], { cwd: process.cwd(), shell: true });

    scraper.stdout.on('data', (data) => {
      console.log(`Scraper output: ${data}`);
    });

    scraper.stderr.on('data', (data) => {
      console.error(`Scraper error: ${data}`);
    });

    scraper.on('close', (code) => {
      console.log(`Scraper exited with code ${code}`);
      const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
      logs.push({ timestamp: new Date().toISOString(), message: `Scraper finished with code ${code}` });
      fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
    });

  } else if (req.method === 'GET' && req.url === '/api/scraper-logs') {
    const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(logs));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Local scraper bridge running on http://localhost:${PORT}`);
});
