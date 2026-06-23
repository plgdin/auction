import fs from 'fs';
import path from 'path';

const filePath = 'e:/STARTUP WEBSITES/auction/auction/src/utils/mstcHelpers.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('cleanMaterialDescription')) {
    console.log(`Line ${i+1}: ${lines[i]}`);
  }
}
