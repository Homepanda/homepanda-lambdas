# Local development

Lambda handler: `index.mjs` (ESM, `handler` export). Unit tests live in `index.test.mjs`.

## Tests

```bash
npm test
```

## Invoke the handler locally

Runs the handler with the local Node runtime — no Docker, no SAM.

```bash
DOCUMENTS_LOCAL_DIR=/home/giannicic/Projects/Homepanda/homepanda-service-property/homepanda-service-property/storage/app ESAW_API_TOKEN=xxx node scripts/invoke-node.mjs
```

The script `chdir`s to the function root first (mirroring `/var/task` on Lambda), so
`payload.document` resolves the same way it does in the cloud. A different payload can be
passed as the first argument; it exits non-zero when the handler throws.

Configuration is read from the environment by `helpers/config.mjs`:

| Variable | Default |
| --- | --- |
| `ESAW_BASE_URL` | `https://saas.esignanywhere.net/Api` |
| `ESAW_API_TOKEN` | *(required)* |
| `ESAW_CALLBACK_URL` | *(optional)* — eSAW envelope callback base URL (`https://` is prepended if missing); when unset, no eSAW `CallbackConfiguration` is sent |
| `DOCUMENTS_BUCKET` | *(unset — read from the filesystem)* |
| `DOCUMENTS_LOCAL_DIR` | `process.cwd()` |
| `SIGSTRING_START` / `SIGSTRING_END` | `#SIGN` / `#` |
| `DEFAULT_PHONE_PREFIX` | `+39` |
| `ESAW_LANGUAGE_CODE` | `IT` |

## Delete an uploaded file

Pass the eSAW `FileId` returned by the upload API:

```bash
ESAW_API_TOKEN=xxx node scripts/delete-file.mjs <file-id>
```

The script calls `POST /v6/file/delete` with `{ "FileId": "<file-id>" }`.
It uses `ESAW_BASE_URL` and `ESAW_API_TOKEN` from the configuration above, prints
confirmation on success, and exits non-zero for invalid input or API errors.
Run with `--help` to see usage.

## Delete an envelope

Pass the eSAW `EnvelopeId` returned when sending the envelope:

```bash
ESAW_API_TOKEN=xxx node scripts/delete-envelope.mjs <envelope-id>
```

The script calls `POST /v6/envelope/delete` with `{ "EnvelopeId": "<envelope-id>" }`.
It uses `ESAW_BASE_URL` and `ESAW_API_TOKEN`, prints confirmation on success, and
exits non-zero for invalid input or API errors. Run with `--help` to see usage.

## Notes

- `event.json` has `payload.document: "/workflows/<id>/document.pdf"`, which does not exist
  locally. Point it at a real file (e.g. `test/fixtures/document.pdf`, regenerated with
  `node scripts/make-test-pdf.mjs`) or set `DOCUMENTS_BUCKET` before invoking.
- When `ESAW_CALLBACK_URL` is set, envelopes are sent with `CallbackConfiguration.CallbackUrl` =
  `<ESAW_CALLBACK_URL>?envelope=##EnvelopeId##&action=##Action##&workflow=<workflow_id>`, where
  `<workflow_id>` is the UUID extracted from `webhook_callback` (the segment before the trailing
  step number). eSAW replaces the placeholders when it calls back on envelope completion.
