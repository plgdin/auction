import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseLotBlocks } from '../scraper/parsers/lotParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const rawTextPath = path.join(__dirname, 'raw_text_15142.txt');
  if (!fs.existsSync(rawTextPath)) {
    console.error(`Raw text file not found at ${rawTextPath}`);
    return;
  }

  const rawText = fs.readFileSync(rawTextPath, 'utf8');
  console.log("Simulating parser on Allahabad/15142...");
  
  const parsedItems = parseLotBlocks(rawText, "End of life vehicles");
  console.log("PARSED LOTS:");
  console.log(JSON.stringify(parsedItems, null, 2));
}

main().catch(console.error);
