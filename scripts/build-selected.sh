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

targets_file=${RELEASE_TARGETS_FILE:-}
if [[ -z "$targets_file" && -n "${CODEBUILD_SRC_DIR_PlanArtifact:-}" ]]; then
  targets_file=$CODEBUILD_SRC_DIR_PlanArtifact/release-targets.json
fi
if [[ -z "$targets_file" ]]; then
  targets_file=$ROOT/release-targets.json
fi

if [[ -f "$targets_file" ]]; then
  BUILD_TARGETS=$(python3 - "$targets_file" << 'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if data.get("status") == "blocked":
    sys.stderr.write("release-targets.json è blocked: nessuna build automatica.\n")
    sys.exit(1)
targets = data.get("targets")
if not isinstance(targets, list):
    sys.stderr.write("release-targets.json: targets non è una lista.\n")
    sys.exit(1)
print(",".join(targets))
PY
  ) || interrupt "release-targets.json non valido."
  echo "Target dal piano: ${BUILD_TARGETS:-<vuoto>}"
elif [[ -v BUILD_TARGETS ]]; then
  echo "Target da BUILD_TARGETS (override manuale)."
else
  interrupt "manca release-targets.json e BUILD_TARGETS non è impostato."
fi

stripped=${BUILD_TARGETS//[[:space:],]/}
if [[ -z "$stripped" ]]; then
  echo "Nessun target da costruire. Build vuota, successo."
  mkdir -p "$ROOT/dist/manifests"
  printf '%s\n' '{"releases":[]}' > "$ROOT/dist/release-manifest.json"
  exit 0
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
    if strategy not in ("nodejs-zip-yarn-classic", "nodejs-zip-npm"):
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
    package_manager = toolchain.get("packageManager")
    if strategy == "nodejs-zip-yarn-classic" and package_manager != "yarn-classic":
        sys.stderr.write(f"{name}: packageManager inatteso per strategy yarn: {package_manager}\n")
        sys.exit(1)
    if strategy == "nodejs-zip-npm" and package_manager != "npm":
        sys.stderr.write(f"{name}: packageManager inatteso per strategy npm: {package_manager}\n")
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
                "PACKAGE_MANAGER": package_manager,
                "PACKAGE_MANAGER_VERSION": toolchain["packageManagerVersion"],
                "YARN_VERSION": toolchain["packageManagerVersion"] if package_manager == "yarn-classic" else "",
                "NPM_VERSION": toolchain["packageManagerVersion"] if package_manager == "npm" else "",
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

python3 - "$ROOT/dist" "$BUILD_TARGETS" << 'PY'
import json
import sys
from pathlib import Path

dist = Path(sys.argv[1])
names = [part for part in sys.argv[2].split(",") if part]
manifests_dir = dist / "manifests"
releases = []
for name in names:
    path = manifests_dir / f"{name}.json"
    if not path.is_file():
        sys.stderr.write(f"manifest mancante dopo la build: {path}\n")
        sys.exit(1)
    releases.append(json.loads(path.read_text(encoding="utf-8")))
(dist / "release-manifest.json").write_text(
    json.dumps({"releases": releases}, indent=2) + "\n",
    encoding="utf-8",
)
PY
