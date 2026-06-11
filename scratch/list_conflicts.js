import * as fs from 'fs';

const content = fs.readFileSync('src/pages/Auctions.tsx', 'utf8');
const lines = content.split(/\r?\n/);

let inConflict = false;
let crossedDivider = false;
let headLines = [];
let theirsLines = [];
let startLineNum = 0;
let output = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('<<<<<<<')) {
    inConflict = true;
    crossedDivider = false;
    startLineNum = i + 1;
    headLines = [];
    theirsLines = [];
  } else if (line.startsWith('=======')) {
    crossedDivider = true;
  } else if (line.startsWith('>>>>>>>')) {
    inConflict = false;
    output += `\n### CONFLICT @ line ${startLineNum}\n`;
    output += '#### HEAD\n```typescript\n' + headLines.join('\n') + '\n```\n';
    output += '#### THEIRS\n```typescript\n' + theirsLines.join('\n') + '\n```\n';
    output += '\n-------------------\n';
  } else {
    if (inConflict) {
      if (!crossedDivider) {
        headLines.push(line);
      } else {
        theirsLines.push(line);
      }
    }
  }
}

fs.writeFileSync('scratch_conflicts.md', output, 'utf8');
console.log('Saved to scratch_conflicts.md');
