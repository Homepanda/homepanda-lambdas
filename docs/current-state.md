# Stato attuale

Aggiornato il 2026-10-27. Ambito: `lambda-immobiliare-ads-handler`, `lambda-immobiliare-leads-handler`, `lambda-homepanda-whatsapp-bitrix-message`, `lambda-wikicasa-ads-handler` e `lambda-idealista-ads-handler`. Le altre Lambda non sono state inventariate.

## Repository

- Destinazione: `https://github.com/Homepanda/homepanda-lambdas.git`.
- Il clone locale non ha commit. Il branch remoto `origin/main` risulta assente (`gone`).
- Nel repository non c'erano IaC, pipeline, buildspec o Dockerfile.

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

## Cosa non è stato verificato per ads

- Conteggio delle altre funzioni e trigger fuori da Lambda (producer della coda, EventBridge, API Gateway).
- Policy del ruolo di esecuzione.
- Build riproducibile e uguaglianza dell'hash con il pacchetto in produzione.
- Deploy, pipeline, import CloudFormation.

## lambda-immobiliare-leads-handler

Lettura con il profilo `default`, identità `arn:aws:iam::247981707334:user/user-deploy`, regione `eu-central-1`, il 2026-10-16. Nessuna scrittura. Lo zip distribuito è stato scaricato in `/tmp` e il suo SHA-256 in base64 coincide con `CodeSha256` `TdcjKCUN3uNeoEniicm9wVnfM39JcauKmwF9alYw5PE=`.

In Git è entrato il sorgente di quello zip, senza `node_modules`. Sono cinque file: `index.mjs`, `package.json`, `yarn.lock`, `services/homepanda.mjs`, `services/immobiliare.mjs`. Lo zip contiene 840 file, dipendenze comprese. `node --check` sui tre moduli passa.

La cartella `/home/corrado/homepanda/project/lambda-immobiliare-leads-handler` non è stata importata. `package.json` e `yarn.lock` sono identici allo zip. `index.mjs` e i due service no: lo zip gestisce anche la coda `RelabImmobiliareNewMessage` e usa le API `/fapi/inbox/leads`.

| Campo | Valore |
| --- | --- |
| Nome | `lambda-immobiliare-leads-handler` |
| Account | `247981707334` |
| Regione | `eu-central-1` |
| PackageType | Zip |
| Runtime | `nodejs20.x` |
| Handler | `index.handler` |
| Architettura | `x86_64` |
| Memoria | 128 MB |
| Timeout | 300 s |
| Storage temporaneo | 512 MB |
| Layer | nessuno |
| Concorrenza riservata | assente |
| Alias | nessuno |
| Versioni pubblicate | 94, invocazione osservata su `$LATEST` |
| VPC | assente |
| Ruolo | `lambda-immobiliare-leads-handler-role-nfrwqk6p` |
| Log group | `/aws/lambda/lambda-immobiliare-leads-handler`, retention non impostata |
| Tag | nessuno |
| Resource policy | assente |
| Invocazione asincrona | `MaximumRetryAttempts` 0, `MaximumEventAgeInSeconds` 21600, senza destinazioni, su `$LATEST` |

Event source mapping abilitati, ARN della funzione senza qualificatore. Le code invocano `$LATEST`.

| Coda | Batch |
| --- | --- |
| `ImmobiliareLeads` | 1 |
| `ImmobiliareFondoCasaLeads` | 10 |
| `ImmobiliareNewMessage` | 10 |
| `RelabImmobiliareLeads` | 10 |
| `RelabImmobiliareNewMessage` | 10 |

Variabili d'ambiente presenti, solo nomi: `PROVIDER_IMMOBILIARE_HP`, `PROVIDER_IMMOBILIARE_FC`, `PROVIDER_IMMOBILIARE_RLB`. I valori restano sulla funzione.

In `services/immobiliare.mjs` il pacchetto usa due volte l'identificatore `nseDetail`, che non è dichiarato. Il modulo fa il parse e l'identificatore è rimasto. Rispetto allo zip, l'autocomplete di `retrieveMessage` è in un `try/catch`: un errore di quella chiamata viene scritto nel log e il recupero del messaggio prosegue.

Il pin di build è Node 20.20.2 con Yarn Classic 1.22.22. L'API Lambda non espone la patch di `nodejs20.x`, quindi il pin non è quella patch. `yarn install --frozen-lockfile` con Yarn 1.22.22 è riuscito e non ha modificato `yarn.lock`. `BUILD_TARGETS=immobiliare-leads-handler bash scripts/build-selected.sh` ha prodotto `dist/immobiliare-leads-handler.zip` con SHA-256 `5e484dc806267d5b033c77c5a6342688e3f090ae117c04dbd22f48350a93615b`. Quell'hash non è il `CodeSha256` del pacchetto in AWS: lo zip ricostruito non è stato confrontato come identico a quello in produzione e non è stato pubblicato.

`node --test functions/lambda-immobiliare-leads-handler/tests/handler.test.mjs` con Node v22.14.0: 1 test passato. Copre solo l'evento senza record, che esce prima del login Immobiliare e delle chiamate a Homepanda. Non è uno smoke test sulla funzione AWS.

Il deploy di questa funzione non è preparato.

## lambda-homepanda-whatsapp-bitrix-message

Lettura con il profilo `default`, identità `arn:aws:iam::247981707334:user/user-deploy`, regione `eu-central-1`, il 2026-10-19. Nessuna scrittura. Lo zip distribuito è stato scaricato in memoria e il suo SHA-256 in base64 coincide con `CodeSha256` `b4KiRqFcyeFtHyIcj2qsY3TbgapJd6/HfrFyEb9Ve3U=`.

