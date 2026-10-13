#!/usr/bin/env bash
# Deploy del solo pilota da artefatti di build già approvati.
# Non clona repository, non ricostruisce lo zip e non legge BUILD_TARGETS.
set -euo pipefail

PILOT_LOGICAL_NAME=immobiliare-ads-handler
PILOT_FUNCTION_NAME=lambda-immobiliare-ads-handler
PILOT_ACCOUNT_ID=247981707334
PILOT_REGION=eu-central-1
PILOT_RUNTIME=nodejs22.x
PILOT_ARCHITECTURE=x86_64
PILOT_PACKAGE_TYPE=Zip
PILOT_HANDLER=index.handler

interrupt() {
  echo "Interruzione: $*" >&2
  exit 1
}

if [[ $# -eq 1 ]]; then
  BUILD_ARTIFACT_DIR=$1
elif [[ -n "${BUILD_ARTIFACT_DIR:-}" ]]; then
  :
else
  interrupt "passare BUILD_ARTIFACT_DIR come argomento o variabile d'ambiente."
fi

if [[ -z "$BUILD_ARTIFACT_DIR" ]]; then
  interrupt "BUILD_ARTIFACT_DIR è vuoto."
fi

source_root=${CODEBUILD_SRC_DIR:-}
if [[ -n "$source_root" ]]; then
  artifact_resolved=$(cd "$BUILD_ARTIFACT_DIR" && pwd)
  source_resolved=$(cd "$source_root" && pwd)
  if [[ "$artifact_resolved" == "$source_resolved" ]]; then
    interrupt "BUILD_ARTIFACT_DIR coincide con SourceArtifact. ZIP e manifesto vanno letti da BuildArtifact."
  fi
fi

manifest_path=$BUILD_ARTIFACT_DIR/release-manifest.json
[[ -f "$manifest_path" ]] || interrupt "manca $manifest_path"

plan_path=${CODEBUILD_SRC_DIR:-.}/deploy-plan.json
mkdir -p "$(dirname "$plan_path")"

eval "$(python3 - "$manifest_path" "$BUILD_ARTIFACT_DIR" "$PILOT_LOGICAL_NAME" \
  "$PILOT_FUNCTION_NAME" "$PILOT_ACCOUNT_ID" "$PILOT_REGION" "$PILOT_RUNTIME" \
  "$PILOT_ARCHITECTURE" "$PILOT_PACKAGE_TYPE" "$PILOT_HANDLER" << 'PY'
import hashlib
import json
import os
import shlex
import sys
from pathlib import Path

(
    manifest_path,
    artifact_dir,
    logical,
    function_name,
    account,
    region,
    runtime,
    architecture,
    package_type,
    handler,
) = sys.argv[1:]

data = json.loads(Path(manifest_path).read_text(encoding="utf-8"))

def fail(message):
    sys.stderr.write(message + "\n")
    sys.exit(1)

if data.get("logicalName") != logical:
    fail(f"logicalName inatteso: {data.get('logicalName')}")
if data.get("functionName") != function_name:
    fail("functionName mancante o diverso dal nome AWS verificato. Non si deduce dalla cartella.")
if data.get("accountId") != account:
    fail(f"accountId inatteso: {data.get('accountId')}")
if data.get("region") != region:
    fail(f"region inattesa: {data.get('region')}")
if data.get("runtime") != runtime:
    fail(f"runtime inatteso: {data.get('runtime')}")
if data.get("architecture") != architecture:
    fail(f"architecture inattesa: {data.get('architecture')}")

if "packageType" in data and data["packageType"] != package_type:
    fail(f"packageType nel manifesto diverso dal contratto pilota: {data['packageType']}")
if "handler" in data and data["handler"] != handler:
    fail(f"handler nel manifesto diverso dal contratto pilota: {data['handler']}")
if "packageType" not in data or "handler" not in data:
    sys.stderr.write(
        "Avviso: packageType/handler assenti dal manifesto. "
        "Si usa il contratto fisso del pilota e si verifica live. "
        "Il manifesto deve diventare autosufficiente prima di generalizzare.\n"
    )

zip_name = data.get("zipFile")
zip_sha = data.get("zipSha256")
if not zip_name or not zip_sha:
    fail("zipFile o zipSha256 mancanti nel manifesto.")
if os.path.basename(zip_name) != zip_name or "/" in zip_name or zip_name in (".", ".."):
    fail("zipFile deve essere un nome file nella directory BuildArtifact.")

zip_path = str(Path(artifact_dir) / zip_name)
zip_file = Path(zip_path)
if not zip_file.is_file():
    fail(f"ZIP assente in BuildArtifact: {zip_path}")

actual = hashlib.sha256(zip_file.read_bytes()).hexdigest()
if actual != zip_sha:
    fail(f"SHA-256 dello ZIP diverso dal manifesto. atteso={zip_sha} attuale={actual}")

assignments = {
    "FUNCTION_LOGICAL_NAME": logical,
    "FUNCTION_NAME": function_name,
    "FUNCTION_ACCOUNT_ID": account,
    "FUNCTION_REGION": region,
    "FUNCTION_RUNTIME": runtime,
    "FUNCTION_ARCH": architecture,
    "FUNCTION_PACKAGE_TYPE": data.get("packageType") or package_type,
    "FUNCTION_HANDLER": data.get("handler") or handler,
    "ZIP_PATH": zip_path,
    "ZIP_SHA256_HEX": zip_sha,
    "RELEASE_COMMIT": data.get("commit") or "",
}
for key, value in assignments.items():
    print(f"{key}={shlex.quote(str(value))}")
PY
)"

identity=$(aws sts get-caller-identity --output json)
eval "$(python3 - "$identity" "$FUNCTION_ACCOUNT_ID" << 'PY'
import json, shlex, sys
identity = json.loads(sys.argv[1])
expected = sys.argv[2]
account = identity.get("Account")
if account != expected:
    sys.stderr.write(f"Account STS {account} diverso da {expected}.\n")
    sys.exit(1)
print("STS_ARN=" + shlex.quote(identity.get("Arn", "")))
PY
)"

