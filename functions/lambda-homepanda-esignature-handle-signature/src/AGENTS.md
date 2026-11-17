# Local development

Lambda handler: `index.mjs` (ESM, `handler` export). Unit tests live in `index.test.mjs`.

## Tests

```bash
npm test
```

## Invoke the handler locally

Runs the handler with the local Node runtime.

```bash
ESAW_API_TOKEN=xxx HOMEPANDA_ENDPOINT_PROPERTY=http://property.homepanda.locale node scripts/invoke-node.mjs
```

A different payload can be passed as the first argument; the script exits non-zero when the handler throws.

Configuration is read from the environment by `helpers/config.mjs`:

| Variable | Default |
| --- | --- |
| `ESAW_BASE_URL` | `https://demo.esignanywhere.net/Api` |
| `ESAW_API_TOKEN` | *(required)* |
| `HOMEPANDA_ENDPOINT_PROPERTY` | `http://property.homepanda.locale` |
