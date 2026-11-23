#!/usr/bin/env node
// Invoke the Lambda handler with the local Node runtime, no Docker or SAM.
//   ESAW_API_TOKEN=xxx node scripts/invoke-node.mjs [event.json]
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// behave like the Lambda runtime: cwd is the function root
const functionDir = fileURLToPath(new URL('..', import.meta.url));
process.chdir(functionDir);

const eventPath = path.resolve(process.argv[2] ?? 'event.json');
const event = JSON.parse(await readFile(eventPath, 'utf8'));
const { handler } = await import(path.join(functionDir, 'index.mjs'));

try {
  const result = await handler(event);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
