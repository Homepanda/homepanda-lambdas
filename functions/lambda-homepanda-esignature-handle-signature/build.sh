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
: "${DIST_DIR:?}"

if [[ "$FUNCTION_LOGICAL_NAME" != "homepanda-esignature-handle-signature" \
  || "$FUNCTION_NAME" != "lambda-homepanda-esignature-handle-signature" \
  || "$FUNCTION_RUNTIME" != "nodejs24.x" \
  || "$FUNCTION_ARCH" != "x86_64" \
  || "$FUNCTION_PACKAGE_TYPE" != "Zip" \
  || "$FUNCTION_ACCOUNT_ID" != "247981707334" \
  || "$FUNCTION_REGION" != "eu-central-1" \
  || "$FUNCTION_STRATEGY" != "nodejs-zip" \
  || "$FUNCTION_ARTIFACT" != "homepanda-esignature-handle-signature.zip" \
  || "$NODE_VERSION" != "24.11.0" ]]; then
  echo "Questa ricetta è solo per homepanda-esignature-handle-signature." >&2
  exit 1
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  echo "Il progetto x86_64 rifiuta un host diverso da x86_64." >&2
  exit 1
fi

for tool in curl tar zip sha256sum python3; do
  command -v "$tool" >/dev/null
done

src=$FUNCTION_SOURCE_ROOT
if [[ ! -f "$src/index.mjs" ]]; then
  echo "File sorgente mancante: index.mjs" >&2
  exit 1
fi

source_fingerprint() {
  find "$1" -type f -printf '%P\n' | sort | while IFS= read -r relative; do
    sha256sum "$1/$relative"
  done | sha256sum | awk '{print $1}'
}

before_sources=$(source_fingerprint "$src")
toolchain=$(mktemp -d /tmp/hp-toolchain.XXXXXX)
stage=$(mktemp -d /tmp/hp-lambda-stage.XXXXXX)
cleanup() { rm -rf "$toolchain" "$stage"; }
trap cleanup EXIT

cp -a "$src/index.mjs" "$stage/"

NODE_SHA256=b3c071cdf47aab867c3b2aa287257df12ec5d7c962bf922b32fd33226c4295fd
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
node_version=$("$node_bin" --version)
npm_version=$("$node_bin" "$npm_cli" --version)
if [[ "$node_version" != "v${NODE_VERSION}" || -z "$npm_version" ]]; then
  echo "Versione Node o npm inattesa: node=${node_version} npm=${npm_version}" >&2
  exit 1
fi
echo "Toolchain: node ${node_version}, npm ${npm_version}"

"$node_bin" --check "$stage/index.mjs"

(
  cd "$stage"
  zip -qr -X "$toolchain/package.zip" index.mjs
)

python3 - "$toolchain/package.zip" << 'PY'
import sys
import zipfile

archive = zipfile.ZipFile(sys.argv[1])
names = archive.namelist()
if names != ["index.mjs"]:
    raise SystemExit(f"Pacchetto non valido. contenuto={names}")
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

echo "Pacchetto: $DIST_DIR/$FUNCTION_ARTIFACT"
echo "SHA-256: $zip_sha"
