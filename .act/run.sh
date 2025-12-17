#!/usr/bin/env bash
set -euo pipefail

# Minimal helper to run local GitHub Actions workflows via act.
# Secrets/vars/env files live under .act/ and are gitignored.

ROOT="$(cd -- "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_DIR="$ROOT/.github/workflows"
ACT_DIR="$ROOT/.act"
ARTIFACT_DIR="$ACT_DIR/.artifacts"
CACHE_DIR="$ACT_DIR/.cache"
SECRETS_FILE="${SECRETS_FILE:-$ACT_DIR/secrets.env}"
VARS_FILE="${VARS_FILE:-$ACT_DIR/vars.env}"
ENV_FILE="${ENV_FILE:-$ACT_DIR/env.env}"
PLATFORM_PRESET="${PLATFORM_PRESET:-default}"

event="push"
workflow=""
ref=""
act_args=()
runtime_secret=""
event_file=""

cleanup() {
  [[ -n "$runtime_secret" && -f "$runtime_secret" ]] && rm -f "$runtime_secret"
  [[ -n "$event_file" && -f "$event_file" ]] && rm -f "$event_file"
}

generate_push_event() {
  local ref="$1"
  event_file="$(mktemp "$ACT_DIR/.event.XXXXXX.json")"
  cat >"$event_file" <<EOF
{
  "ref": "$ref",
  "repository": {
    "name": "knurl"
  }
}
EOF
  echo "$event_file"
}

trap cleanup EXIT
ACT_PID=""

forward_signal() {
  local sig="$1"
  if [[ -n "$ACT_PID" ]] && kill -0 "$ACT_PID" 2>/dev/null; then
    kill "-$sig" "$ACT_PID"
  fi
}

handle_signal() {
  local sig="$1"
  forward_signal "$sig"
  # EXIT trap will still run; this ensures immediate teardown on signals.
  case "$sig" in
    INT) exit 130 ;;
    TERM) exit 143 ;;
    *) exit 128 ;;
  esac
}

trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM

usage() {
  cat <<'EOF'
Usage:
  .act/run.sh [--event EVENT] [--ref REF] WORKFLOW_NAME [-- ACT_ARGS...]
  .act/run.sh --list
  .act/run.sh --secrets-template
  .act/run.sh --vars-template

WORKFLOW_NAME matches a file in .github/workflows (with or without .yml).
Use ACT_ARGS after -- to pass directly to act (e.g., -j job-name).

Helper flags:
  --list              List available workflow files.
  --ref REF           Generate push event for ref (e.g., refs/tags/v0.1.7).
  --secrets-template  Write .act/secrets.env template from repo secret names (preserves existing values).
  --vars-template     Write .act/vars.env template from gh variable list (names only).
  --preset NAME       Runner image preset: default | full. Default uses act-latest images;
                      full uses catthehacker full-* images (closest to official runner-images).

Environment overrides:
  SECRETS_FILE, VARS_FILE, ENV_FILE, PLATFORM_PRESET can point to alternate values.
EOF
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: $1 is required" >&2
    exit 1
  fi
}

assert_docker_linux() {
  require_tool docker
  local os_type
  if os_type="$(docker info --format '{{.OSType}}' 2>/dev/null)"; then
    if [[ "$os_type" != "linux" ]]; then
      cat >&2 <<EOF
error: Docker daemon reports OSType=$os_type (likely Windows containers).
Switch Docker Desktop to "Use WSL 2 based engine" / "Use Linux containers" and retry.
EOF
      exit 1
    fi
  else
    echo "warning: unable to query docker info; continuing" >&2
  fi
}

list_workflows() {
  find "$WORKFLOW_DIR" -maxdepth 1 -type f \( -name "*.yml" -o -name "*.yaml" \) \
    -print | sed 's!.*/!!' | sort
}

write_secret_template() {
  mkdir -p "$ACT_DIR"
  local tmp="$SECRETS_FILE.tmp"
  cp /dev/null "$tmp"
  if [[ -f "$SECRETS_FILE" ]]; then
    cat "$SECRETS_FILE" >>"$tmp"
  fi

  if command -v gh >/dev/null 2>&1; then
    if names="$(gh secret list --json name --jq '.[].name' 2>/dev/null)"; then
      while read -r name; do
        [[ -z "$name" ]] && continue
        if ! grep -q "^${name}=" "$tmp"; then
          echo "${name}=" >>"$tmp"
        fi
      done <<<"$names"
    else
      echo "warning: unable to fetch secret names with gh; using existing contents only" >&2
    fi
  else
    echo "warning: gh not found; skipping secret name sync" >&2
  fi

  mv "$tmp" "$SECRETS_FILE"
  echo "wrote template: $SECRETS_FILE"
}

write_var_template() {
  mkdir -p "$ACT_DIR"
  local tmp="$VARS_FILE.tmp"
  cp /dev/null "$tmp"
  if [[ -f "$VARS_FILE" ]]; then
    cat "$VARS_FILE" >>"$tmp"
  fi

  if command -v gh >/dev/null 2>&1; then
    if names="$(gh variable list --json name --jq '.[].name' 2>/dev/null)"; then
      while read -r name; do
        [[ -z "$name" ]] && continue
        if ! grep -q "^${name}=" "$tmp"; then
          echo "${name}=" >>"$tmp"
        fi
      done <<<"$names"
    else
      echo "warning: unable to fetch variable names with gh; using existing contents only" >&2
    fi
  else
    echo "warning: gh not found; skipping variable name sync" >&2
  fi

  mv "$tmp" "$VARS_FILE"
  echo "wrote template: $VARS_FILE"
}

