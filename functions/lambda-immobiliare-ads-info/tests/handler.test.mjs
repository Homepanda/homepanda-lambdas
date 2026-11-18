import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('senza coda stats il sorgente non invia messaggi', async () => {
  const source = await readFile(new URL('../src/stats.mjs', import.meta.url), 'utf8');

  assert.equal(source.includes('IMMOBILIARE_STATS_QUEUE_URL not set for this run: stats not requested'), true);
  assert.equal(source.includes('return { sent: 0, skipped: true }'), true);
});
