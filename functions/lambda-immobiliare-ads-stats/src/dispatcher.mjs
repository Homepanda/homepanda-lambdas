import { addDays, chunk, isValidDate, romeToday } from './utils.mjs';

const PROPERTY_ID_PATTERN = /^\d+$/;

export function createDispatcher({ sendMessageBatch, workQueueUrl, delayDays, maxProperties, now = () => new Date() }) {
  return async function dispatch(event) {
    const detail = event?.detail ?? {};
    const { properties, invalid } = parseProperties(detail, maxProperties);
    const { start, end } = resolveDateRange(detail, delayDays, now());

    if (invalid.length > 0) {
      console.warn(`Skipping ${invalid.length} invalid entries: ${invalid.slice(0, 20).join(', ')}`);
    }
    if (properties.length === 0) {
      throw new Error('detail.PROPERTIES contains no valid entry');
    }
    console.info(`Dispatching ${properties.length} properties for ${start} -> ${end}`);

    let queued = 0;
    let failed = 0;
    for (const batch of chunk(properties, 10)) {
      try {
        const result = await sendMessageBatch({
          QueueUrl: workQueueUrl,
          Entries: batch.map(({ propertyId, adId }, index) => ({
            Id: String(index),
            MessageBody: JSON.stringify({ propertyId, adId, start, end }),
          })),
        });
        queued += result.Successful?.length ?? 0;
        failed += result.Failed?.length ?? 0;
      } catch (error) {
        console.error('Error sending work messages', error);
        failed += batch.length;
      }
    }

    const summary = `Queued ${queued} of ${properties.length} properties for ${start} -> ${end}`
      + ` (${failed} failed, ${invalid.length} invalid entries skipped)`;
    if (failed > 0) {
      throw new Error(summary);
    }
    console.info(summary);
    return summary;
  };
}

export function isWorkQueueRecord(record, workQueueUrl) {
  const queueName = String(workQueueUrl ?? '').split('/').pop();
  return queueName !== '' && String(record?.eventSourceARN ?? '').split(':').pop() === queueName;
}

export async function dispatchRecords(records, dispatch) {
  const batchItemFailures = [];
  for (const record of records) {
    try {
      await dispatch(JSON.parse(record.body));
    } catch (error) {
      console.error(`Dispatch message ${record.messageId} failed, returning it to the queue: ${error.message}`);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}

function parseProperties(detail, maxProperties) {
  if (detail.PROPERTY_IDS !== undefined) {
    throw new Error('detail.PROPERTY_IDS is no longer supported: use detail.PROPERTIES with { propertyId, adId } entries');
  }
  const value = detail.PROPERTIES;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('detail.PROPERTIES must be a non-empty array');
  }
  if (value.length > maxProperties) {
    throw new Error(`detail.PROPERTIES has ${value.length} entries, more than MAX_PROPERTIES (${maxProperties})`);
  }

  const properties = [];
  const invalid = [];
  const adIdByPropertyId = new Map();
  for (const entry of value) {
    const propertyId = String(entry?.propertyId ?? '').trim();
    const adId = Number(entry?.adId);
    if (!PROPERTY_ID_PATTERN.test(propertyId) || !Number.isInteger(adId) || adId <= 0) {
      invalid.push(JSON.stringify(entry));
      continue;
    }

    const known = adIdByPropertyId.get(propertyId);
    if (known !== undefined) {
      if (known !== adId) {
        console.warn(`Duplicate listing ${propertyId} with different adId: keeping ${known}, skipping ${adId}`);
      }
      continue;
    }
    adIdByPropertyId.set(propertyId, adId);
    properties.push({ propertyId, adId });
  }
  return { properties, invalid };
}

function resolveDateRange(detail, delayDays, now) {
  if (detail.START === undefined && detail.END === undefined) {
    const date = addDays(romeToday(now), -delayDays);
    return { start: date, end: date };
  }
  const start = detail.START ?? detail.END;
  const end = detail.END ?? detail.START;
  if (!isValidDate(start) || !isValidDate(end) || start > end) {
    throw new Error(`Invalid date range START=${detail.START} END=${detail.END} (expected YYYY-MM-DD, START <= END)`);
  }
  return { start, end };
}
