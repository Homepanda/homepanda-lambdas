import assert from 'node:assert/strict';
import test from 'node:test';

test('azione non definita solleva errore senza chiamate esterne', async () => {
  process.env.IMMOBILIARE_AUTHORIZATION = 'user:pass';
  process.env.HOMEPANDA_PROPERTY_SERVICE_URL = 'http://127.0.0.1:9';

  const { handler } = await import('../src/index.mjs');

  await assert.rejects(
    () => handler({
      Records: [{
        body: JSON.stringify({ action: 'NOPE', payload: {} }),
      }],
    }),
    /Undefined Action/,
  );
});
