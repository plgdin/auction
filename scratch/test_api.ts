import fetch from 'node-fetch';

async function testApi() {
  const url = 'http://localhost:5175/api/scraper/status';
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url);
    console.log(`Response status: ${res.status}`);
    const data = await res.json();
    console.log("Response data keys:", Object.keys(data));
    console.log("Scraper running:", data.scraperRunning);
    console.log("Worker running:", data.workerRunning);
    console.log("Clear DB running:", data.clearDbRunning);
    console.log("Backfill running:", data.backfillRunning);
    console.log("Scraper logs count:", data.scraperLogs?.length);
    console.log("Worker logs count:", data.workerLogs?.length);
  } catch (error: any) {
    console.error("Fetch error:", error.message);
  }
}

testApi();
