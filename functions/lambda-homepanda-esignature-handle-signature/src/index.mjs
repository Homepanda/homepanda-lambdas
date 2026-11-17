import { loadConfig } from './helpers/config.mjs';
import { StepError } from './helpers/errors.mjs';
import { downloadFile, fetchEnvelope, fetchEnvelopeFiles } from './services/esaw.mjs';
import { postFailureWebhook, postSuccessWebhook } from './services/webhook.mjs';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUCCESS_STATUSES = new Set(['Completed', 'CompletedWithWarnings']);
const FAILED_STATUSES = new Set(['Rejected', 'Canceled', 'Expired']);
const PENDING_STATUSES = new Set(['ActionRequired', 'WaitingForOthers', 'ExpiringSoon', 'Active', 'InProgress', 'Started']);

const isGuid = (value) => GUID_RE.test(String(value ?? ''));

const validateGuid = (value, field) => {
  if (!isGuid(value)) throw new StepError(`Invalid ${field}`, { [field]: value });
  return String(value);
};

const response = (data) => ({
  statusCode: 200,
  body: JSON.stringify(data),
});

const pickMainDocument = (files) => {
  const documents = files?.Documents ?? [];
  const document = documents.find((item) => item?.DocumentNumber === 1) ?? documents[0];
  if (!document) throw new StepError('No downloadable documents found for envelope');
  if (!document.FileId) throw new StepError('Missing FileId for completed document');
  return document;
};

export const handler = async (event) => {
  const { envelope, action, workflow } = event ?? {};
  const cfg = loadConfig();
  const canNotifyFailure = isGuid(workflow);
  let step = 'validate';
  let envelopeStatus;
  let failureReported = false;

  try {
    if (!action) throw new StepError('Missing action');
    if (action !== 'envelopeFinished') return response({ status: 'IGNORED', reason: 'Ignored unsupported action', action });
    if (!envelope) throw new StepError('Missing envelope');
    if (!workflow) throw new StepError('Missing workflow');
    if (!cfg.apiToken) throw new StepError('Missing ESAW_API_TOKEN configuration');

    validateGuid(envelope, 'envelope');
    validateGuid(workflow, 'workflow');

    step = 'fetch_envelope';
    const details = await fetchEnvelope(cfg, envelope);
    envelopeStatus = details?.EnvelopeStatus;
    if (!envelopeStatus) throw new StepError('EnvelopeStatus missing from eSAW response');

    if (PENDING_STATUSES.has(envelopeStatus)) {
      return response({
        status: 'IGNORED',
        reason: 'Envelope not completed yet',
        envelopeId: envelope,
        envelopeStatus,
      });
    }

    if (FAILED_STATUSES.has(envelopeStatus)) {
      const error = `Envelope ended in terminal failed status: ${envelopeStatus}`;
      step = 'notify_failure';
      await postFailureWebhook(cfg, workflow, {
        status: 'FAILED',
        error,
        step: 'fetch_envelope',
        envelopeId: envelope,
        envelopeStatus,
        action,
      });
      failureReported = true;
      throw new StepError(error, { envelopeId: envelope, envelopeStatus, action });
    }

    if (!SUCCESS_STATUSES.has(envelopeStatus)) {
      throw new StepError(`Unsupported envelope status: ${envelopeStatus}`, {
        envelopeId: envelope,
        envelopeStatus,
        action,
      });
    }

    step = 'fetch_files';
    const files = await fetchEnvelopeFiles(cfg, envelope);
    const document = pickMainDocument(files);

    step = 'download';
    const pdf = await downloadFile(cfg, document.FileId);

    step = 'notify_success';
    await postSuccessWebhook(cfg, workflow, pdf, document.FileName || 'document.pdf');

    return response({
      status: 'SUCCESS',
      envelopeId: envelope,
      envelopeStatus,
      workflow,
      fileId: document.FileId,
    });
  } catch (err) {
    console.error(`Step ${step} failed`, err);
    if (step === 'notify_success' || failureReported || !canNotifyFailure) throw err;
    try {
      await postFailureWebhook(cfg, workflow, {
        status: 'FAILED',
        error: err.message,
        step,
        envelopeId: envelope,
        envelopeStatus,
        action,
        ...(err.extra ?? {}),
      });
    } catch (webhookErr) {
      console.error('Failed to notify Homepanda of failure', webhookErr);
    }
    throw err;
  }
};
