# Pianificazione del rilascio

Questo documento descrive Plan, Build e Deploy. Non crea risorse AWS e non modifica la pipeline.

Non esiste un pilota. Entra in `targets` ogni funzione la cui cartella sotto `functions/` è dichiarata in `functions.json` e risulta nuova o modificata rispetto allo stato S3.

## Source CodeConnections

Lo stage Plan richiede un clone Git completo, non lo zip predefinito della source action.

Da impostare sulla source action CodeConnections (modifica **non applicata** in questo passo):

- Full clone abilitato
- profondità clone non ridotta a 1
- il progetto CodeBuild Plan con source type CodePipeline deve ricevere il repository con `.git`

Senza la storia Git, `git merge-base --is-ancestor` e `git diff` tra commit di stato e HEAD non sono affidabili.

Flusso previsto:

```text
Source (full clone)
  -> Plan (buildspec-plan.yml)
  -> Build (buildspec.yml)
  -> Approval
  -> Deploy (buildspec-deploy.yml)
```

Lo stage Plan **non** legge `BUILD_TARGETS`. La build usa `release-targets.json`; `BUILD_TARGETS` è solo un override se il file del piano manca.

## Variabili del progetto Plan e Deploy

Gli script non contengono account, bucket o regione. I progetti CodeBuild Plan e Deploy devono definire:

| Variabile | Significato |
| --- | --- |
| `RELEASE_STATE_ACCOUNT_ID` | account atteso di `sts get-caller-identity` |
| `RELEASE_STATE_REGION` | regione dell’oggetto S3 di stato |
| `RELEASE_STATE_BUCKET` | bucket dello stato |
| `RELEASE_STATE_KEY` | chiave dell’oggetto JSON |
| `MANUAL_TARGETS` | solo se Plan è bloccato da path condivisi: elenco CSV di `logicalName` da includere |

Valori attesi in produzione, da configurare sui progetti e non da copiare negli script:

- account `247981707334`
- regione `eu-central-1`
- bucket `codepipeline-eu-central-1-973830173776`
- chiave `release-state/lambda-functions.json`

## Stato S3

Schema:

```json
{
  "version": 1,
  "functions": {
    "immobiliare-ads-handler": {
      "functionName": "lambda-immobiliare-ads-handler",
      "commit": "<sha del commit dell'ultimo deploy riuscito>"
    }
  }
}
```

La chiave in `functions` è il `logicalName`. Il Plan fa solo `GetObject`. Il Deploy, dopo `update-function-code` riuscito, fa merge e `PutObject` solo per i target andati a buon fine.

Comportamento del Plan:

- oggetto assente: tutte le funzioni in `functions.json` in `targets` (primo rilascio), exit 0
- funzione in catalogo senza voce di stato: inclusa (primo rilascio di quella cartella)
- JSON non valido, `version` diversa da 1, `functions` non oggetto, `logicalName` sconosciuto, SHA vuoto o `functionName` diverso da `functions.json`: `status=blocked`, report scritti, exit 1
- sottocartella di `functions/` assente da `functions.json`: `orphan`, non nei target

`functions.json` non è un path bloccante.

## Confronto Git

Per ogni funzione con stato valido:

1. il commit di stato deve esistere nel clone;
2. `git merge-base --is-ancestor <commit-stato> <HEAD>` deve riuscire;
3. si confronta **tutta** la `directory` dichiarata in `functions.json`, non solo `src/`.

Se il commit di stato non è antenato di HEAD, il target è `incomparable`, non viene incluso.

## Path che bloccano la selezione automatica

Se il diff tra un commit di stato antenato e HEAD tocca uno di questi path, la selezione automatica è sospesa:

- `shared/`
- `scripts/`
- `buildspec.yml`
- `buildspec-plan.yml`
- `buildspec-deploy.yml`
- `infra/`, `iam/`, `.github/`, `pipelines/`, `cloudformation/`, `terraform/` se presenti

Con `MANUAL_TARGETS` impostato sul progetto Plan (CSV di `logicalName` presenti in `functions.json`), Plan emette quei target con `status=selected` e exit 0, lasciando i path bloccanti nel report. Senza `MANUAL_TARGETS`, Plan resta `blocked`, `targets=[]`, exit 1.

Se esiste stato ma nessun commit di stato è antenato di HEAD, il piano è `blocked`.

## Artefatti Plan

Sempre scritti in `$CODEBUILD_SRC_DIR`:

- `release-targets.json`
- `release-plan.json`
- `release-plan.txt`

## Artefatti Build

- `dist/<artifact>.zip` per ogni target
- `dist/manifests/<logicalName>.json`
- `dist/release-manifest.json` con `{ "releases": [ ... ] }`

## Deploy

`scripts/deploy-release.sh` legge `releases[]` da BuildArtifact. Per ogni release verifica la funzione live (PackageType, runtime, architettura, handler, account, regione) usando i campi di **quel** manifesto, poi `update-function-code --no-publish --revision-id`. Default `PLAN=true`. Scritture Lambda e S3 solo con `DEPLOY_CONFIRMED=true`. Un fallimento ferma il resto; lo stato S3 registra solo i successi precedenti. Nessun rollback automatico.

## IAM previsto (non creato)

Ruolo Plan:

- `sts:GetCallerIdentity`
- `s3:GetObject` sull’oggetto di stato

Ruolo Deploy:

- `sts:GetCallerIdentity`
- `lambda:GetFunction`, `lambda:GetFunctionConfiguration`, `lambda:UpdateFunctionCode` sugli ARN delle funzioni in catalogo
- `s3:GetObject` e `s3:PutObject` sull’oggetto di stato

Questi permessi non vanno sul ruolo Build.
