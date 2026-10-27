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
: "${YARN_VERSION:?}"
: "${DIST_DIR:?}"

if [[ "$FUNCTION_LOGICAL_NAME" != "wikicasa-ads-handler" \
  || "$FUNCTION_NAME" != "lambda-wikicasa-ads-handler" \
  || "$FUNCTION_RUNTIME" != "nodejs18.x" \
  || "$FUNCTION_ARCH" != "x86_64" \
  || "$FUNCTION_PACKAGE_TYPE" != "Zip" \
  || "$FUNCTION_ACCOUNT_ID" != "247981707334" \
  || "$FUNCTION_REGION" != "eu-central-1" \
  || "$FUNCTION_STRATEGY" != "nodejs-zip-yarn-classic" \
  || "$FUNCTION_ARTIFACT" != "wikicasa-ads-handler.zip" \
  || "$NODE_VERSION" != "18.20.8" \
  || "$YARN_VERSION" != "1.22.22" ]]; then
  echo "Questa ricetta e solo per wikicasa-ads-handler." >&2
  exit 1
fi

for tool in curl tar zip sha256sum python3; do
  command -v "$tool" >/dev/null
done

src=$FUNCTION_SOURCE_ROOT
for relative in \
  index.mjs \
  package.json \
  yarn.lock \
  handler/homepanda.mjs \
  handler/payload.mjs \
  handler/wikicasa.mjs
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

mkdir -p "$stage/handler"
cp -a "$src/index.mjs" "$src/package.json" "$src/yarn.lock" "$stage/"
cp -a "$src/handler/." "$stage/handler/"

NODE_SHA256=27a9f3f14d5e99ad05a07ed3524ba3ee92f8ff8b6db5ff80b00f9feb5ec8097a
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz"
YARN_URL="https://registry.npmjs.org/yarn/-/yarn-${YARN_VERSION}.tgz"
YARN_SHA512=prL3kGtyG7o9Z9Sv8IPfBNrWTDmXB4Qbes8A9rEzt6wkJV8mUvoirjU0Mp3GGAU06Y0XQyA3/2/RQFVuK7MTfg==

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

curl --fail --show-error --location --output "$toolchain/yarn.tgz" "$YARN_URL"
python3 - "$toolchain/yarn.tgz" "$YARN_SHA512" << 'PY'
import base64
import hashlib
import pathlib
import sys
payload = pathlib.Path(sys.argv[1]).read_bytes()
expected = sys.argv[2]
actual = base64.b64encode(hashlib.sha512(payload).digest()).decode()
if actual != expected:
    raise SystemExit("Checksum di Yarn non valido.")
PY
mkdir -p "$toolchain/yarn"
tar -xzf "$toolchain/yarn.tgz" -C "$toolchain/yarn"
yarn_js=$toolchain/yarn/package/bin/yarn.js

(
  cd "$stage"
  YARN_CACHE_FOLDER="$toolchain/yarn-cache" \
    "$node_bin" "$yarn_js" install --frozen-lockfile --production=true --non-interactive
)

while IFS= read -r file; do
  "$node_bin" --check "$file"
done < <(find "$stage" -name '*.mjs' -not -path '*/node_modules/*' | sort)

(
  cd "$stage"
  zip -qr -X "$toolchain/package.zip" . -x '*.DS_Store'
)

python3 - "$toolchain/package.zip" << 'PY'
import sys
import zipfile
archive = zipfile.ZipFile(sys.argv[1])
names = archive.namelist()
required = [
    "index.mjs",
    "package.json",
    "yarn.lock",
    "handler/homepanda.mjs",
    "handler/payload.mjs",
    "handler/wikicasa.mjs",
    "node_modules/axios/package.json",
    "node_modules/csv-parse/package.json",
    "node_modules/luxon/package.json",
]
missing = [name for name in required if name not in names]
prefixed = [name for name in names if name == "src" or name.startswith("src/")]
if missing or prefixed:
    raise SystemExit(f"Pacchetto non valido. mancanti={missing} prefisso_src={prefixed}")
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
        "yarn": os.environ["YARN_VERSION"],
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
