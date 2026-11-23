import { jest } from '@jest/globals';
import { readFile } from 'node:fs/promises';

const { handler } = await import('./index.mjs');
const { buildWorkflowUrl } = await import('./services/webhook.mjs');

const loadEvent = async () => JSON.parse(await readFile(new URL('./event.json', import.meta.url), 'utf8'));

const json = (status, body) => ({
  ok: status < 400,
  status,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(body),
});

const pdf = (status, body = '%PDF-1.4 signed') => ({
  ok: status < 400,
  status,
  headers: { get: () => 'application/pdf' },
  arrayBuffer: async () => Buffer.from(body),
  text: async () => body,
});

const envelopeDoc = (overrides = {}) => ({
  FileId: 'file-1',
  FileName: 'signed-document.pdf',
  DocumentNumber: 1,
  ...overrides,
});

const callsTo = (matcher) =>
  globalThis.fetch.mock.calls.filter(([url]) =>
    typeof matcher === 'string' ? url.endsWith(matcher) || url === matcher : matcher(url),
  );

const baseFetch = ({
  envelopeStatus = 'Completed',
  documents = [envelopeDoc()],
  envelopeBody = {},
  filesBody = {},
  downloadBody = '%PDF-1.4 signed',
} = {}) =>
  jest.fn(async (url) => {
    if (url.endsWith('/v6/envelope/45fd01ce-1234-4792-1234-f5230e41b130')) {
      return json(200, { Id: '45fd01ce-1234-4792-1234-f5230e41b130', EnvelopeStatus: envelopeStatus, ...envelopeBody });
    }
    if (url.endsWith('/v6/envelope/45fd01ce-1234-4792-1234-f5230e41b130/files')) {
      return json(200, { Documents: documents, ...filesBody });
    }
    if (url.endsWith('/v6/file/file-1')) return pdf(200, downloadBody);
    return json(200, {});
  });

