#!/usr/bin/env bash
# Pianificazione dei target da costruire. Non legge BUILD_TARGETS.
# Non costruisce ZIP, non fa deploy, non scrive su S3.
set -euo pipefail

ROOT=${CODEBUILD_SRC_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
export REPO_ROOT=$ROOT
cd "$ROOT"

python3 - << 'PY'
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(os.environ["REPO_ROOT"]).resolve()
OUT_TARGETS = REPO / "release-targets.json"
OUT_PLAN = REPO / "release-plan.json"
OUT_TEXT = REPO / "release-plan.txt"

GLOBAL_FILES = [
    "buildspec.yml",
    "buildspec-plan.yml",
    "buildspec-deploy.yml",
    "functions.json",
]
GLOBAL_DIRS = [
    "shared",
    "scripts",
    "infra",
    "iam",
    ".github",
    "pipelines",
    "cloudformation",
    "terraform",
    ".aws-sam",
]


def run(args, check=True):
    return subprocess.run(
        args,
        cwd=REPO,
        text=True,
        capture_output=True,
        check=check,
    )


def write_outputs(plan, exit_code):
    targets_doc = {
        "commit": plan.get("commit"),
        "status": plan["status"],
        "targets": plan.get("targets", []),
    }
    OUT_TARGETS.write_text(json.dumps(targets_doc, indent=2) + "\n", encoding="utf-8")
    OUT_PLAN.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")

    lines = [
        f"status: {plan['status']}",
        f"commit: {plan.get('commit') or ''}",
        f"reason: {plan.get('reason') or ''}",
        "",
        "included:",
    ]
    for name in plan.get("included", []):
        lines.append(f"  - {name}")
    if not plan.get("included"):
        lines.append("  (none)")
    lines.append("unchanged:")
    for name in plan.get("unchanged", []):
        lines.append(f"  - {name}")
    if not plan.get("unchanged"):
        lines.append("  (none)")
    lines.append("unmanaged:")
    for item in plan.get("unmanaged", []):
        if isinstance(item, dict):
            lines.append(f"  - {item.get('logicalName')}: {item.get('reason')}")
        else:
            lines.append(f"  - {item}")
    if not plan.get("unmanaged"):
        lines.append("  (none)")
    lines.append("incomparable:")
    for item in plan.get("incomparable", []):
        lines.append(f"  - {item.get('logicalName')}: {item.get('reason')}")
    if not plan.get("incomparable"):
        lines.append("  (none)")
    lines.append("blocked:")
    blocked = plan.get("blockedPaths") or plan.get("blocked") or []
    if isinstance(blocked, str):
        lines.append(f"  - {blocked}")
    elif blocked:
        for item in blocked:
            lines.append(f"  - {item}")
    else:
        lines.append("  (none)")
    lines.append("")
    OUT_TEXT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUT_TEXT.read_text(encoding="utf-8"), end="")
    raise SystemExit(exit_code)


def empty_plan(commit, status, reason, **extra):
    plan = {
        "status": status,
        "commit": commit,
        "reason": reason,
        "targets": [],
        "included": [],
        "unchanged": [],
        "unmanaged": extra.get("unmanaged", []),
        "incomparable": extra.get("incomparable", []),
        "blockedPaths": extra.get("blockedPaths", []),
        "state": extra.get("state", "unknown"),
    }
    return plan


def current_commit():
    resolved = os.environ.get("CODEBUILD_RESOLVED_SOURCE_VERSION", "").strip()
    if resolved:
        return resolved
    return run(["git", "rev-parse", "HEAD"]).stdout.strip()


def require_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        return None
    return value


def load_catalog():
    path = REPO / "functions.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    functions = data.get("functions")
    if not isinstance(functions, list):
        raise ValueError("functions.json: functions non è una lista")
    by_name = {}
    for entry in functions:
        logical = entry.get("logicalName")
        if not isinstance(logical, str) or not logical:
            raise ValueError("functions.json: logicalName mancante")
        if logical in by_name:
            raise ValueError(f"functions.json: logicalName duplicato {logical}")
        directory = entry.get("directory")
        if not isinstance(directory, str) or not directory or directory.startswith("/"):
            raise ValueError(f"{logical}: directory non valida")
        resolved = (REPO / directory).resolve()
        if not str(resolved).startswith(str(REPO) + os.sep):
            raise ValueError(f"{logical}: directory fuori dal repository")
        by_name[logical] = entry
    return by_name


