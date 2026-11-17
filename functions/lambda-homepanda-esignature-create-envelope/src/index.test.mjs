import { jest } from '@jest/globals';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const s3Send = jest.fn();
const GetObjectCommand = jest.fn(function (input) {
  this.input = input;
});
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: s3Send })),
  GetObjectCommand,
}));

const { handler } = await import('./index.mjs');
const { normalizePhone } = await import('./helpers/activities.mjs');
const { buildCallbackUrl } = await import('./helpers/callback.mjs');

const loadEvent = async () =>
  JSON.parse(await readFile(new URL('./event.json', import.meta.url), 'utf8'));

const json = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

const sig = (n) => ({
  ElementId: `sig-${n}`,
  DocumentNumber: 1,
  FoundSigStringPattern: `#SIGN${n}#`,
  FieldDefinition: { Position: { PageNumber: 1, X: 10 * n, Y: 20 }, Size: { Width: 100, Height: 50 } },
});

const mockFetch = ({ signatures = [sig(1), sig(2)], send = json(200, { EnvelopeId: 'env-1' }) } = {}) =>
  jest.fn(async (url) => {
    if (url.endsWith('/v6/file/upload')) return json(200, { FileId: 'file-1' });
    if (url.endsWith('/v6/file/prepare')) return json(200, { UnassignedElements: { Signatures: signatures } });
    if (url.endsWith('/v6/envelope/send')) return send;
    return json(200, {});
  });

const callsTo = (suffix) => globalThis.fetch.mock.calls.filter(([url]) => url.endsWith(suffix));
const webhookBodies = (event) => callsTo(event.webhook_callback).map(([, opts]) => JSON.parse(opts.body));