ensure_runtime_secret_file() {
  mkdir -p "$ACT_DIR"
  runtime_secret="$(mktemp "$ACT_DIR/.runtime.secrets.XXXXXX")"

  if [[ -f "$SECRETS_FILE" ]]; then
    cat "$SECRETS_FILE" >>"$runtime_secret"
  fi

  if command -v gh >/dev/null 2>&1; then
    if gh_token="$(gh auth token 2>/dev/null)"; then
      if grep -q "^GITHUB_TOKEN=" "$runtime_secret" 2>/dev/null; then
        sed -i "s/^GITHUB_TOKEN=.*/GITHUB_TOKEN=${gh_token//&/\\&}/" "$runtime_secret"
      else
        echo "GITHUB_TOKEN=$gh_token" >>"$runtime_secret"
      fi
    else
      echo "warning: gh auth token unavailable; GITHUB_TOKEN not injected" >&2
    fi
  else
    echo "warning: gh CLI not found; skipping GITHUB_TOKEN injection" >&2
  fi
}

resolve_workflow_path() {
  local candidate="$1"
  if [[ "$candidate" == */* ]] && [[ -f "$candidate" ]]; then
    printf "%s\n" "$candidate"
    return 0
  fi

  if [[ -f "$WORKFLOW_DIR/$candidate" ]]; then
    printf "%s\n" "$WORKFLOW_DIR/$candidate"
    return 0
  fi

  if [[ -f "$WORKFLOW_DIR/$candidate.yml" ]]; then
    printf "%s\n" "$WORKFLOW_DIR/$candidate.yml"
    return 0
  fi

  if [[ -f "$WORKFLOW_DIR/$candidate.yaml" ]]; then
    printf "%s\n" "$WORKFLOW_DIR/$candidate.yaml"
    return 0
  fi

  echo "error: workflow '$candidate' not found in $WORKFLOW_DIR" >&2
  exit 1
}

ensure_files() {
  mkdir -p "$ACT_DIR" "$ARTIFACT_DIR" "$CACHE_DIR"
  touch "$VARS_FILE" "$ENV_FILE"
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --list)
      list_workflows
      exit 0
      ;;
    --secrets-template)
      write_secret_template
      exit 0
      ;;
    --vars-template)
      write_var_template
      exit 0
      ;;
    --preset)
      shift
      [[ $# -gt 0 ]] || { echo "error: --preset requires value" >&2; exit 1; }
      PLATFORM_PRESET="$1"
      shift
      ;;
    --event)
      shift
      [[ $# -gt 0 ]] || { echo "error: --event requires value" >&2; exit 1; }
      event="$1"
      shift
      ;;
    --ref)
      shift
      [[ $# -gt 0 ]] || { echo "error: --ref requires value" >&2; exit 1; }
      ref="$1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      act_args=("$@")
      break
      ;;
    *)
      if [[ -z "$workflow" ]]; then
        workflow="$1"
      else
        act_args+=("$1")
      fi
      shift
      ;;
  esac
done

[[ -z "$workflow" ]] && { usage; exit 1; }

require_tool act
assert_docker_linux
ensure_files
ensure_runtime_secret_file

workflow_source_path="$(resolve_workflow_path "$workflow")"
workflow_path="$workflow_source_path"

for arg in "${act_args[@]}"; do
  if [[ "$arg" == "--rm" ]]; then
    echo "error: --rm cannot be used when --bind is enabled" >&2
    exit 1
  fi
done

case "$PLATFORM_PRESET" in
  full)
    PLATFORM_ARGS=(
      -P ubuntu-latest=catthehacker/ubuntu:full-latest
      -P ubuntu-24.04=catthehacker/ubuntu:full-24.04
      -P ubuntu-22.04=catthehacker/ubuntu:full-22.04
      -P ubuntu-20.04=catthehacker/ubuntu:full-20.04
      -P ubuntu-18.04=catthehacker/ubuntu:full-18.04
    )
    ;;
  default|*)
    PLATFORM_ARGS=(
      -P ubuntu-latest=catthehacker/ubuntu:act-latest
      -P ubuntu-24.04=catthehacker/ubuntu:act-24.04
      -P ubuntu-22.04=catthehacker/ubuntu:act-22.04
      -P ubuntu-20.04=catthehacker/ubuntu:act-20.04
      -P ubuntu-18.04=catthehacker/ubuntu:act-18.04
    )
    ;;
esac

# Generate event file if --ref was provided
if [[ -n "$ref" ]]; then
  event_file="$(generate_push_event "$ref")"
fi

ACT_CMD=(
  act "$event"
  -C "$ROOT"
  -W "$workflow_path"
  --use-gitignore
  --reuse
  --pull=false
  --use-new-action-cache
  --artifact-server-path "$ARTIFACT_DIR"
  --cache-server-path "$CACHE_DIR"
  --secret-file "$runtime_secret"
  --var-file "$VARS_FILE"
  --env-file "$ENV_FILE"
)

# Add event file if generated
if [[ -n "$event_file" ]]; then
  ACT_CMD+=(--eventpath "$event_file")
fi

ACT_CMD+=("${PLATFORM_ARGS[@]}")

if [[ ${#act_args[@]} -gt 0 ]]; then
  ACT_CMD+=("${act_args[@]}")
fi

echo "workflow: $workflow_path"
echo "event: $event"
[[ -n "$ref" ]] && echo "ref: $ref"
echo "artifacts -> $ARTIFACT_DIR"
echo "cache -> $CACHE_DIR"
echo "using secrets file (runtime copy): $runtime_secret"
echo "using vars file: $VARS_FILE"
echo "using env file: $ENV_FILE"
echo "platform preset: $PLATFORM_PRESET"

cd "$ROOT"
set +e
"${ACT_CMD[@]}" &
ACT_PID=$!
wait "$ACT_PID"
status=$?
set -e
exit "$status"