describe('handler', () => {
  let event;
  let cfg;
  const env = { ...process.env };

  beforeEach(async () => {
    event = await loadEvent();
    process.env = {
      ...env,
      ESAW_API_TOKEN: 'test-token',
      HOMEPANDA_ENDPOINT_PROPERTY: 'http://property.homepanda.locale',
    };
    cfg = {
      homepandaEndpoint: 'http://property.homepanda.locale',
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = baseFetch();
  });

  afterEach(() => {
    process.env = env;
    jest.restoreAllMocks();
  });

  it('downloads the main completed document and posts SUCCESS to Homepanda', async () => {
    globalThis.fetch = baseFetch({
      documents: [
        envelopeDoc({ FileId: 'file-2', FileName: 'secondary.pdf', DocumentNumber: 2 }),
        envelopeDoc({ FileId: 'file-1', FileName: 'primary.pdf', DocumentNumber: 1 }),
      ],
    });

    const result = await handler(event);

    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        status: 'SUCCESS',
        envelopeId: event.envelope,
        envelopeStatus: 'Completed',
        workflow: event.workflow,
        fileId: 'file-1',
      }),
    });

    const statusCall = callsTo('/v6/envelope/45fd01ce-1234-4792-1234-f5230e41b130')[0];
    expect(statusCall[1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'ApiToken test-token',
        apiToken: 'test-token',
      }),
    });

    expect(callsTo('/v6/file/file-1')).toHaveLength(1);
    expect(callsTo('/v6/file/file-2')).toHaveLength(0);

    const [[url, opts]] = callsTo(buildWorkflowUrl(cfg, event.workflow));
    expect(url).toBe('http://property.homepanda.locale/api/v1/webhook/workflow/a328f06c-13a0-43a6-bbf9-465be074c23f/2');
    expect(opts.method).toBe('POST');
    expect(opts.body.get('status')).toBe('SUCCESS');
    const file = opts.body.get('document');
    expect(file.name).toBe('primary.pdf');
    expect(file.type).toBe('application/pdf');
  });

  it('ignores unsupported callback actions', async () => {
    event.action = 'workstepFinished';
    globalThis.fetch = jest.fn();

    const result = await handler(event);

    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({ status: 'IGNORED', reason: 'Ignored unsupported action', action: 'workstepFinished' }),
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns a no-op success when the envelope is not completed yet', async () => {
    globalThis.fetch = baseFetch({ envelopeStatus: 'WaitingForOthers' });

    const result = await handler(event);

    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        status: 'IGNORED',
        reason: 'Envelope not completed yet',
        envelopeId: event.envelope,
        envelopeStatus: 'WaitingForOthers',
      }),
    });
    expect(callsTo((url) => url.includes('/api/v1/webhook/workflow/'))).toHaveLength(0);
    expect(callsTo('/v6/envelope/45fd01ce-1234-4792-1234-f5230e41b130/files')).toHaveLength(0);
  });

  it.each(['Rejected', 'Canceled', 'Expired'])('posts FAILED JSON and throws for terminal status %s', async (status) => {
    globalThis.fetch = baseFetch({ envelopeStatus: status });

    await expect(handler(event)).rejects.toThrow(`Envelope ended in terminal failed status: ${status}`);

    const [[url, opts]] = callsTo(buildWorkflowUrl(cfg, event.workflow));
    expect(url).toBe(buildWorkflowUrl(cfg, event.workflow));
    expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(opts.body)).toEqual({
      status: 'FAILED',
      error: `Envelope ended in terminal failed status: ${status}`,
      step: 'fetch_envelope',
      envelopeId: event.envelope,
      envelopeStatus: status,
      action: 'envelopeFinished',
    });
  });

  it('reports eSAW API errors to Homepanda', async () => {
    globalThis.fetch = jest.fn(async (url) => {
      if (url.endsWith('/v6/envelope/45fd01ce-1234-4792-1234-f5230e41b130')) {
        return json(404, { Message: 'missing', ErrorId: 'ERR0001', TraceId: 'trace-1' });
      }
      return json(200, {});
    });

    await expect(handler(event)).rejects.toThrow('eSAW envelope/45fd01ce-1234-4792-1234-f5230e41b130 failed (HTTP 404): missing');

    const [[, opts]] = callsTo(buildWorkflowUrl(cfg, event.workflow));
    expect(JSON.parse(opts.body)).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        step: 'fetch_envelope',
        httpStatus: 404,
        ErrorId: 'ERR0001',
        TraceId: 'trace-1',
      }),
    );
  });

  it('reports validation failures when the API token is missing', async () => {
    delete process.env.ESAW_API_TOKEN;
    globalThis.fetch = jest.fn(async (url) => (url === buildWorkflowUrl(cfg, event.workflow) ? json(200, {}) : json(500, {})));

    await expect(handler(event)).rejects.toThrow('ESAW_API_TOKEN');

    const [[, opts]] = callsTo(buildWorkflowUrl(cfg, event.workflow));
    expect(JSON.parse(opts.body)).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        step: 'validate',
        error: 'Missing ESAW_API_TOKEN configuration',
      }),
    );
  });

  it('does not send a FAILED callback when the SUCCESS webhook call fails', async () => {
    const base = baseFetch();
    globalThis.fetch = jest.fn(async (url, opts) => {
      if (url === buildWorkflowUrl(cfg, event.workflow)) return json(500, {});
      return base(url, opts);
    });

    await expect(handler(event)).rejects.toThrow('Homepanda success webhook failed');
    expect(callsTo(buildWorkflowUrl(cfg, event.workflow))).toHaveLength(1);
  });

  it('reports missing downloadable documents as FAILED', async () => {
    globalThis.fetch = baseFetch({ documents: [] });

    await expect(handler(event)).rejects.toThrow('No downloadable documents found for envelope');

    const [[, opts]] = callsTo(buildWorkflowUrl(cfg, event.workflow));
    expect(JSON.parse(opts.body)).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        step: 'fetch_files',
        error: 'No downloadable documents found for envelope',
      }),
    );
  });
});
