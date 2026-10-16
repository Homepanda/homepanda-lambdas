import assert from 'node:assert/strict';
import test from 'node:test';

function providerEnv(provider) {
  return JSON.stringify({
    provider,
    cookieKey: 'cookie-key',
    cookieValue: 'cookie-value',
    username: 'user',
    password: 'secret',
  });
}

test('record vuoto esce prima del login e dei webhook', async () => {
  process.env.PROVIDER_IMMOBILIARE_HP = providerEnv('HP');
  process.env.PROVIDER_IMMOBILIARE_FC = providerEnv('FC');
  process.env.PROVIDER_IMMOBILIARE_RLB = providerEnv('RLB');

  const { handler } = await import('../src/index.mjs');

  const result = await handler({ Records: [] });

  assert.deepEqual(result, {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  });
});
