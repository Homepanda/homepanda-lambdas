#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
