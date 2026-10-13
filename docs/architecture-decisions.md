# Decisioni

Ambito attuale: una sola funzione, `lambda-immobiliare-ads-handler`. Nessuna pipeline e nessuno stack.

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
```

`functions.json` separa `logicalName` e `functionName`. Il nome AWS, l'account e la regione stanno nel manifest e non si deducono dalla cartella. Non contiene valori di ambiente.

## Build

Un solo `buildspec.yml` in radice, senza `runtime-versions`. `BUILD_TARGETS` è obbligatorio. `scripts/build-selected.sh` rifiuta target vuoti, sconosciuti e `arm64`, e non installa dipendenze. La ricetta Node.js 22.14.0 con Yarn Classic 1.22.22 vive solo in `functions/lambda-immobiliare-ads-handler/build.sh`. Il pin non vale per le altre funzioni. Python e container non sono implementati.

## Codice di questa funzione

Si versiona il sorgente ESM estratto dal pacchetto distribuito il 2026-10-12. La cartella CommonJS in `project/lambda-immobiliare-ads-handler` non è la copia in esecuzione e non viene importata.

`package.json` resta quello del pacchetto: nessuna chiave `type`, nessun cambio di dipendenze. Il runtime resta `nodejs22.x`, l'handler `index.handler`, l'architettura `x86_64`.

`node_modules` non entra in Git. Lo zip di build ha `index.mjs` e `helper/` alla radice. Il deploy non è stato eseguito.

Non esiste codice condiviso con altre funzioni, quindi `shared/` non è stato creato.

## Deploy

Non è stato fatto e non è preparato. La coda SQS punta a `$LATEST` senza alias. Un futuro `update-function-code` aggiornerebbe il codice invocato dalla coda. Prima di quel comando servono approvazione, artefatto di rollback e controllo del `RevisionId`.

Pipeline, ruoli IAM e CloudFormation restano fuori da questa impostazione.