config=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$FUNCTION_REGION" \
  --output json)

eval "$(python3 - "$config" "$FUNCTION_NAME" "$FUNCTION_ACCOUNT_ID" "$FUNCTION_REGION" \
  "$FUNCTION_RUNTIME" "$FUNCTION_ARCH" "$FUNCTION_PACKAGE_TYPE" "$FUNCTION_HANDLER" \
  "$ZIP_SHA256_HEX" << 'PY'
import base64
import binascii
import json
import shlex
import sys

(
    config_raw,
    function_name,
    account,
    region,
    runtime,
    architecture,
    package_type,
    handler,
    zip_sha_hex,
) = sys.argv[1:]
cfg = json.loads(config_raw)

def fail(message):
    sys.stderr.write(message + "\n")
    sys.exit(1)

arn = cfg.get("FunctionArn", "")
expected_arn = f"arn:aws:lambda:{region}:{account}:function:{function_name}"
if cfg.get("FunctionName") != function_name:
    fail(f"Nome funzione live diverso: {cfg.get('FunctionName')}")
if arn != expected_arn and not arn.startswith(expected_arn + ":"):
    fail(f"ARN inatteso: {arn}")
if cfg.get("PackageType") != package_type:
    fail(f"PackageType live {cfg.get('PackageType')} diverso da {package_type}")
if cfg.get("Runtime") != runtime:
    fail(f"Runtime live {cfg.get('Runtime')} diverso da {runtime}")
if cfg.get("Handler") != handler:
    fail(f"Handler live {cfg.get('Handler')} diverso da {handler}")
arches = cfg.get("Architectures") or []
if arches != [architecture]:
    fail(f"Architectures live {arches} diverse da [{architecture}]")
if cfg.get("State") != "Active":
    fail(f"State live {cfg.get('State')} diverso da Active")

revision = cfg.get("RevisionId")
previous_sha = cfg.get("CodeSha256")
if not revision or not previous_sha:
    fail("RevisionId o CodeSha256 assenti nella configurazione live.")

