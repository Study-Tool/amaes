#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PATTERN='(/home/ryme|ractopen|Acads-Tools|acads-tools|amaestoolkit\.pages\.dev|GITHUB_BOT_TOKEN|slmails\.com|github\.contend244)'

CANDIDATES=(
  "$ROOT_DIR/extension/entrypoints"
  "$ROOT_DIR/extension/utils"
  "$ROOT_DIR/extension/wxt.config.ts"
  "$ROOT_DIR/portal/index.html"
  "$ROOT_DIR/portal/site.js"
  "$ROOT_DIR/portal/site.css"
  "$ROOT_DIR/portal/dashboard.html"
  "$ROOT_DIR/database/relay/worker.js"
  "$ROOT_DIR/database/relay/wrangler.toml"
  "$ROOT_DIR/database/.github/workflows/daily-sync.yml"
  "$ROOT_DIR/HANDOFF.md"
)

TARGETS=()
for path in "${CANDIDATES[@]}"; do
  if [ -e "$path" ]; then
    TARGETS+=("$path")
  fi
done

echo "Scanning ${#TARGETS[@]} existing path(s) for forbidden identifiers..."

if [ "${#TARGETS[@]}" -gt 0 ] && rg -n "$PATTERN" "${TARGETS[@]}"; then
  echo "ERROR: Forbidden personal identifier, legacy org name, or bot token reference found."
  exit 1
fi

echo "Identity & OPSEC check PASSED."
