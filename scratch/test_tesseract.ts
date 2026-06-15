import Tesseract from 'tesseract.js';


async function test() {
  console.log('Tesseract loaded successfully');
  // We don't have a local image yet, but let's just test that the import and createWorker works.
  const worker = await Tesseract.createWorker('eng');
  console.log('Worker created successfully');
  await worker.terminate();
  console.log('Worker terminated successfully');
}

test().catch(console.error);
