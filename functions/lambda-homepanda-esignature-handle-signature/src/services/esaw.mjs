import { StepError } from '../helpers/errors.mjs';

const parseBody = async (res) => {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const authHeaders = (cfg) => ({
  Authorization: `ApiToken ${cfg.apiToken}`,
  apiToken: cfg.apiToken,
});

const esawGet = async (cfg, route) => {
  const res = await fetch(`${cfg.baseUrl}/v6/${route}`, {
    method: 'GET',
    headers: authHeaders(cfg),
  });
  const data = await parseBody(res);
  if (!res.ok) {
    throw new StepError(`eSAW ${route} failed (HTTP ${res.status}): ${data?.Message ?? data ?? 'Unknown error'}`, {
      httpStatus: res.status,
      ErrorId: data?.ErrorId,
      TraceId: data?.TraceId,
    });
  }
  return data;
};

const esawDownload = async (cfg, route) => {
  const res = await fetch(`${cfg.baseUrl}/v6/${route}`, {
    method: 'GET',
    headers: authHeaders(cfg),
  });
  if (!res.ok) {
    const data = await parseBody(res);
    throw new StepError(`eSAW ${route} failed (HTTP ${res.status}): ${data?.Message ?? data ?? 'Unknown error'}`, {
      httpStatus: res.status,
      ErrorId: data?.ErrorId,
      TraceId: data?.TraceId,
    });
  }
  return Buffer.from(await res.arrayBuffer());
};

export const fetchEnvelope = (cfg, envelopeId) => esawGet(cfg, `envelope/${encodeURIComponent(envelopeId)}`);

export const fetchEnvelopeFiles = (cfg, envelopeId) =>
  esawGet(cfg, `envelope/${encodeURIComponent(envelopeId)}/files`);

export const downloadFile = (cfg, fileId) => esawDownload(cfg, `file/${encodeURIComponent(fileId)}`);