describe('handler', () => {
  let event;
  let dir;
  const env = { ...process.env };

  beforeEach(async () => {
    event = await loadEvent();
    dir = await mkdtemp(path.join(tmpdir(), 'esaw-'));
    await mkdir(path.join(dir, path.dirname(event.payload.document)), { recursive: true });
    await writeFile(path.join(dir, event.payload.document), '%PDF-1.4 test');
    process.env = { ...env, ESAW_API_TOKEN: 'test-token', ESAW_CALLBACK_URL: 'https://callback.homepanda.test/api/v1/webhook/esignature', DOCUMENTS_LOCAL_DIR: dir };
    delete process.env.DOCUMENTS_BUCKET;
    globalThis.fetch = mockFetch();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    process.env = env;
    jest.restoreAllMocks();
    s3Send.mockReset();
    await rm(dir, { recursive: true, force: true });
  });

  it('sends the envelope and notifies the webhook with SUCCESS', async () => {
    const response = await handler(event);

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ status: 'SUCCESS', EnvelopeId: 'env-1' }),
    });
    expect(webhookBodies(event)).toEqual([{ status: 'SUCCESS', EnvelopeId: 'env-1' }]);

    const [[uploadUrl, uploadOpts]] = callsTo('/v6/file/upload');
    expect(uploadUrl).toBe('https://saas.esignanywhere.net/Api/v6/file/upload');
    expect(uploadOpts.headers.apiToken).toBe('test-token');
    expect(uploadOpts.body.get('File').name).toBe('document.pdf');

    const sendBody = JSON.parse(callsTo('/v6/envelope/send')[0][1].body);
    expect(sendBody.Documents).toEqual([{ FileId: 'file-1', DocumentNumber: 1 }]);
    expect(sendBody.Name).toBe('Firma documento - Immobile #3');
    expect(sendBody.CallbackConfiguration).toEqual({
      CallbackUrl:
        'https://callback.homepanda.test/api/v1/webhook/esignature?envelope=##EnvelopeId##&action=##Action##&workflow=a328f06c-13a0-43a6-bbf9-465be074c23f',
    });
    expect(sendBody.Activities).toHaveLength(2);
    const [gianni, mario] = sendBody.Activities.map((a) => a.Action.Sign);
    expect(gianni.SigningGroup).toBe('phase-1');
    expect(mario.SigningGroup).toBe('phase-1');
    expect(gianni.RecipientConfiguration.ContactInformation).toEqual({
      Email: 'gianni.ciccarelli@gmail.com',
      GivenName: 'Gianni',
      Surname: 'Ciccarelli',
      PhoneNumber: '+393488730465',
      LanguageCode: 'IT',
    });
    expect(mario.RecipientConfiguration.ContactInformation.PhoneNumber).toBe('+393488730465');
    expect(gianni.Elements.Signatures[0]).toMatchObject({
      ElementId: 'sig-1',
      Required: true,
      AllowedSignatureTypes: { ClickToSign: {} },
      FieldDefinition: sig(1).FieldDefinition,
    });
    expect(mario.Elements.Signatures[0].ElementId).toBe('sig-2');
  });

  it('assigns sequential signing groups by phase and preserves signature order', async () => {
    const secondPhase = structuredClone(event.payload.phases[0]);
    secondPhase.recipients[0].email = 'recipient-phase-2@example.com';
    secondPhase.signers[0].email = 'signer-phase-2@example.com';
    event.payload.phases.push(secondPhase);
    globalThis.fetch = mockFetch({ signatures: [sig(1), sig(2), sig(3), sig(4)] });

    await handler(event);

    const sendBody = JSON.parse(callsTo('/v6/envelope/send')[0][1].body);
    const signs = sendBody.Activities.map((a) => a.Action.Sign);
    expect(signs.map((sign) => [sign.RecipientConfiguration.ContactInformation.Email, sign.SigningGroup])).toEqual([
      ['gianni.ciccarelli@gmail.com', 'phase-1'],
      ['gianni.ciccarelli@gmx.com', 'phase-1'],
      ['recipient-phase-2@example.com', 'phase-2'],
      ['signer-phase-2@example.com', 'phase-2'],
    ]);
    expect(signs.map((sign) => sign.Elements.Signatures[0].ElementId)).toEqual(['sig-1', 'sig-2', 'sig-3', 'sig-4']);
  });

  it('rejects a legacy payload without phases', async () => {
    const { recipients, signers } = event.payload.phases[0];
    delete event.payload.phases;
    Object.assign(event.payload, { recipients, signers });

    await expect(handler(event)).rejects.toThrow('Missing payload.phases');
    expect(callsTo('/v6/file/upload')).toHaveLength(0);
    expect(webhookBodies(event)).toEqual([expect.objectContaining({ status: 'FAILED', step: 'validate' })]);
  });

  it('fails when a signer has no signature tag', async () => {
    globalThis.fetch = mockFetch({ signatures: [sig(1)] });

    await expect(handler(event)).rejects.toThrow('Missing signature tags');
    expect(callsTo('/v6/envelope/send')).toHaveLength(0);
    expect(webhookBodies(event)).toEqual([
      expect.objectContaining({ status: 'FAILED', step: 'build', missingSigners: ['gianni.ciccarelli@gmx.com'] }),
    ]);
  });

  it('reports eSAW errors to the webhook', async () => {
    globalThis.fetch = mockFetch({ send: json(400, { ErrorId: 'ERR0001', Message: 'bad', TraceId: 't-1' }) });

    await expect(handler(event)).rejects.toThrow('bad');
    expect(webhookBodies(event)).toEqual([
      expect.objectContaining({ status: 'FAILED', step: 'send', ErrorId: 'ERR0001', TraceId: 't-1', httpStatus: 400 }),
    ]);
  });

  it('reads the document from S3 when DOCUMENTS_BUCKET is set', async () => {
    process.env.DOCUMENTS_BUCKET = 'docs-bucket';
    s3Send.mockResolvedValue({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } });

    await handler(event);

    expect(s3Send.mock.calls[0][0].input).toEqual({
      Bucket: 'docs-bucket',
      Key: 'workflows/a328f06c-13a0-43a6-bbf9-465be074c23f/1/document.pdf',
    });
  });

  it('fails when the API token is missing', async () => {
    delete process.env.ESAW_API_TOKEN;

    await expect(handler(event)).rejects.toThrow('ESAW_API_TOKEN');
    expect(callsTo('/v6/file/upload')).toHaveLength(0);
    expect(webhookBodies(event)).toEqual([expect.objectContaining({ status: 'FAILED', step: 'validate' })]);
  });

  it('sends the envelope without CallbackConfiguration when the callback URL is missing', async () => {
    delete process.env.ESAW_CALLBACK_URL;

    await handler(event);

    const sendBody = JSON.parse(callsTo('/v6/envelope/send')[0][1].body);
    expect(sendBody.CallbackConfiguration).toBeUndefined();
    expect(webhookBodies(event)).toEqual([{ status: 'SUCCESS', EnvelopeId: 'env-1' }]);
  });

  it('fails when webhook_callback has no workflow id before the step number', async () => {
    event.webhook_callback = 'http://property.homepanda.locale/api/v1/webhook/workflow/not-a-uuid/1';

    await expect(handler(event)).rejects.toThrow('workflow id');
    expect(callsTo('/v6/envelope/send')).toHaveLength(0);
    expect(webhookBodies(event)).toEqual([expect.objectContaining({ status: 'FAILED', step: 'validate' })]);
  });

  it('does not report FAILED when the SUCCESS webhook call fails', async () => {
    const base = mockFetch();
    globalThis.fetch = jest.fn(async (url, opts) => (url === event.webhook_callback ? json(500, {}) : base(url, opts)));

    await expect(handler(event)).rejects.toMatchObject({ envelopeId: 'env-1' });
    expect(webhookBodies(event)).toEqual([{ status: 'SUCCESS', EnvelopeId: 'env-1' }]);
  });
});