def git_is_commit(sha):
    result = run(["git", "cat-file", "-t", sha], check=False)
    return result.returncode == 0 and result.stdout.strip() == "commit"


def git_is_ancestor(sha, head):
    result = run(["git", "merge-base", "--is-ancestor", sha, head], check=False)
    return result.returncode == 0


def git_diff_names(old, new, paths):
    result = run(["git", "diff", "--name-only", old, new, "--", *paths], check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git diff fallito")
    return [line for line in result.stdout.splitlines() if line]


def is_full_sha(value):
    if not isinstance(value, str):
        return False
    sha = value.lower()
    return len(sha) in (40, 64) and all(c in "0123456789abcdef" for c in sha)


def validate_state(raw, catalog):
    if not isinstance(raw, dict):
        return "lo stato S3 non è un oggetto JSON"
    if raw.get("version") != 1:
        return "version deve essere 1"
    functions = raw.get("functions")
    if not isinstance(functions, dict):
        return "functions deve essere un oggetto"
    for logical, entry in functions.items():
        if logical not in catalog:
            return f"logicalName sconosciuto nello stato: {logical}"
        if not isinstance(entry, dict):
            return f"{logical}: voce di stato non è un oggetto"
        commit = entry.get("commit")
        if not isinstance(commit, str) or not commit.strip():
            return f"{logical}: commit SHA vuoto"
        if not is_full_sha(commit.strip()):
            return f"{logical}: commit SHA non valido"
        state_name = entry.get("functionName")
        catalog_name = catalog[logical].get("functionName")
        if state_name is not None and state_name != catalog_name:
            return (
                f"{logical}: functionName nello stato ({state_name}) "
                f"diverso da functions.json ({catalog_name})"
            )
    return None


def read_state():
    account = require_env("RELEASE_STATE_ACCOUNT_ID")
    region = require_env("RELEASE_STATE_REGION")
    bucket = require_env("RELEASE_STATE_BUCKET")
    key = require_env("RELEASE_STATE_KEY")
    missing = [
        name
        for name, value in (
            ("RELEASE_STATE_ACCOUNT_ID", account),
            ("RELEASE_STATE_REGION", region),
            ("RELEASE_STATE_BUCKET", bucket),
            ("RELEASE_STATE_KEY", key),
        )
        if value is None
    ]
    if missing:
        return {"error": "env", "missing": missing}

    identity = run(
        ["aws", "sts", "get-caller-identity", "--output", "json"],
        check=False,
    )
    if identity.returncode != 0:
        return {"error": "sts", "detail": identity.stderr.strip()}
    caller = json.loads(identity.stdout)
    if caller.get("Account") != account:
        return {
            "error": "account",
            "detail": f"STS {caller.get('Account')} diverso da {account}",
        }

    dest = tempfile.NamedTemporaryFile(delete=False)
    dest.close()
    get = run(
        [
            "aws",
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
    err = (get.stderr or "") + (get.stdout or "")
    if get.returncode != 0:
        os.unlink(dest.name)
        if "NoSuchKey" in err or "404" in err or "Not Found" in err:
            return {"error": "missing"}
        return {"error": "s3", "detail": err.strip()}
    text = Path(dest.name).read_text(encoding="utf-8")
    os.unlink(dest.name)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        return {"error": "malformed", "detail": str(exc)}
    return {"error": None, "payload": payload}


def unmanaged_all(catalog, reason):
    return [
        {"logicalName": name, "reason": reason}
        for name in catalog
    ]


head = current_commit()
try:
    catalog = load_catalog()
except (OSError, ValueError, json.JSONDecodeError) as exc:
    write_outputs(
        empty_plan(head, "blocked", f"functions.json illeggibile: {exc}", blockedPaths=[str(exc)]),
        1,
    )

state_result = read_state()
if state_result["error"] == "env":
    write_outputs(
        empty_plan(
            head,
            "blocked",
            "variabili di stato S3 mancanti: " + ", ".join(state_result["missing"]),
            unmanaged=unmanaged_all(catalog, "stato non letto"),
            blockedPaths=state_result["missing"],
        ),
        1,
    )
if state_result["error"] in {"sts", "account", "s3"}:
    write_outputs(
        empty_plan(
            head,
            "blocked",
            state_result.get("detail") or state_result["error"],
            unmanaged=unmanaged_all(catalog, "stato non letto"),
            blockedPaths=[state_result["error"]],
        ),
        1,
    )
if state_result["error"] == "malformed":
    write_outputs(
        empty_plan(
            head,
            "blocked",
            "stato S3 JSON non valido: " + state_result["detail"],
            unmanaged=unmanaged_all(catalog, "stato malformato"),
            blockedPaths=["release-state"],
            state="malformed",
        ),
        1,
    )

if state_result["error"] == "missing":
    write_outputs(
        empty_plan(
            head,
            "empty",
            "oggetto S3 assente: tutte le funzioni restano unmanaged fino al primo deploy esplicito",
            unmanaged=unmanaged_all(catalog, "nessuno stato di deploy riuscito"),
            state="absent",
        ),
        0,
    )

payload = state_result["payload"]
inconsistency = validate_state(payload, catalog)
if inconsistency:
    write_outputs(
        empty_plan(
            head,
            "blocked",
            inconsistency,
            unmanaged=unmanaged_all(catalog, "stato incoerente"),
            blockedPaths=["release-state"],
            state="inconsistent",
        ),
        1,
    )

state_functions = payload["functions"]
ancestor_commits = []
for entry in state_functions.values():
    sha = entry["commit"].strip().lower()
    if git_is_commit(sha) and git_is_ancestor(sha, head) and sha not in ancestor_commits:
        ancestor_commits.append(sha)

global_paths = list(GLOBAL_FILES) + [f"{d}/" for d in GLOBAL_DIRS]
blocked_paths = []
if state_functions and not ancestor_commits:
    write_outputs(
        empty_plan(
            head,
            "blocked",
            "nessun commit di stato è antenato di HEAD; il diff globale sarebbe ambiguo",
            unmanaged=unmanaged_all(catalog, "commit di stato non antenato"),
            blockedPaths=["git-history"],
            state="present",
        ),
        1,
    )

for sha in ancestor_commits:
    blocked_paths.extend(git_diff_names(sha, head, global_paths))
blocked_paths = sorted(set(blocked_paths))
if blocked_paths:
    write_outputs(
        empty_plan(
            head,
            "blocked",
            "modifiche a path condivisi o di pipeline: serve una selezione manuale",
            unmanaged=unmanaged_all(catalog, "pianificazione bloccata"),
            blockedPaths=blocked_paths,
            state="present",
        ),
        1,
    )

included = []
unchanged = []
unmanaged = []
incomparable = []

for logical, entry in catalog.items():
    state = state_functions.get(logical)
    if state is None:
        unmanaged.append(
            {
                "logicalName": logical,
                "reason": "nessuno stato: esclusa dal piano fino al primo deploy esplicito",
            }
        )
        continue
    sha = state["commit"].strip().lower()
    if not git_is_commit(sha):
        incomparable.append(
            {
                "logicalName": logical,
                "reason": f"commit di stato {sha} assente dal clone",
            }
        )
        continue
    if not git_is_ancestor(sha, head):
        incomparable.append(
            {
                "logicalName": logical,
                "reason": f"commit di stato {sha} non è antenato di HEAD",
            }
        )
        continue
    directory = entry["directory"].rstrip("/") + "/"
    changed = git_diff_names(sha, head, [directory, entry["directory"]])
    if changed:
        included.append(logical)
    else:
        unchanged.append(logical)

plan = {
    "status": "empty" if not included else "selected",
    "commit": head,
    "reason": (
        "nessun target modificato dal relativo ultimo deploy riuscito"
        if not included
        else "target modificati rispetto allo stato S3"
    ),
    "targets": included,
    "included": included,
    "unchanged": unchanged,
    "unmanaged": unmanaged,
    "incomparable": incomparable,
    "blockedPaths": [],
    "state": "present",
}
write_outputs(plan, 0)
PY
