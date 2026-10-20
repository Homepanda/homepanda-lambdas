import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('rotta assente sotto /bitrix non è dichiarata nel sorgente', async () => {
  const source = await readFile(new URL('../src/index.mjs', import.meta.url), 'utf8');

  assert.equal(source.includes("basePath('/bitrix')"), true);
  assert.equal(source.includes("app.get('/missing'"), false);
});
