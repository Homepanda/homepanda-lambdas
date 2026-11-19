import assert from 'node:assert/strict';
import test from 'node:test';
import { createDispatcher, dispatchRecords, isWorkQueueRecord } from '../src/dispatcher.mjs';

const WORK_QUEUE_URL = 'https://sqs.eu-central-1.amazonaws.com/247981707334/immobiliare-stats-work';
const HP_ARN = 'arn:aws:sqs:eu-central-1:247981707334:immobiliare-stats-dispatch';
const RLB_ARN = 'arn:aws:sqs:eu-central-1:247981707334:immobiliare-stats-dispatch-rlb';

function propertyEvent(eventSourceARN) {
  return {
    eventSourceARN,
    detail: {
      PROPERTIES: [{ propertyId: '123', adId: 9 }],
      START: '2026-11-17',
      END: '2026-11-17',
    },
  };
}

test('un record della coda di dispatch non è un record di work', () => {
  assert.equal(isWorkQueueRecord({ eventSourceARN: HP_ARN }, WORK_QUEUE_URL), false);
});

test('un record della coda rlb non è un record di work', () => {
  assert.equal(isWorkQueueRecord({ eventSourceARN: RLB_ARN }, WORK_QUEUE_URL), false);
});

test('dispatch dalla coda HP scrive company HP nel messaggio di work', async () => {
  const sent = [];
  const dispatch = createDispatcher({
    sendMessageBatch: async (input) => {
      sent.push(input);
      return { Successful: input.Entries, Failed: [] };
    },
    workQueueUrl: WORK_QUEUE_URL,
    delayDays: 2,
    maxProperties: 20000,
  });

  await dispatch(propertyEvent(HP_ARN));

  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(sent[0].Entries[0].MessageBody), {
    propertyId: '123',
    adId: 9,
    start: '2026-11-17',
    end: '2026-11-17',
    company: 'HP',
  });
});

test('dispatch dalla coda rlb scrive company RLB nel messaggio di work', async () => {
  const sent = [];
  const dispatch = createDispatcher({
    sendMessageBatch: async (input) => {
      sent.push(input);
      return { Successful: input.Entries, Failed: [] };
    },
    workQueueUrl: WORK_QUEUE_URL,
    delayDays: 2,
    maxProperties: 20000,
  });

  await dispatch(propertyEvent(RLB_ARN));

  assert.equal(JSON.parse(sent[0].Entries[0].MessageBody).company, 'RLB');
});

test('dispatchRecords passa l ARN della coda al dispatcher', async () => {
  const arns = [];
  await dispatchRecords(
    [{
      messageId: '1',
      eventSourceARN: RLB_ARN,
      body: JSON.stringify({
        detail: {
          PROPERTIES: [{ propertyId: '123', adId: 9 }],
          START: '2026-11-17',
          END: '2026-11-17',
        },
      }),
    }],
    async (event) => {
      arns.push(event.eventSourceARN);
    },
  );

  assert.deepEqual(arns, [RLB_ARN]);
});
