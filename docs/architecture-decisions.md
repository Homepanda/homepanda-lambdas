# Decisioni

Ambito attuale: `lambda-immobiliare-ads-handler` e `lambda-immobiliare-leads-handler`. Nessuna pipeline e nessuno stack. Il deploy preparato resta solo sul pilota ads.

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
```

`functions.json` separa `logicalName` e `functionName`. Il nome AWS, l'account e la regione stanno nel manifest e non si deducono dalla cartella. Non contiene valori di ambiente.

## Build

Un solo `buildspec.yml` in radice, senza `runtime-versions`. `BUILD_TARGETS` è obbligatorio. `scripts/build-selected.sh` rifiuta target vuoti, sconosciuti e `arm64`, e non installa dipendenze. La ricetta Node.js 22.14.0 con Yarn Classic 1.22.22 vive solo in `functions/lambda-immobiliare-ads-handler/build.sh`. `lambda-immobiliare-leads-handler` ha la propria ricetta, Node 20.20.2 e Yarn Classic 1.22.22. Quei pin non valgono per le altre funzioni. Python e container non sono implementati.

## Codice di questa funzione

Si versiona il sorgente ESM estratto dal pacchetto distribuito il 2026-10-12. La cartella CommonJS in `project/lambda-immobiliare-ads-handler` non è la copia in esecuzione e non viene importata.

`package.json` resta quello del pacchetto: nessuna chiave `type`, nessun cambio di dipendenze. Il runtime resta `nodejs22.x`, l'handler `index.handler`, l'architettura `x86_64`.

`node_modules` non entra in Git. Lo zip di build ha `index.mjs` e `helper/` alla radice. Il deploy non è stato eseguito.

Non esiste codice condiviso con altre funzioni, quindi `shared/` non è stato creato.

## Codice di lambda-immobiliare-leads-handler

Si versiona il sorgente ESM estratto dal pacchetto distribuito il 2026-09-15. `CodeSha256` letto da AWS, `TdcjKCUN3uNeoEniicm9wVnfM39JcauKmwF9alYw5PE=`, coincide con lo zip scaricato. La cartella in `project/lambda-immobiliare-leads-handler` non è la copia in esecuzione: `package.json` e `yarn.lock` coincidono, `index.mjs` e `services/` no. Non viene importata.

`package.json` resta quello del pacchetto: nessuna chiave `type`, nessun cambio di dipendenze. Il runtime resta `nodejs20.x`, l'handler `index.handler`, l'architettura `x86_64`.

`node_modules` non entra in Git. Lo zip di build ha `index.mjs` e `services/` alla radice. Il deploy di questa funzione non è preparato: `scripts/deploy-release.sh` resta limitato al pilota ads.

In `services/immobiliare.mjs` il pacchetto in esecuzione usa l'identificatore `nseDetail`, che non è dichiarato. Il file fa il parse. L'identificatore è stato lasciato com'è. Rispetto allo zip, l'autocomplete di `retrieveMessage` è in un `try/catch`: un errore di quella chiamata viene scritto nel log e il recupero del messaggio prosegue.

## Deploy

Non è stato fatto e non è preparato. La coda SQS punta a `$LATEST` senza alias. Un futuro `update-function-code` aggiornerebbe il codice invocato dalla coda. Prima di quel comando servono approvazione, artefatto di rollback e controllo del `RevisionId`.

Pipeline, ruoli IAM e CloudFormation restano fuori da questa impostazione.
