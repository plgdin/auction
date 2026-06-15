import { runAssetPipelineQueue } from '../scraper/assetWorker.js';

async function run() {
  console.log('Starting single run of asset pipeline queue...');
  await runAssetPipelineQueue();
  console.log('Single run complete. Exiting.');
}

run().catch(console.error);