describe('normalizePhone', () => {
  it.each([
    ['3488730465', '+393488730465'],
    ['+39 348 873 0465', '+393488730465'],
    ['00393488730465', '00393488730465'],
    ['', undefined],
    [null, undefined],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input, '+39')).toBe(expected);
  });
});

describe('buildCallbackUrl', () => {
  const webhook =
    'http://property.homepanda.locale/api/v1/webhook/workflow/a328f06c-13a0-43a6-bbf9-465be074c23f/1';
  const template =
    '?envelope=##EnvelopeId##&action=##Action##&workflow=a328f06c-13a0-43a6-bbf9-465be074c23f';

  it('builds the callback url with the workflow id from webhook_callback', () => {
    expect(buildCallbackUrl('https://cb.example.com/hook', webhook)).toBe(
      `https://cb.example.com/hook${template}`,
    );
  });

  it('prepends https:// when the base url has no scheme', () => {
    expect(buildCallbackUrl('cb.example.com/hook', webhook)).toBe(`https://cb.example.com/hook${template}`);
  });

  it('strips trailing slashes from the base url', () => {
    expect(buildCallbackUrl('https://cb.example.com/hook/', webhook)).toBe(
      `https://cb.example.com/hook${template}`,
    );
  });

  it('extracts the workflow id before the step number, tolerating a trailing slash', () => {
    expect(buildCallbackUrl('https://cb.example.com/hook', `${webhook}/`)).toBe(
      `https://cb.example.com/hook${template}`,
    );
  });

  it('throws when no workflow id can be extracted', () => {
    expect(() => buildCallbackUrl('https://cb.example.com/hook', 'http://x/workflow/1')).toThrow(
      'workflow id',
    );
    expect(() => buildCallbackUrl('https://cb.example.com/hook', undefined)).toThrow('workflow id');
  });

  it('throws when the base url is missing', () => {
    expect(() => buildCallbackUrl('', webhook)).toThrow('ESAW_CALLBACK_URL');
  });
});
