# Decisioni

Ambito attuale: `lambda-immobiliare-ads-handler`, `lambda-immobiliare-leads-handler` e `lambda-homepanda-whatsapp-bitrix-message`. Non c’è un pilota: Plan seleziona ogni cartella sotto `functions/` mappata in `functions.json`.

## Repository

La radice di `homepanda-lambdas` è il monorepo. Non si aggiunge un ulteriore livello `lambda-functions/`.

```text
buildspec.yml
scripts/build-selected.sh
functions.json
functions/lambda-immobiliare-ads-handler/
  build.sh
  src/          radice del pacchetto Zip
  tests/
functions/lambda-immobiliare-leads-handler/
  build.sh
  src/
  tests/
functions/lambda-homepanda-whatsapp-bitrix-message/
  build.sh
  src/
  tests/
```

`functions.json` separa `logicalName` e `functionName`. Il nome AWS, l'account e la regione stanno nel manifest e non si deducono dalla cartella. Non contiene valori di ambiente.

## Build

Un solo `buildspec.yml` in radice, senza `runtime-versions`. La build legge `release-targets.json` dello stage Plan; `BUILD_TARGETS` resta solo override manuale. Ogni funzione ha la propria ricetta in `build.sh` (Node 22.14.0 per ads, Node 24.11.0 per leads e whatsapp-bitrix, Yarn Classic 1.22.22). I pin non sono condivisi. Python e container non sono implementati. Più target producono zip distinti e `dist/release-manifest.json` con `releases[]`.

## Codice di questa funzione

Si versiona il sorgente ESM estratto dal pacchetto distribuito il 2026-10-12. La cartella CommonJS in `project/lambda-immobiliare-ads-handler` non è la copia in esecuzione e non viene importata.

`package.json` resta quello del pacchetto: nessuna chiave `type`, nessun cambio di dipendenze. Il runtime resta `nodejs22.x`, l'handler `index.handler`, l'architettura `x86_64`.

`node_modules` non entra in Git. Lo zip di build ha `index.mjs` e `helper/` alla radice. Il deploy non è stato eseguito.

Non esiste codice condiviso con altre funzioni, quindi `shared/` non è stato creato.

## Codice di lambda-immobiliare-leads-handler

Si versiona il sorgente ESM estratto dal pacchetto distribuito il 2026-09-15. `CodeSha256` letto da AWS, `TdcjKCUN3uNeoEniicm9wVnfM39JcauKmwF9alYw5PE=`, coincide con lo zip scaricato. La cartella in `project/lambda-immobiliare-leads-handler` non è la copia in esecuzione: `package.json` e `yarn.lock` coincidono, `index.mjs` e `services/` no. Non viene importata.

`package.json` resta quello del pacchetto: nessuna chiave `type`, nessun cambio di dipendenze. Il runtime atteso è `nodejs24.x`, l'handler `index.handler`, l'architettura `x86_64`.

`node_modules` non entra in Git. Lo zip di build ha `index.mjs` e `services/` alla radice.

In `services/immobiliare.mjs` il pacchetto in esecuzione usa l'identificatore `nseDetail`, che non è dichiarato. Il file fa il parse. L'identificatore è stato lasciato com'è. Rispetto allo zip, l'autocomplete di `retrieveMessage` è in un `try/catch`: un errore di quella chiamata viene scritto nel log e il recupero del messaggio prosegue.

## Codice di lambda-homepanda-whatsapp-bitrix-message

Si versiona il sorgente ESM estratto dal pacchetto distribuito il 2026-09-30. `CodeSha256` letto da AWS, `b4KiRqFcyeFtHyIcj2qsY3TbgapJd6/HfrFyEb9Ve3U=`, coincide con lo zip scaricato.

`package.json` resta quello del pacchetto: mantiene `"type": "module"` e dipendenze `hono` + `@hono/aws-lambda`. Il runtime atteso è `nodejs24.x`, l'handler `index.handler`, l'architettura `x86_64`.

`node_modules` non entra in Git. Lo zip di build ha `index.mjs` e `lib/` alla radice.

Il sorgente letto nello zip usa `setDeliveryStatus` in `index.mjs` senza import esplicito e fa riferimento a `db`, `sqs`, `uuidv7` e `SQS_WHATSAPP_OUTBOUND`. Questo comportamento resta invariato perché in questa fase il repository deve restare allineato al pacchetto distribuito.

## Deploy

`scripts/deploy-release.sh` pubblica ogni voce di `releases[]` sulla funzione AWS del manifesto (`update-function-code --no-publish`) e aggiorna lo stato S3 solo per i successi. Le code SQS restano su `$LATEST`. Runtime, handler, ruolo, VPC e variabili d’ambiente non vengono modificati.

Pipeline, ruoli IAM e CloudFormation restano fuori da Git.
