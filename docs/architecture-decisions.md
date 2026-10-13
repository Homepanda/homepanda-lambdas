# Decisioni

Ambito attuale: una sola funzione, `lambda-immobiliare-ads-handler`. Nessuna pipeline e nessuno stack.

## Repository

La radice di `homepanda-lambdas` è il monorepo. Non si aggiunge un ulteriore livello `lambda-functions/`. I domini sono cartelle. La prima è `immobiliare`.

```text
functions/immobiliare/lambda-immobiliare-ads-handler/
  src/          radice del pacchetto Zip
  tests/
  package.json
  yarn.lock
functions.json
inventory/functions.sanitized.json
docs/
```

`functions.json` mappa nome logico, cartella, funzione AWS, account, regione e tipo di pacchetto. Non contiene valori di ambiente.

## Codice di questa funzione

Si versiona il sorgente ESM estratto dal pacchetto distribuito il 2026-10-12. La cartella CommonJS in `project/lambda-immobiliare-ads-handler` non è la copia in esecuzione e non viene importata.

`package.json` resta quello del pacchetto: nessuna chiave `type`, nessun cambio di dipendenze. Il runtime resta `nodejs22.x`, l'handler `index.handler`, l'architettura `x86_64`.

`node_modules` non entra in Git. Lo zip di deploy, quando verrà costruito, dovrà avere `index.mjs` e `helper/` alla radice, come oggi.

Non esiste codice condiviso con altre funzioni, quindi `shared/` non è stato creato.

## Deploy

Non è stato fatto e non è preparato. La coda SQS punta a `$LATEST` senza alias. Un futuro `update-function-code` aggiornerebbe il codice invocato dalla coda. Prima di quel comando servono approvazione, artefatto di rollback e controllo del `RevisionId`.

Pipeline, ruoli IAM e CloudFormation restano fuori da questa impostazione.
