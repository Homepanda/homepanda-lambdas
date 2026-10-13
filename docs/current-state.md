# Stato attuale

Aggiornato il 2026-10-13. Ambito: sola funzione `lambda-immobiliare-ads-handler`. Le altre Lambda non sono state inventariate.

## Repository

- Destinazione: `https://github.com/Homepanda/homepanda-lambdas.git`.
- Il clone locale non ha commit. Il branch remoto `origin/main` risulta assente (`gone`).
- Nel repository non c'erano IaC, pipeline, buildspec, Dockerfile o test.

## Sorgente usato

Il pacchetto distribuito in AWS è stato scaricato in `/tmp` (fuori da Git) e confrontato con la cartella locale `/home/corrado/homepanda/project/lambda-immobiliare-ads-handler`.

Quella cartella non è un repository Git. Contiene CommonJS (`.js`) con date fino a giugno 2025. Il pacchetto in esecuzione è ESM (`.mjs`): `services/homepanda.mjs` è del 2026-05-13 e lo zip è stato assemblato il 2026-10-12. I due alberi non coincidono.

In Git è entrato il sorgente recuperato dallo zip, senza `node_modules`, senza `.vscode` e senza il file vuoto `helper/generateXml` (0 byte, non importato). Lo zip distribuito contiene 675 file e include le dipendenze già installate. `CodeSha256` letto da AWS: `TBbIN+yfQqPFi70Cviy0ZvJL2CDQJAgBrKB/X24hx10=`. `yarn install --frozen-lockfile` con Yarn 1.22.22 è riuscito e non ha modificato `yarn.lock`. Non è stato costruito un nuovo zip, quindi l'hash non è stato confrontato con quello in produzione.

`findIstatCode.mjs` legge `./helper/comuni.csv` da `process.cwd()`. In Lambda la working directory è la radice del pacchetto. Per questo `src/` è la radice dello zip.

Lo zip distribuito non passa il parse di Node 22. In `helper/generateXml.mjs` la chiamata `pictures.ele(...).att(...).att(...)` era già chiusa e, subito dopo, restavano un commento e un `);` in più (intorno alla riga 421 del file estratto). `node --check` su quel file fallisce con `Unexpected token ')'`. Il modulo è importato da `index.mjs`, quindi il pacchetto in AWS non può caricare l'handler. Nel repository quel `);` e il commento residuo sono stati tolti, solo per rendere il modulo valido. La modifica non è stata pubblicata.

## Funzione AWS letta

Lettura con il profilo `default`, identità `arn:aws:iam::247981707334:user/user-deploy`, regione configurata `eu-central-1`. Nessuna scrittura.

| Campo | Valore |
| --- | --- |
| Nome | `lambda-immobiliare-ads-handler` |
| Account | `247981707334` |
| Regione | `eu-central-1` |
| PackageType | Zip |
| Runtime | `nodejs22.x` |
| Handler | `index.handler` |
| Architettura | `x86_64` |
| Memoria | 128 MB |
| Timeout | 30 s |
| Storage temporaneo | 512 MB |
| Layer | nessuno |
| Concorrenza riservata | assente |
| Alias | nessuno |
| Versioni pubblicate | 50, invocazione osservata su `$LATEST` |
| VPC | `vpc-0b801a60` |
| Ruolo | `lambda-immobiliare-ads-handler-role-k2khi5zh` |
| Log group | `/aws/lambda/lambda-immobiliare-ads-handler`, retention non impostata |
| Tag | nessuno |
| Resource policy | assente |
| Configurazione invocazione asincrona | assente |

Event source mapping abilitato sulla coda `arn:aws:sqs:eu-central-1:247981707334:ImmobiliareAds`, batch size 1, ARN della funzione senza qualificatore. La coda invoca `$LATEST`.

Variabili d'ambiente presenti, solo nomi: `HOMEPANDA_PROPERTY_SERVICE_URL`, `IMMOBILIARE_AUTHORIZATION`, `IMMOBILIARE_AGENCY_HP`, `IMMOBILIARE_AGENCY_RLB`. I valori restano sulla funzione. Nel sorgente recuperato sono letti solo i primi due. `IMMOBILIARE_AGENCY_HP` e `IMMOBILIARE_AGENCY_RLB` non compaiono nel codice copiato.

## Verifica locale

`node --test functions/lambda-immobiliare-ads-handler/tests/handler.test.mjs` con Node v22.14.0: 1 test passato. Copre solo l'azione sconosciuta, che esce prima di Immobiliare e del webhook Homepanda. Non è uno smoke test sulla funzione AWS.

## Cosa non è stato verificato

- Conteggio delle altre funzioni e trigger fuori da Lambda (producer della coda, EventBridge, API Gateway).
- Policy del ruolo di esecuzione.
- Build riproducibile e uguaglianza dell'hash con il pacchetto in produzione.
- Deploy, pipeline, import CloudFormation.
