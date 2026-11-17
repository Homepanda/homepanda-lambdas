import path from 'node:path';
import { loadConfig } from './helpers/config.mjs';
import { StepError } from './helpers/errors.mjs';
import { buildActivities } from './helpers/activities.mjs';
import { buildCallbackUrl } from './helpers/callback.mjs';
import { loadDocument } from './services/documents.mjs';
import { uploadFile, prepareSignatures, sendEnvelope } from './services/esaw.mjs';
import { postWebhook } from './services/webhook.mjs';

export const handler = async (event) => {
  const { payload = {}, webhook_callback: webhookCallback } = event ?? {};
  const cfg = loadConfig();
  let step = 'validate';
  let envelopeId;

  try {
    if (!webhookCallback) throw new StepError('Missing webhook_callback');
    if (!payload.document) throw new StepError('Missing payload.document');
    if (!Array.isArray(payload.phases) || !payload.phases.length) throw new StepError('Missing payload.phases');
    const people = payload.phases.flatMap((phase, phaseIndex) =>
      [...(phase.recipients ?? []), ...(phase.signers ?? [])].map((person) => ({
        ...person,
        signingGroup: `phase-${phaseIndex + 1}`,
      })),
    );
    if (!people.length) throw new StepError('No recipients or signers provided in payload.phases');
    if (!cfg.apiToken) throw new StepError('Missing ESAW_API_TOKEN configuration');

    const callbackUrl = cfg.callbackUrl ? buildCallbackUrl(cfg.callbackUrl, webhookCallback) : undefined;

    step = 'load_document';
    const buffer = await loadDocument(payload.document, cfg);

    step = 'upload';
    const fileId = await uploadFile(cfg, buffer, path.basename(payload.document));
    console.log('Uploaded document', { fileId });

    step = 'prepare';
    const signatures = await prepareSignatures(cfg, fileId);

    step = 'build';
    const activities = buildActivities(people, signatures, cfg);

    step = 'send';
    envelopeId = await sendEnvelope(cfg, {
      Documents: [{ FileId: fileId, DocumentNumber: 1 }],
      Name: `Firma documento - Immobile #${payload.property?.property_id ?? ''}`.slice(0, 100),
      Activities: activities,
      ...(callbackUrl ? { CallbackConfiguration: { CallbackUrl: callbackUrl } } : {}),
    });
    console.log('Envelope sent', { envelopeId });

    step = 'webhook';
    const result = { status: 'SUCCESS', EnvelopeId: envelopeId };
    await postWebhook(webhookCallback, result);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error(`Step ${step} failed`, err);
    if (step === 'webhook') {
      err.envelopeId = envelopeId;
      throw err;
    }
    if (webhookCallback) {
      try {
        await postWebhook(webhookCallback, { status: 'FAILED', error: err.message, step, ...err.extra });
      } catch (webhookErr) {
        console.error('Failed to notify webhook of failure', webhookErr);
      }
    }
    throw err;
  }
};
