#!/usr/bin/env bash
set -euo pipefail

: "${FUNCTION_LOGICAL_NAME:?}"
: "${FUNCTION_NAME:?}"
: "${FUNCTION_RUNTIME:?}"
: "${FUNCTION_ARCH:?}"
: "${FUNCTION_PACKAGE_TYPE:?}"
: "${FUNCTION_ACCOUNT_ID:?}"
: "${FUNCTION_REGION:?}"
: "${FUNCTION_SOURCE_ROOT:?}"
: "${FUNCTION_STRATEGY:?}"
: "${FUNCTION_ARTIFACT:?}"
: "${NODE_VERSION:?}"
: "${NPM_VERSION:?}"
: "${DIST_DIR:?}"

if [[ "$FUNCTION_LOGICAL_NAME" != "idealista-ads-handler" \
  || "$FUNCTION_NAME" != "lambda-idealista-ads-handler" \
  || "$FUNCTION_RUNTIME" != "nodejs22.x" \
  || "$FUNCTION_ARCH" != "x86_64" \
  || "$FUNCTION_PACKAGE_TYPE" != "Zip" \
  || "$FUNCTION_ACCOUNT_ID" != "247981707334" \
  || "$FUNCTION_REGION" != "eu-central-1" \
  || "$FUNCTION_STRATEGY" != "nodejs-zip-npm" \
  || "$FUNCTION_ARTIFACT" != "idealista-ads-handler.zip" \
  || "$NODE_VERSION" != "22.14.0" ]]; then
  echo "Questa ricetta e solo per idealista-ads-handler." >&2
  exit 1
fi

for tool in curl tar zip sha256sum python3; do
  command -v "$tool" >/dev/null
done

src=$FUNCTION_SOURCE_ROOT
for relative in \
  index.mjs \
  package.json \
  package-lock.json \
  services/comuni.csv \
  services/findCap.mjs \
  services/homepanda.mjs \
  services/idealista.mjs \
  services/payload.mjs \
  services/redis.mjs
do
  if [[ ! -f "$src/$relative" ]]; then
    echo "File sorgente mancante: $relative" >&2
    exit 1
  fi
done

source_fingerprint() {
  find "$1" -type f ! -path '*/node_modules/*' -printf '%P\n' | sort | while IFS= read -r relative; do
    sha256sum "$1/$relative"
  done | sha256sum | awk '{print $1}'
}

before_sources=$(source_fingerprint "$src")
toolchain=$(mktemp -d /tmp/hp-toolchain.XXXXXX)
stage=$(mktemp -d /tmp/hp-lambda-stage.XXXXXX)
cleanup() { rm -rf "$toolchain" "$stage"; }
trap cleanup EXIT

mkdir -p "$stage/services"
cp -a "$src/index.mjs" "$src/package.json" "$src/package-lock.json" "$stage/"
cp -a "$src/services/." "$stage/services/"

NODE_SHA256=9d942932535988091034dc94cc5f42b6dc8784d6366df3a36c4c9ccb3996f0c2
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz"

curl --fail --show-error --location --output "$toolchain/node.tar.gz" "$NODE_URL"
actual_node_sha=$(sha256sum "$toolchain/node.tar.gz" | awk '{print $1}')
if [[ "$actual_node_sha" != "$NODE_SHA256" ]]; then
  echo "Checksum SHA-256 di Node non valido." >&2
  exit 1
fi
mkdir -p "$toolchain/node"
tar -xzf "$toolchain/node.tar.gz" -C "$toolchain/node"

node_bin="$toolchain/node/node-v${NODE_VERSION}-linux-x64/bin/node"
npm_cli="$toolchain/node/node-v${NODE_VERSION}-linux-x64/bin/npm"
npm_version=$("$node_bin" "$npm_cli" --version)
if [[ "$npm_version" != "$NPM_VERSION" ]]; then
  echo "Versione npm inattesa: $npm_version" >&2
  exit 1
fi

