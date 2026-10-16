# Pianificazione del rilascio

Questo documento descrive lo stage Plan. Non crea risorse AWS e non modifica la pipeline.

## Source CodeConnections

Lo stage Plan richiede un clone Git completo, non lo zip predefinito della source action.

Da impostare sulla source action CodeConnections (modifica **non applicata** in questo passo):

- Full clone abilitato
- profondità clone non ridotta a 1
- il progetto CodeBuild Plan con source type CodePipeline deve ricevere il repository con `.git`

Senza la storia Git, `git merge-base --is-ancestor` e `git diff` tra commit di stato e HEAD non sono affidabili.

Flusso previsto, da aggiungere in un passo successivo:

```text
Source (full clone)
  -> Plan (buildspec-plan.yml)
  -> Build (buildspec.yml)
  -> Approval
  -> Deploy (buildspec-deploy.yml)
```

In questa fase `scripts/build-selected.sh` continua a richiedere `BUILD_TARGETS`. Lo stage Plan **non** legge `BUILD_TARGETS`.

## Variabili del progetto Plan

Gli script non contengono account, bucket o regione. Il progetto CodeBuild Plan deve definire:

| Variabile | Significato |
| --- | --- |
| `RELEASE_STATE_ACCOUNT_ID` | account atteso di `sts get-caller-identity` |
| `RELEASE_STATE_REGION` | regione dell’oggetto S3 di stato |
| `RELEASE_STATE_BUCKET` | bucket dello stato |
| `RELEASE_STATE_KEY` | chiave dell’oggetto JSON |

Valori attesi in produzione, da configurare sul progetto e non da copiare negli script:

- account `247981707334`
- regione `eu-central-1`
- bucket `codepipeline-eu-central-1-973830173776`
- chiave `release-state/lambda-functions.json`

## Stato S3

Oggetto di sola lettura per il Plan. Schema:

```json
{
  "version": 1,
  "functions": {
    "immobiliare-ads-handler": {
      "functionName": "lambda-immobiliare-ads-handler",
      "commit": "<sha40 o sha64 del commit dell'ultimo deploy riuscito>"
    }
  }
}
```

La chiave in `functions` è il `logicalName`. La scrittura di questo oggetto dopo un deploy riuscito **non** è implementata qui.

Comportamento:

- oggetto assente: tutte le funzioni `unmanaged`, `targets=[]`, exit 0
- JSON non valido, `version` diversa da 1, `functions` non oggetto, `logicalName` sconosciuto, SHA vuoto o `functionName` diverso da `functions.json`: `status=blocked`, report scritti, exit 1

Una funzione senza voce di stato non entra nel piano. Resta unmanaged fino a un primo deploy esplicito.

## Confronto Git

Per ogni funzione con stato valido:

1. il commit di stato deve esistere nel clone;
2. `git merge-base --is-ancestor <commit-stato> <HEAD>` deve riuscire;
3. si confronta **tutta** la `directory` dichiarata in `functions.json`, non solo `src/`. Entrano `build.sh`, Dockerfile, lockfile, manifest, `src/` e ogni altro file della cartella.

Se il commit di stato non è antenato di HEAD, il target è `incomparable`, non viene incluso, non si esegue un diff ambiguo.

## Path che bloccano la selezione automatica

Se il diff tra un commit di stato antenato e HEAD tocca uno di questi path, il piano è `blocked`, `targets=[]`, exit 1 dopo aver scritto i report:

- `shared/`
- `scripts/`
- `buildspec.yml`
- `buildspec-plan.yml`
- `functions.json`
- `buildspec-deploy.yml`
- `infra/`, `iam/`, `.github/`, `pipelines/`, `cloudformation/`, `terraform/` se presenti

Serve allora una selezione manuale. Non si costruisce nessun target in automatico.

Se esiste stato ma nessun commit di stato è antenato di HEAD, il piano è `blocked` perché il diff globale sarebbe ambiguo.

## Artefatti

Sempre scritti in `$CODEBUILD_SRC_DIR`, anche per piano vuoto, stato assente, stato malformato o blocco:

- `release-targets.json` — solo i `logicalName` da costruire (`targets` può essere `[]`)
- `release-plan.json` — classificazione completa
- `release-plan.txt` — report testuale

## IAM previsto per il ruolo Plan (non creato)

- `sts:GetCallerIdentity`
- `s3:GetObject` sull’oggetto di stato

Niente `s3:PutObject`, niente `lambda:UpdateFunctionCode`. I ruoli Build e Deploy non ricevono questi permessi in questo passo.
