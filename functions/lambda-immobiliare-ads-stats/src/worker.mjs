import { toDailyRecords } from './immobiliare.mjs';
import { chunk, isValidDate } from './utils.mjs';

const FATAL_KINDS = new Set(['blocked', 'login', 'session', 'overloaded']);
const MAX_CONSECUTIVE_ERRORS = 3;
const MAX_CONSECUTIVE_NOT_ACCESSIBLE = 5;
const MIN_REMAINING_MS = 90000;
const CIRCUIT_COOLDOWN_MS = 10 * 60 * 1000;

export function createWorker({
  sendMessageBatch,
  disableTrigger,
  resultsQueueUrl,
  loadCredentials,
  createImmobiliare,
  now = () => new Date(),
}) {
  let credentials;
  let immobiliare;
  let circuitOpenedAt;

  async function getSession() {
    credentials ??= await loadCredentials();
    if (!immobiliare) {
      const client = await createImmobiliare(credentials);
      console.info('Logging in to Immobiliare');
      await client.login(credentials.USERNAME, credentials.PASSWORD);
      immobiliare = client;
    }
    return immobiliare;
  }

  async function fetchStats({ propertyId, start, end }) {
    const session = await getSession();
    try {
      return await session.getPropertyStats(propertyId, start, end);
    } catch (error) {
      if (error.kind !== 'session') {
        throw error;
      }
      console.warn(`${error.message}, logging in again`);
      immobiliare = undefined;
      return (await getSession()).getPropertyStats(propertyId, start, end);
    }
  }

  async function sendResults(records) {
    for (const entries of chunk(records, 10)) {
      const result = await sendMessageBatch({
        QueueUrl: resultsQueueUrl,
        Entries: entries.map((record, index) => ({ Id: String(index), MessageBody: JSON.stringify(record) })),
      });
      if (result.Failed?.length > 0) {
        throw new Error(`${result.Failed.length} result messages not sent: ${result.Failed.map((f) => f.Code).join(', ')}`);
      }
    }
  }

  async function openCircuit(reason) {
    circuitOpenedAt = now().getTime();
    immobiliare = undefined;
    console.error(`CIRCUIT_OPEN ${reason}`);
    try {
      await disableTrigger();
      console.error('CIRCUIT_OPEN SQS trigger disabled, re-enable it manually after checking the cause');
    } catch (error) {
      console.error(`CIRCUIT_OPEN could not disable the SQS trigger: ${error.message}`);
    }
  }

  return async function work(event, context) {
    const records = event.Records;
    const batchItemFailures = [];
    const failFrom = (index) => {
      batchItemFailures.push(...records.slice(index).map((record) => ({ itemIdentifier: record.messageId })));
    };

    if (circuitOpenedAt !== undefined && now().getTime() - circuitOpenedAt < CIRCUIT_COOLDOWN_MS) {
      console.error(`CIRCUIT_OPEN cooling down, returning ${records.length} messages to the queue`);
      failFrom(0);
      return { batchItemFailures };
    }

    let processed = 0;
    let notFound = 0;
    let notAccessible = 0;
    let consecutiveErrors = 0;
    let consecutiveNotAccessible = 0;
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (context.getRemainingTimeInMillis() < MIN_REMAINING_MS) {
        console.warn(`Low remaining time, returning ${records.length - index} messages to the queue`);
        failFrom(index);
        break;
      }

      const message = parseWorkMessage(record.body);
      if (!message) {
        console.error(`Invalid work message ${record.messageId}: ${record.body}`);
        batchItemFailures.push({ itemIdentifier: record.messageId });
        continue;
      }

      try {
        const data = await fetchStats(message);
        await sendResults(toDailyRecords(message.propertyId, message.adId, data, message.start, message.end, now().toISOString()));
        processed++;
        consecutiveErrors = 0;
        consecutiveNotAccessible = 0;
      } catch (error) {
        if (error.kind === 'not_found') {
          console.warn(`${error.message}, skipping`);
          notFound++;
          consecutiveErrors = 0;
          continue;
        }
        if (error.kind === 'not_accessible') {
          console.error(`NOT_ACCESSIBLE ${error.message}`);
          notAccessible++;
          consecutiveNotAccessible++;
          consecutiveErrors = 0;
          if (consecutiveNotAccessible >= MAX_CONSECUTIVE_NOT_ACCESSIBLE) {
            await openCircuit(`${consecutiveNotAccessible} consecutive 403 without DataDome signature: possible block`);
            // Il messaggio corrente torna in coda: se era un blocco, l'annuncio non va perso
            failFrom(index);
            break;
          }
          continue;
        }
        console.error(`Property ${message.propertyId} failed: ${error.message}`);
        batchItemFailures.push({ itemIdentifier: record.messageId });
        consecutiveErrors++;
        if (FATAL_KINDS.has(error.kind) || consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          await openCircuit(FATAL_KINDS.has(error.kind) ? error.message : `${consecutiveErrors} consecutive errors`);
          failFrom(index + 1);
          break;
        }
      }
    }

    console.info(`Batch done: ${processed} processed, ${notFound} not found, ${notAccessible} not accessible,`
      + ` ${batchItemFailures.length} returned to the queue`);
    return { batchItemFailures };
  };
}

function parseWorkMessage(body) {
  try {
    const { propertyId, adId, start, end } = JSON.parse(body);
    const ad = Number(adId);
    if (propertyId && Number.isInteger(ad) && ad > 0 && isValidDate(start) && isValidDate(end) && start <= end) {
      return { propertyId: String(propertyId), adId: ad, start, end };
    }
  } catch {
  }
  return undefined;
}
