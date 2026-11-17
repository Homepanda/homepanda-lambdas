import { StepError } from '../helpers/errors.mjs';

const esaw = async (cfg, route, body) => {
  const isForm = body instanceof FormData;
  const res = await fetch(`${cfg.baseUrl}/v6/${route}`, {
    method: 'POST',
    headers: { 
      Authorization: `ApiToken ${cfg.apiToken}`,
      apiToken: cfg.apiToken,
      ...(!isForm && { 'Content-Type': 'application/json' }) 
    },
    body: isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    console.log(text)
    throw new StepError(`eSAW ${route} failed (HTTP ${res.status}): ${data?.Message ?? text}`, {
      httpStatus: res.status,
      ErrorId: data?.ErrorId,
      TraceId: data?.TraceId,
    });
  }
  return data;
};

export const uploadFile = async (cfg, buffer, fileName) => {
  const form = new FormData();
  form.append('File', new Blob([buffer], { type: 'application/pdf' }), fileName);
  const data = await esaw(cfg, 'file/upload', form);
  return data?.FileId ?? data;
};

export const deleteFile = async (cfg, fileId) => {
  await esaw(cfg, 'file/delete', { FileId: fileId });
};

export const prepareSignatures = async (cfg, fileId) => {
  const data = await esaw(cfg, 'file/prepare', {
    FileIds: [fileId],
    SigStringConfigurations: [
      { StartPattern: cfg.sigStart, EndPattern: cfg.sigEnd, ClearSigString: true, SearchEntireWordOnly: false },
    ],
  });
  return data?.UnassignedElements?.Signatures ?? [];
};

export const sendEnvelope = async (cfg, envelope) => {
  const data = await esaw(cfg, 'envelope/send', envelope);
  return data?.EnvelopeId;
};

export const deleteEnvelope = async (cfg, envelopeId) => {
  await esaw(cfg, 'envelope/delete', { EnvelopeId: envelopeId });
};