(
  cd "$stage"
  "$node_bin" "$npm_cli" ci --omit=dev
)

while IFS= read -r file; do
  "$node_bin" --check "$file"
done < <(find "$stage" -name '*.mjs' -not -path '*/node_modules/*' | sort)

python3 - "$stage" << 'PY'
import json
import sys
from pathlib import Path
stage = Path(sys.argv[1])
package = json.loads((stage / "package.json").read_text(encoding="utf-8"))
for dep in ("axios", "csv-parse", "ioredis", "luxon"):
    if dep not in package.get("dependencies", {}):
        raise SystemExit(f"Dipendenza mancante in package.json: {dep}")
    dep_file = stage / "node_modules" / dep / "package.json"
    if not dep_file.is_file():
        raise SystemExit(f"Dipendenza assente nello staging: {dep}")
PY

(
  cd "$stage"
  zip -qr -X "$toolchain/package.zip" . -x '*.DS_Store' '.vscode/*'
)

python3 - "$toolchain/package.zip" << 'PY'
import sys
import zipfile
archive = zipfile.ZipFile(sys.argv[1])
names = archive.namelist()
required = [
    "index.mjs",
    "package.json",
    "package-lock.json",
    "services/comuni.csv",
    "services/findCap.mjs",
    "services/homepanda.mjs",
    "services/idealista.mjs",
    "services/payload.mjs",
    "services/redis.mjs",
    "node_modules/axios/package.json",
    "node_modules/csv-parse/package.json",
    "node_modules/ioredis/package.json",
    "node_modules/luxon/package.json",
]
missing = [name for name in required if name not in names]
prefixed = [name for name in names if name == "src" or name.startswith("src/")]
vscode = [name for name in names if name.startswith(".vscode/")]
if missing or prefixed or vscode:
    raise SystemExit(
        f"Pacchetto non valido. mancanti={missing} prefisso_src={prefixed} vscode={vscode}"
    )
PY

mkdir -p "$DIST_DIR/manifests"
rm -f "$DIST_DIR/$FUNCTION_ARTIFACT"
mv "$toolchain/package.zip" "$DIST_DIR/$FUNCTION_ARTIFACT"
zip_sha=$(sha256sum "$DIST_DIR/$FUNCTION_ARTIFACT" | awk '{print $1}')
release_commit=${CODEBUILD_RESOLVED_SOURCE_VERSION:-}

RELEASE_COMMIT=$release_commit \
RELEASE_NPM_VERSION=$npm_version \
RELEASE_ZIP_SHA256=$zip_sha \
python3 - << 'PY'
import json
import os
from pathlib import Path
manifest = {
    "logicalName": os.environ["FUNCTION_LOGICAL_NAME"],
    "functionName": os.environ["FUNCTION_NAME"],
    "accountId": os.environ["FUNCTION_ACCOUNT_ID"],
    "region": os.environ["FUNCTION_REGION"],
    "packageType": os.environ["FUNCTION_PACKAGE_TYPE"],
    "handler": "index.handler",
    "commit": os.environ.get("RELEASE_COMMIT") or None,
    "runtime": os.environ["FUNCTION_RUNTIME"],
    "architecture": os.environ["FUNCTION_ARCH"],
    "toolchain": {
        "node": os.environ["NODE_VERSION"],
        "npm": os.environ["RELEASE_NPM_VERSION"],
        "pinScope": "function",
    },
    "zipFile": os.environ["FUNCTION_ARTIFACT"],
    "zipSha256": os.environ["RELEASE_ZIP_SHA256"],
    "syntaxCheck": {"performed": True, "functionalTest": False},
}
destination = Path(os.environ["DIST_DIR"]) / "manifests" / (os.environ["FUNCTION_LOGICAL_NAME"] + ".json")
destination.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY

after_sources=$(source_fingerprint "$src")
if [[ "$before_sources" != "$after_sources" ]]; then
  echo "I sorgenti sono stati modificati durante la build." >&2
  exit 1
fi