In Git è entrato il sorgente di quello zip, senza `node_modules`. Sono cinque file: `index.mjs`, `package.json`, `yarn.lock`, `lib/bitrix.mjs`, `lib/secretManager.mjs`. Lo zip contiene 811 file, dipendenze comprese. `node --check` sui tre moduli passa.

| Campo | Valore |
| --- | --- |
| Nome | `lambda-homepanda-whatsapp-bitrix-message` |
| Account | `247981707334` |
| Regione | `eu-central-1` |
| PackageType | Zip |
| Runtime | `nodejs24.x` |
| Handler | `index.handler` |
| Architettura | `x86_64` |
| Memoria | 128 MB |
| Timeout | 3 s |
| Storage temporaneo | 512 MB |
| Layer | nessuno |
| Concorrenza riservata | assente |
| Alias | nessuno |
| Versioni pubblicate | 1, invocazione osservata su `$LATEST` |
| VPC | assente |
| Ruolo | `lambda-homepanda-whatsapp-bitrix-message-role-irqlmjye` |
| Log group | `/aws/lambda/lambda-homepanda-whatsapp-bitrix-message`, retention non impostata |
| Tag | nessuno |
| Resource policy | presente, invocazione consentita da ALB target group `lambda-2bxrbhk7uoto3ebm8ya` |
| Invocazione asincrona | assente |
| Event source mapping | assente |
| Function URL | assente |

Variabili d'ambiente presenti, solo nomi: `BITRIX_URL`, `BITRIX_CLIENT_ID`, `BITRIX_CLIENT_SECRET`. I valori restano sulla funzione.

`node --test functions/lambda-homepanda-whatsapp-bitrix-message/tests/handler.test.mjs`: 1 test passato. Copre la presenza del `basePath('/bitrix')` e l'assenza di una rotta `GET /missing` nel sorgente, senza invocare Secrets Manager o Bitrix.

`BUILD_TARGETS=homepanda-whatsapp-bitrix-message bash scripts/build-selected.sh` produce `dist/homepanda-whatsapp-bitrix-message.zip` con SHA-256 `aa013f9d33e875878ad393633ec87098ec9bdc7626db944c964b55823ccdb544`. L'hash ricostruito non è usato come prova di identicità con il pacchetto in produzione e non viene pubblicato.

## lambda-wikicasa-ads-handler

Lettura con il profilo `default`, identità `arn:aws:iam::247981707334:user/user-deploy`, regione `eu-central-1`, il 2026-10-27. Nessuna scrittura. Lo zip distribuito è stato scaricato in memoria e il suo SHA-256 in base64 coincide con `CodeSha256` `rPLThzdlLVmGMklD9YQ46arO3s5cH1EVBIZjkBvSTC4=`.

In Git è entrato il sorgente di quello zip, senza `node_modules`: `index.mjs`, `package.json`, `yarn.lock`, `handler/homepanda.mjs`, `handler/payload.mjs`, `handler/wikicasa.mjs`. Lo zip contiene anche le dipendenze installate. Runtime AWS `nodejs18.x`, handler `index.handler`, architettura `x86_64`, VPC `vpc-0b801a60`. Event source mapping abilitato su `arn:aws:sqs:eu-central-1:247981707334:WikicasaAds`, batch size 1, invocazione su `$LATEST`.

Variabili d'ambiente presenti, solo nomi: `HOMEPANDA_PROPERTY_SERVICE_URL`, `WIKICASA_PRIVATEKEY`, `WIKICASA_PUBLICKEY`, `WIKICASA_URL`, `WIKICASA_USERID`, `WIKICASA_USERID_HP`, `WIKICASA_USERID_RLB`.

## lambda-idealista-ads-handler

Lettura con il profilo `default`, identità `arn:aws:iam::247981707334:user/user-deploy`, regione `eu-central-1`, il 2026-10-27. Nessuna scrittura. Lo zip distribuito è stato scaricato in memoria e il suo SHA-256 in base64 coincide con `CodeSha256` `X8uDXaqZIxdTumX07bdhiFQYUeoX5WYWBSijAhNS3oU=`.

In Git è entrato il sorgente di quello zip, senza `node_modules` e senza `.vscode`: `index.mjs`, `package.json`, `package-lock.json`, `services/comuni.csv`, `services/findCap.mjs`, `services/homepanda.mjs`, `services/idealista.mjs`, `services/payload.mjs`, `services/redis.mjs`. Runtime AWS `nodejs22.x`, handler `index.handler`, architettura `x86_64`, VPC `vpc-0b801a60`. Event source mapping abilitato su `arn:aws:sqs:eu-central-1:247981707334:IdealistaAds`, batch size 1, invocazione su `$LATEST`.

Variabili d'ambiente presenti, solo nomi: `HOMEPANDA_PROPERTY_SERVICE_URL`, `IDEALISTA_AUTHORIZATION`, `IDEALISTA_CONTACT_ID_HP`, `IDEALISTA_CONTACT_ID_RLB`, `IDEALISTA_FEEDKEY`, `IDEALISTA_FEEDKEY_HP`, `IDEALISTA_FEEDKEY_RLB_EUR`, `IDEALISTA_FEEDKEY_RLB_OST`, `IDEALISTA_FEEDKEY_RLB_PAR`, `IDEALISTA_URL`, `REDIS_HOST`, `REDIS_PORT`.
