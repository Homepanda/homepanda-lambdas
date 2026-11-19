import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorker } from '../src/worker.mjs';

function kindError(kind, message) {
  const error = new Error(message);
  error.kind = kind;
  return error;
}

function workRecord({ messageId, company, propertyId = '1' }) {
  return {
    messageId,
    body: JSON.stringify({
      propertyId,
      adId: 9,
      start: '2026-11-17',
      end: '2026-11-17',
      company,
    }),
  };
}

function context() {
  return { getRemainingTimeInMillis: () => 300000 };
}

function createClient(logins, stats) {
  return {
    login: async (username) => {
      logins.push(username);
    },
    getPropertyStats: async (propertyId) => stats(propertyId),
  };
}

test('un messaggio senza company valida torna in coda', async () => {
  const work = createWorker({
    sendMessageBatch: async () => ({ Successful: [{}], Failed: [] }),
    disableTrigger: async () => {},
    resultsQueueUrl: 'https://example/results',
    loadCredentials: async () => ({ USERNAME: 'u', PASSWORD: 'p' }),
    createImmobiliare: async () => createClient([], () => ({})),
  });

  const result = await work({
    Records: [{
      messageId: 'bad',
      body: JSON.stringify({
        propertyId: '1',
        adId: 9,
        start: '2026-11-17',
        end: '2026-11-17',
      }),
    }],
  }, context());

  assert.deepEqual(result.batchItemFailures, [{ itemIdentifier: 'bad' }]);
});

test('HP e RLB fanno login distinti nello stesso worker', async () => {
  const logins = [];
  const loaded = [];
  const work = createWorker({
    sendMessageBatch: async (input) => {
      assert.equal(input.Entries.length, 1);
      return { Successful: input.Entries, Failed: [] };
    },
    disableTrigger: async () => {},
    resultsQueueUrl: 'https://example/results',
    loadCredentials: async (company) => {
      loaded.push(company);
      return { USERNAME: company, PASSWORD: 'p' };
    },
    createImmobiliare: async (credentials) => createClient(logins, () => ({})),
  });

  const result = await work({
    Records: [
      workRecord({ messageId: 'hp', company: 'HP', propertyId: '10' }),
      workRecord({ messageId: 'rlb', company: 'RLB', propertyId: '20' }),
    ],
  }, context());

  assert.deepEqual(result.batchItemFailures, []);
  assert.deepEqual(loaded, ['HP', 'RLB']);
  assert.deepEqual(logins, ['HP', 'RLB']);
});

test('un login RLB fallito lascia processare HP', async () => {
  const processed = [];
  let disabled = false;
  const work = createWorker({
    sendMessageBatch: async (input) => {
      processed.push(JSON.parse(input.Entries[0].MessageBody).propertyId);
      return { Successful: input.Entries, Failed: [] };
    },
    disableTrigger: async () => {
      disabled = true;
    },
    resultsQueueUrl: 'https://example/results',
    loadCredentials: async (company) => ({ USERNAME: company, PASSWORD: 'p' }),
    createImmobiliare: async (credentials) => ({
      login: async () => {
        if (credentials.USERNAME === 'RLB') {
          throw kindError('login', 'Invalid credentials');
        }
      },
      getPropertyStats: async () => ({}),
    }),
  });

  const result = await work({
    Records: [
      workRecord({ messageId: 'rlb', company: 'RLB', propertyId: '20' }),
      workRecord({ messageId: 'hp', company: 'HP', propertyId: '10' }),
    ],
  }, context());

  assert.equal(disabled, false);
  assert.deepEqual(processed, ['10']);
  assert.deepEqual(result.batchItemFailures, [{ itemIdentifier: 'rlb' }]);
});

test('un blocco DataDome apre il circuito globale', async () => {
  let disabled = false;
  const work = createWorker({
    sendMessageBatch: async () => ({ Successful: [{}], Failed: [] }),
    disableTrigger: async () => {
      disabled = true;
    },
    resultsQueueUrl: 'https://example/results',
    loadCredentials: async (company) => ({ USERNAME: company, PASSWORD: 'p' }),
    createImmobiliare: async () => ({
      login: async () => {},
      getPropertyStats: async () => {
        throw kindError('blocked', 'blocked by DataDome');
      },
    }),
  });

  const result = await work({
    Records: [
      workRecord({ messageId: 'hp', company: 'HP' }),
      workRecord({ messageId: 'rlb', company: 'RLB' }),
    ],
  }, context());

  assert.equal(disabled, true);
  assert.deepEqual(result.batchItemFailures, [
    { itemIdentifier: 'hp' },
    { itemIdentifier: 'rlb' },
  ]);
});
