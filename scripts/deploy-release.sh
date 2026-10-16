#!/usr/bin/env bash
# Deploy delle funzioni selezionate dal piano, dagli artefatti di build.
# Non clona, non ricostruisce ZIP e non legge BUILD_TARGETS.
set -euo pipefail

interrupt() {
  echo "Interruzione: $*" >&2
  exit 1
}

if [[ -z "${CODEBUILD_SRC_DIR:-}" ]]; then
  interrupt "CODEBUILD_SRC_DIR è obbligatorio. deploy-plan.json si scrive solo lì."
fi

if [[ $# -eq 1 && -n "${1:-}" ]]; then
  BUILD_ARTIFACT_DIR=$1
elif [[ -n "${CODEBUILD_SRC_DIR_BuildArtifact:-}" ]]; then
  BUILD_ARTIFACT_DIR=$CODEBUILD_SRC_DIR_BuildArtifact
else
  interrupt "directory BuildArtifact assente. Usare CODEBUILD_SRC_DIR_BuildArtifact, non una variabile di pipeline."
fi

if [[ -z "$BUILD_ARTIFACT_DIR" ]]; then
  interrupt "BUILD_ARTIFACT_DIR è vuoto."
fi

artifact_resolved=$(cd "$BUILD_ARTIFACT_DIR" && pwd)
source_resolved=$(cd "$CODEBUILD_SRC_DIR" && pwd)
if [[ "$artifact_resolved" == "$source_resolved" ]]; then
  interrupt "BUILD_ARTIFACT_DIR coincide con SourceArtifact. ZIP e manifesto vanno letti da BuildArtifact."
fi

manifest_path=$BUILD_ARTIFACT_DIR/release-manifest.json
[[ -f "$manifest_path" ]] || interrupt "manca $manifest_path"

plan_path=$CODEBUILD_SRC_DIR/deploy-plan.json
if [[ "$plan_path" == "$artifact_resolved"/* ]]; then
  interrupt "deploy-plan.json non deve essere scritto in BuildArtifact."
fi

export BUILD_ARTIFACT_DIR
export PLAN=${PLAN:-true}
export DEPLOY_CONFIRMED=${DEPLOY_CONFIRMED:-false}
export DEPLOY_PLAN_PATH=$plan_path

python3 - << 'PY'
import base64
import binascii
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

artifact_dir = Path(os.environ["BUILD_ARTIFACT_DIR"])
manifest_path = artifact_dir / "release-manifest.json"
plan_path = Path(os.environ["DEPLOY_PLAN_PATH"])
plan_mode = os.environ.get("PLAN", "true") == "true"
confirmed = os.environ.get("DEPLOY_CONFIRMED", "false") == "true"


def fail(message, code=1):
    sys.stderr.write("Interruzione: " + message + "\n")
    raise SystemExit(code)


def run_aws(args, check=True):
    result = subprocess.run(
        ["aws", *args],
        text=True,
        capture_output=True,
        check=False,
    )
    if check and result.returncode != 0:
        fail(result.stderr.strip() or "comando aws fallito")
    return result


raw = json.loads(manifest_path.read_text(encoding="utf-8"))
if isinstance(raw, dict) and isinstance(raw.get("releases"), list):
    releases = raw["releases"]
elif isinstance(raw, dict) and raw.get("functionName"):
    releases = [raw]
else:
    fail("release-manifest.json deve contenere releases[]")

prepared = []
for data in releases:
    if not isinstance(data, dict):
        fail("release non è un oggetto")
    logical = data.get("logicalName")
    function_name = data.get("functionName")
    account = data.get("accountId")
    region = data.get("region")
    runtime = data.get("runtime")
    architecture = data.get("architecture")
    package_type = data.get("packageType") or "Zip"
    handler = data.get("handler") or "index.handler"
    zip_name = data.get("zipFile")
    zip_sha = data.get("zipSha256")
    commit = data.get("commit") or ""
    if not all([logical, function_name, account, region, runtime, architecture, zip_name, zip_sha]):
        fail(f"{logical or '?'}: manifesto incompleto")
    if os.path.basename(zip_name) != zip_name or "/" in zip_name:
        fail(f"{logical}: zipFile deve stare in BuildArtifact")
    zip_path = artifact_dir / zip_name
    if not zip_path.is_file():
        fail(f"{logical}: ZIP assente {zip_path}")
    actual = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    if actual != zip_sha:
        fail(f"{logical}: SHA-256 ZIP diverso. atteso={zip_sha} attuale={actual}")
    prepared.append(
        {
            "logicalName": logical,
            "functionName": function_name,
            "accountId": account,
            "region": region,
            "runtime": runtime,
            "architecture": architecture,
            "packageType": package_type,
            "handler": handler,
            "zipPath": str(zip_path),
            "zipSha256": zip_sha,
            "commit": commit,
        }
    )

identity = json.loads(run_aws(["sts", "get-caller-identity", "--output", "json"]).stdout)
sts_account = identity.get("Account")
sts_arn = identity.get("Arn", "")
for item in prepared:
    if item["accountId"] != sts_account:
        fail(f"{item['logicalName']}: account manifesto {item['accountId']} diverso da STS {sts_account}")

live_plans = []
for item in prepared:
    cfg = json.loads(
        run_aws(
            [
                "lambda",
                "get-function-configuration",
                "--function-name",
                item["functionName"],
                "--region",
                item["region"],
                "--output",
                "json",
            ]
        ).stdout
    )
    arn = cfg.get("FunctionArn", "")
    expected_arn = (
        f"arn:aws:lambda:{item['region']}:{item['accountId']}:function:{item['functionName']}"
    )
    if cfg.get("FunctionName") != item["functionName"]:
        fail(f"{item['logicalName']}: nome live {cfg.get('FunctionName')}")
    if arn != expected_arn and not arn.startswith(expected_arn + ":"):
        fail(f"{item['logicalName']}: ARN inatteso {arn}")
    if cfg.get("PackageType") != item["packageType"]:
        fail(f"{item['logicalName']}: PackageType live {cfg.get('PackageType')}")
    if cfg.get("Runtime") != item["runtime"]:
        fail(f"{item['logicalName']}: Runtime live {cfg.get('Runtime')}")
    if cfg.get("Handler") != item["handler"]:
        fail(f"{item['logicalName']}: Handler live {cfg.get('Handler')}")
    if (cfg.get("Architectures") or []) != [item["architecture"]]:
        fail(f"{item['logicalName']}: Architectures live {cfg.get('Architectures')}")
    if cfg.get("State") != "Active":
        fail(f"{item['logicalName']}: State {cfg.get('State')}")
    revision = cfg.get("RevisionId")
    previous_sha = cfg.get("CodeSha256")
    if not revision or not previous_sha:
        fail(f"{item['logicalName']}: RevisionId o CodeSha256 assenti")
    expected_b64 = base64.b64encode(binascii.unhexlify(item["zipSha256"])).decode()
    live_plans.append(
        {
            **item,
            "previousCodeSha256": previous_sha,
            "expectedCodeSha256": expected_b64,
            "revisionId": revision,
            "lastModified": cfg.get("LastModified") or "",
        }
    )

plan_doc = {
    "mode": "plan",
    "publish": False,
    "stsArn": sts_arn,
    "releases": [
        {
            "logicalName": item["logicalName"],
            "functionName": item["functionName"],
            "accountId": item["accountId"],
            "region": item["region"],
            "commit": item["commit"] or None,
            "artifact": item["zipPath"],
            "zipSha256": item["zipSha256"],
            "previousCodeSha256": item["previousCodeSha256"],
            "expectedCodeSha256": item["expectedCodeSha256"],
            "revisionId": item["revisionId"],
        }
        for item in live_plans
    ],
}
plan_path.write_text(json.dumps(plan_doc, indent=2) + "\n", encoding="utf-8")

print("Piano di deploy")
for item in live_plans:
    print(f"  functionName:       {item['functionName']}")
    print(f"  logicalName:        {item['logicalName']}")
    print(f"  ZIP:                {item['zipPath']}")
    print(f"  SHA precedente:     {item['previousCodeSha256']}")
    print(f"  SHA nuovo:          {item['expectedCodeSha256']}")
    print(f"  RevisionId:         {item['revisionId']}")
print(f"  piano:              {plan_path}")

if plan_mode:
    print("PLAN=true: nessuna scrittura Lambda.")
    raise SystemExit(0)
if not confirmed:
    fail("deploy effettivo richiede DEPLOY_CONFIRMED=true (e PLAN diverso da true).")

account = os.environ.get("RELEASE_STATE_ACCOUNT_ID", "").strip()
region = os.environ.get("RELEASE_STATE_REGION", "").strip()
bucket = os.environ.get("RELEASE_STATE_BUCKET", "").strip()
key = os.environ.get("RELEASE_STATE_KEY", "").strip()
if not all([account, region, bucket, key]):
    fail("RELEASE_STATE_ACCOUNT_ID, REGION, BUCKET e KEY sono obbligatori per il deploy.")
if account != sts_account:
    fail("RELEASE_STATE_ACCOUNT_ID diverso dall'account STS.")


def load_state():
    dest = tempfile.NamedTemporaryFile(delete=False)
    dest.close()
    result = run_aws(
        [
            "s3api",
            "get-object",
            "--bucket",
            bucket,
            "--key",
            key,
            "--region",
            region,
            dest.name,
        ],
        check=False,
    )
    err = (result.stderr or "") + (result.stdout or "")
    if result.returncode != 0:
        os.unlink(dest.name)
        if "NoSuchKey" in err or "404" in err or "Not Found" in err:
            return {"version": 1, "functions": {}}
        fail("lettura stato S3 fallita: " + err.strip())
    try:
        data = json.loads(Path(dest.name).read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        data = {"version": 1, "functions": {}}
    os.unlink(dest.name)
    if not isinstance(data, dict):
        data = {"version": 1, "functions": {}}
    data["version"] = 1
    if not isinstance(data.get("functions"), dict):
        data["functions"] = {}
    return data


def save_state(successes):
    if not successes:
        return
    data = load_state()
    for item in successes:
        commit = item.get("commit") or ""
        if not commit:
            fail(f"{item['logicalName']}: commit assente, stato S3 non aggiornato.")
        data["functions"][item["logicalName"]] = {
            "functionName": item["functionName"],
            "commit": commit,
        }
    body = tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8")
    json.dump(data, body, indent=2)
    body.write("\n")
    body.close()
    run_aws(
        [
            "s3api",
            "put-object",
            "--bucket",
            bucket,
            "--key",
            key,
            "--region",
            region,
            "--body",
            body.name,
            "--content-type",
            "application/json",
        ]
    )
    os.unlink(body.name)
    print("Stato S3 aggiornato per: " + ", ".join(i["logicalName"] for i in successes))


successes = []
for item in live_plans:
    print(f"DEPLOY_CONFIRMED=true: update-function-code su {item['functionName']}")
    run_aws(
        [
            "lambda",
            "update-function-code",
            "--function-name",
            item["functionName"],
            "--zip-file",
            f"fileb://{item['zipPath']}",
            "--revision-id",
            item["revisionId"],
            "--no-publish",
            "--region",
            item["region"],
        ]
    )
    run_aws(
        [
            "lambda",
            "wait",
            "function-updated",
            "--function-name",
            item["functionName"],
            "--region",
            item["region"],
        ]
    )
    after = json.loads(
        run_aws(
            [
                "lambda",
                "get-function-configuration",
                "--function-name",
                item["functionName"],
                "--region",
                item["region"],
                "--output",
                "json",
            ]
        ).stdout
    )
    actual = after.get("CodeSha256")
    if actual != item["expectedCodeSha256"]:
        save_state(successes)
        sys.stderr.write(
            "Controllo SHA finale fallito. Nessun rollback automatico.\n"
            f"  funzione: {item['functionName']}\n"
            f"  CodeSha256 atteso: {item['expectedCodeSha256']}\n"
            f"  CodeSha256 letto:  {actual}\n"
            f"  CodeSha256 prima:  {item['previousCodeSha256']}\n"
            "Ripristino manuale con lo zip precedente, --no-publish e il RevisionId attuale.\n"
        )
        raise SystemExit(1)
    print(f"CodeSha256 post-update coincide per {item['logicalName']}.")
    successes.append(item)

save_state(successes)
PY
