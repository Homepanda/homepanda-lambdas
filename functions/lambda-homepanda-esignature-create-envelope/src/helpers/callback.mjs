import { StepError } from './errors.mjs';

// workflow id is the uuid right before the trailing step number, e.g.
// https://host/api/v1/webhook/workflow/<uuid>/1
const WORKFLOW_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/\d+\/?$/i;

export const extractWorkflowId = (webhookCallback) =>
  String(webhookCallback ?? '').match(WORKFLOW_RE)?.[1];

export const buildCallbackUrl = (baseUrl, webhookCallback) => {
  if (!baseUrl) throw new StepError('Missing ESAW_CALLBACK_URL configuration');
  const workflowId = extractWorkflowId(webhookCallback);
  if (!workflowId) throw new StepError('Could not extract workflow id from webhook_callback');
  const base = (/^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`).replace(/\/+$/, '');
  return `${base}?envelope=##EnvelopeId##&action=##Action##&workflow=${workflowId}`;
};
