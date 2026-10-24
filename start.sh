#!/usr/bin/env bash
set -euo pipefail

project_dir="${PROJECT_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)}"
: "${OPENCODE_WEB_DIR:?OPENCODE_WEB_DIR is required for deployment metadata}"
: "${RUNTIME_DIR:?RUNTIME_DIR is required}"

port="${PORT:-3000}"
[[ "$port" =~ ^[1-9][0-9]*$ ]] || { echo "PORT must be a positive integer: $port" >&2; exit 1; }
export PORT="$port"

run() {
  local label="$1"
  shift
  echo "[start] $label"
  /usr/bin/time -p "$@"
}

cd_started="$(date +%s%3N)"
cd "$project_dir"
echo "[start] cd $(( $(date +%s%3N) - cd_started ))ms"

run "verify static entrypoint" test -f "$project_dir/index.html"
run "create metadata directory" mkdir -p "$OPENCODE_WEB_DIR"
run "write deployment output" node -e '
  const fs = require("node:fs");
  const [project, output] = process.argv.slice(1);
  fs.writeFileSync(output, JSON.stringify({ project, directory: project }));
' "$project_dir" "$OPENCODE_WEB_DIR/deployment-output.json"

# default-start.mjs serves this static tree and also handles package-based
# install/build output when a project adds one later.
echo "[start] serving $project_dir on port $port"
exec /usr/bin/time -p node "$RUNTIME_DIR/scripts/default-start.mjs"
