import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('source contiene il branch di errore per azione non definita', async () => {
  const source = await readFile(new URL('../src/index.mjs', import.meta.url), 'utf8');

  assert.equal(source.includes("throw new Error('Undefined Action')"), true);
});
