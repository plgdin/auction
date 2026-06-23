import fs from 'fs';
import path from 'path';

const logPath = 'C:/Users/Lenovo/.gemini/antigravity-ide/brain/109365db-5e86-4a0f-bbf3-33f18279df96/.system_generated/logs/transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.error("Transcript file not found");
  process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

console.log(`Found ${lines.length} lines in transcript.`);
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'RUN_COMMAND' || (obj.tool_calls && obj.tool_calls.some(t => t.name === 'run_command'))) {
      console.log(`Step ${obj.step_index}: Source: ${obj.source}`);
      if (obj.tool_calls) {
        console.log(`  Tool Calls:`, JSON.stringify(obj.tool_calls, null, 2));
      }
      if (obj.content) {
        console.log(`  Content:`, obj.content.substring(0, 300));
      }
      console.log('--------------------------------------------------');
    }
  } catch (e) {
    // Ignore invalid JSON lines
  }
}