expected_b64 = base64.b64encode(binascii.unhexlify(zip_sha_hex)).decode()
print("LIVE_REVISION_ID=" + shlex.quote(revision))
print("LIVE_CODE_SHA256=" + shlex.quote(previous_sha))
print("EXPECTED_CODE_SHA256=" + shlex.quote(expected_b64))
print("LIVE_LAST_MODIFIED=" + shlex.quote(cfg.get("LastModified") or ""))
PY
)"

python3 - "$plan_path" << PY
import json
from pathlib import Path
Path("$plan_path").write_text(json.dumps({
    "mode": "plan",
    "logicalName": "$FUNCTION_LOGICAL_NAME",
    "functionName": "$FUNCTION_NAME",
    "accountId": "$FUNCTION_ACCOUNT_ID",
    "region": "$FUNCTION_REGION",
    "commit": "$RELEASE_COMMIT" or None,
    "artifact": "$ZIP_PATH",
    "zipSha256": "$ZIP_SHA256_HEX",
    "previousCodeSha256": "$LIVE_CODE_SHA256",
    "expectedCodeSha256": "$EXPECTED_CODE_SHA256",
    "revisionId": "$LIVE_REVISION_ID",
    "publish": False,
    "stsArn": "$STS_ARN",
    "lastModified": "$LIVE_LAST_MODIFIED",
}, indent=2) + "\n", encoding="utf-8")
PY

echo "Piano di deploy"
echo "  functionName:         $FUNCTION_NAME"
echo "  logicalName:          $FUNCTION_LOGICAL_NAME"
echo "  account/region:       $FUNCTION_ACCOUNT_ID $FUNCTION_REGION"
echo "  ZIP:                  $ZIP_PATH"
echo "  SHA precedente:       $LIVE_CODE_SHA256"
echo "  SHA nuovo (atteso):   $EXPECTED_CODE_SHA256"
echo "  RevisionId:           $LIVE_REVISION_ID"
echo "  publish:              false"
echo "  commit:               ${RELEASE_COMMIT:-assente}"
echo "  piano:                $plan_path"

plan_mode=${PLAN:-true}
confirmed=${DEPLOY_CONFIRMED:-false}

if [[ "$plan_mode" == "true" ]]; then
  echo "PLAN=true: nessuna scrittura Lambda."
  exit 0
fi

if [[ "$confirmed" != "true" ]]; then
  interrupt "deploy effettivo richiede DEPLOY_CONFIRMED=true (e PLAN diverso da true)."
fi

echo "DEPLOY_CONFIRMED=true: update-function-code su $FUNCTION_NAME"

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://${ZIP_PATH}" \
  --revision-id "$LIVE_REVISION_ID" \
  --no-publish \
  --region "$FUNCTION_REGION"

aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$FUNCTION_REGION"

after=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$FUNCTION_REGION" \
  --output json)

python3 - "$after" "$EXPECTED_CODE_SHA256" "$LIVE_CODE_SHA256" "$LIVE_REVISION_ID" \
  "$FUNCTION_NAME" "$FUNCTION_REGION" "$ZIP_PATH" << 'PY'
import json
import sys

after = json.loads(sys.argv[1])
expected = sys.argv[2]
previous = sys.argv[3]
revision = sys.argv[4]
function_name = sys.argv[5]
region = sys.argv[6]
zip_path = sys.argv[7]
actual = after.get("CodeSha256")
if actual == expected:
    sys.exit(0)

sys.stderr.write(
    "Controllo SHA finale fallito. Nessun rollback automatico.\n"
    f"  CodeSha256 atteso: {expected}\n"
    f"  CodeSha256 letto:  {actual}\n"
    f"  CodeSha256 prima:  {previous}\n"
    f"  RevisionId usato:  {revision}\n"
    "Ripristino manuale: conservare il pacchetto precedente fuori da Git e eseguire\n"
    f"  aws lambda update-function-code --function-name {function_name} "
    f"--zip-file fileb://<zip-precedente> --revision-id <RevisionId attuale> "
    f"--no-publish --region {region}\n"
    f"Non riusare lo ZIP rifiutato: {zip_path}\n"
)
sys.exit(1)
PY

echo "CodeSha256 post-update coincide con l'artefatto."
