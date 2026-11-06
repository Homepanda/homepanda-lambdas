import assert from 'node:assert/strict';
import test from 'node:test';
import { handler } from '../src/index.mjs';

test('il blueprint risponde 200 senza chiamate esterne', async () => {
  const response = await handler({});

  assert.deepEqual(response, {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  });
});
