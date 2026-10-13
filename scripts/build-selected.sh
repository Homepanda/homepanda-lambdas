#!/usr/bin/env bash
# Orchestratore del progetto CodeBuild condiviso.
# Non installa runtime e non applica la ricetta di una funzione alle altre.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MANIFEST=${FUNCTIONS_MANIFEST:-$ROOT/functions.json}

interrupt() {
  echo "Interruzione prima dell'installazione delle dipendenze: $*" >&2
  exit 1
}

if [[ ! -v BUILD_TARGETS ]]; then
  interrupt "BUILD_TARGETS è obbligatorio."
fi

stripped=${BUILD_TARGETS//[[:space:],]/}
if [[ -z "$stripped" ]]; then
  interrupt "BUILD_TARGETS è vuoto."
fi

if [[ ! -f "$MANIFEST" ]]; then
  interrupt "manifest mancante: $MANIFEST"
fi

plan=$(mktemp)
trap 'rm -f "$plan"' EXIT

if ! BUILD_TARGETS="$BUILD_TARGETS" python3 - "$MANIFEST" "$plan" "$ROOT" << 'PY'
import json
import os
import sys
from pathlib import Path

manifest_path, plan_path, root_arg = sys.argv[1:]
root = Path(root_arg).resolve()
raw = os.environ.get("BUILD_TARGETS")
if raw is None or raw.strip() == "":
    sys.stderr.write("BUILD_TARGETS è obbligatorio.\n")
    sys.exit(1)

parts = [part.strip() for part in raw.split(",")]
if any(part == "" for part in parts):
    sys.stderr.write("BUILD_TARGETS contiene un target vuoto.\n")
    sys.exit(1)
if len(parts) != len(set(parts)):
    sys.stderr.write("BUILD_TARGETS contiene target duplicati.\n")
    sys.exit(1)

data = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
if data.get("projectArchitecture") != "x86_64":
    sys.stderr.write("Il progetto condiviso atteso è x86_64.\n")
    sys.exit(1)

by_name = {}
for entry in data.get("functions", []):
    logical = entry.get("logicalName")
    if not isinstance(logical, str) or not logical:
        sys.stderr.write("Voce del manifest senza logicalName.\n")
        sys.exit(1)
    if logical in by_name:
        sys.stderr.write(f"logicalName duplicato nel manifest: {logical}\n")
        sys.exit(1)
    by_name[logical] = entry

plan = []
for name in parts:
    entry = by_name.get(name)
    if entry is None:
        sys.stderr.write(f"Target sconosciuto: {name}\n")
        sys.exit(1)

    architecture = entry.get("architecture")
    if architecture == "arm64":
        sys.stderr.write(f"Il progetto x86_64 rifiuta il target arm64: {name}\n")
        sys.exit(1)
    if architecture != "x86_64":
        sys.stderr.write(
            f"Architettura non supportata da questo progetto x86_64: {architecture}\n"
        )
        sys.exit(1)

    package_type = entry.get("packageType")
    if package_type != "Zip":
        sys.stderr.write(f"PackageType non implementato: {package_type}\n")
        sys.exit(1)

    build = entry.get("build") or {}
    strategy = build.get("strategy")
    if strategy != "nodejs-zip-yarn-classic":
        sys.stderr.write(f"Strategia non implementata: {strategy}\n")
        sys.exit(1)

    function_name = entry.get("functionName")
    if not isinstance(function_name, str) or not function_name.strip():
        sys.stderr.write(
            f"{name}: functionName mancante. Il nome AWS non viene dedotto dalla cartella.\n"
        )
        sys.exit(1)

    for field in ("accountId", "region", "runtime", "directory"):
        if not entry.get(field):
            sys.stderr.write(f"{name}: campo mancante {field}\n")
            sys.exit(1)

    toolchain = build.get("toolchain") or {}
    for field in ("language", "version", "packageManager", "packageManagerVersion"):
        if not toolchain.get(field):
            sys.stderr.write(f"{name}: toolchain.{field} mancante\n")
            sys.exit(1)
    if toolchain.get("language") != "nodejs":
        sys.stderr.write(f"Linguaggio non implementato: {toolchain.get('language')}\n")
        sys.exit(1)

    script_rel = build.get("script")
    source_rel = build.get("sourceRoot")
    artifact = build.get("artifact")
    if not script_rel or not source_rel or not artifact:
        sys.stderr.write(f"{name}: build.script, sourceRoot o artifact mancante\n")
        sys.exit(1)
    if "/" in script_rel or script_rel.startswith("."):
        sys.stderr.write(f"{name}: build.script deve stare nella cartella della funzione.\n")
        sys.exit(1)

    func_dir = (root / entry["directory"]).resolve()
    script_path = (func_dir / script_rel).resolve()
    source_root = (func_dir / source_rel).resolve()
    if not str(script_path).startswith(str(func_dir) + os.sep):
        sys.stderr.write(f"{name}: script fuori dalla cartella della funzione.\n")
        sys.exit(1)
    if not script_path.is_file():
        sys.stderr.write(f"{name}: script di build mancante.\n")
        sys.exit(1)
    if not source_root.is_dir() or not str(source_root).startswith(str(func_dir) + os.sep):
        sys.stderr.write(f"{name}: sourceRoot mancante nella cartella della funzione.\n")
        sys.exit(1)

    plan.append(
        {
            "scriptPath": str(script_path),
            "env": {
                "REPO_ROOT": str(root),
                "FUNCTION_LOGICAL_NAME": name,
                "FUNCTION_NAME": function_name,
                "FUNCTION_DIR": str(func_dir),
                "FUNCTION_RUNTIME": entry["runtime"],
                "FUNCTION_ARCH": architecture,
                "FUNCTION_PACKAGE_TYPE": package_type,
                "FUNCTION_ACCOUNT_ID": entry["accountId"],
                "FUNCTION_REGION": entry["region"],
                "FUNCTION_SOURCE_ROOT": str(source_root),
                "FUNCTION_STRATEGY": strategy,
                "FUNCTION_ARTIFACT": artifact,
                "NODE_VERSION": toolchain["version"],
                "YARN_VERSION": toolchain["packageManagerVersion"],
                "DIST_DIR": str(root / "dist"),
            },
        }
    )

Path(plan_path).write_text(json.dumps(plan), encoding="utf-8")
PY
then
  interrupt "selezione dei target rifiutata."
fi

host_arch=$(uname -m)
if [[ "$host_arch" != "x86_64" ]]; then
  interrupt "host ${host_arch}: questo progetto costruisce solo target x86_64."
fi

count=$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1], encoding="utf-8"))))' "$plan")
for ((i = 0; i < count; i++)); do
  env_file=$(mktemp)
  python3 -c 'import json, shlex, sys
item = json.load(open(sys.argv[1], encoding="utf-8"))[int(sys.argv[2])]
print("FUNCTION_SCRIPT=" + shlex.quote(item["scriptPath"]))
for key, value in item["env"].items():
    print(f"{key}={shlex.quote(str(value))}")' "$plan" "$i" > "$env_file"
  # Le assegnazioni sono quotate da shlex.quote.
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
  rm -f "$env_file"
  bash "$FUNCTION_SCRIPT"
done
