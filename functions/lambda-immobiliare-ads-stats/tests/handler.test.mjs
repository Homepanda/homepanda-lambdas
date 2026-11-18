import assert from 'node:assert/strict';
import test from 'node:test';
import { isWorkQueueRecord } from '../src/dispatcher.mjs';

test('un record della coda di dispatch non è un record di work', () => {
  const record = {
    eventSourceARN: 'arn:aws:sqs:eu-central-1:247981707334:immobiliare-stats-dispatch',
  };

  assert.equal(
    isWorkQueueRecord(record, 'https://sqs.eu-central-1.amazonaws.com/247981707334/immobiliare-stats-work'),
    false,
  );
});
