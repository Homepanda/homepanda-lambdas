import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { LambdaClient, UpdateEventSourceMappingCommand } from '@aws-sdk/client-lambda';
import { Immobiliare, createHttpClient } from './immobiliare.mjs';
import { createDispatcher, dispatchRecords, isWorkQueueRecord } from './dispatcher.mjs';
import { createWorker } from './worker.mjs';
import { createThrottle } from './utils.mjs';

const sqs = new SQSClient({});
const sendMessageBatch = (input) => sqs.send(new SendMessageBatchCommand(input));

let dispatcher;
let worker;

export const handler = async (event, context) => {
  if (Array.isArray(event?.Records)) {
    if (isWorkQueueRecord(event.Records[0], requiredEnv('WORK_QUEUE_URL'))) {
      worker ??= buildWorker();
      return worker(event, context);
    }
    dispatcher ??= buildDispatcher();
    return dispatchRecords(event.Records, dispatcher);
  }
  dispatcher ??= buildDispatcher();
  return dispatcher(event);
};

function buildDispatcher() {
  return createDispatcher({
    sendMessageBatch,
    workQueueUrl: requiredEnv('WORK_QUEUE_URL'),
    delayDays: numberEnv('DELAY_DAYS', 2),
    maxProperties: numberEnv('MAX_PROPERTIES', 20000),
  });
}

function buildWorker() {
  const esmUuid = requiredEnv('ESM_UUID');
  const lambda = new LambdaClient({});  
  const throttle = createThrottle(numberEnv('REQUEST_DELAY_MS', 2000));

  return createWorker({
    sendMessageBatch,
    resultsQueueUrl: requiredEnv('QUEUE_URL'),
    disableTrigger: () => lambda.send(new UpdateEventSourceMappingCommand({ UUID: esmUuid, Enabled: false })),
    loadCredentials: async (company) => {
      const name = company === 'RLB' ? 'SECRET_RLB' : 'SECRET_HP';
      const credentials = JSON.parse(requiredEnv(name));
      if (!credentials.USERNAME || !credentials.PASSWORD) {
        throw new Error(`${name} must contain USERNAME and PASSWORD`);
      }
      return credentials;
    },
    createImmobiliare: async (credentials) => new Immobiliare(
      await createHttpClient({ cookieKey: credentials.COOKIE_KEY, cookieValue: credentials.COOKIE_VALUE }),
      { throttle },
    ),
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function numberEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative number, got "${raw}"`);
  }
  return value;
}
