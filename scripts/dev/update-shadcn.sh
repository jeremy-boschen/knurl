#!/usr/bin/env bash
# Language: bash
set -euo pipefail

UI_DIR="src/components/ui"
SHADCN_BIN_LOCAL="./node_modules/.bin/shadcn"

# -----------------------------
# How to invoke shadcn
# -----------------------------
invoke_shadcn() {
  if [[ -x "$SHADCN_BIN_LOCAL" ]]; then
    "$SHADCN_BIN_LOCAL" "$@"
    return $?
  fi
  if command -v shadcn >/dev/null 2>&1; then
    shadcn "$@"
    return $?
  fi
  if grep -q '"shadcn"' package.json 2>/dev/null || [[ -x "./node_modules/.bin/shadcn" ]]; then
    yarn shadcn "$@"
    return $?
  fi
  echo "Error: shadcn CLI not found. Install it (e.g., 'yarn add -D shadcn') and rerun." >&2
  return 127
}

# -----------------------------
# Post-run commands (edit as needed)
# Each command will receive the full file path as $1
# -----------------------------
COMMANDS=(
  # "echo Processing file:"
  # "yarn biome check --write"
  # "my-script --fix"
  "sed -E -i 's/[[:space:]]*md:text-sm//g'"
)

# -----------------------------
# Sanity checks
# -----------------------------
if [[ ! -d "$UI_DIR" ]]; then
  echo "Error: directory '$UI_DIR' not found. Run this from the project root." >&2
  exit 1
fi

if ! invoke_shadcn --version >/dev/null 2>&1; then
  echo "Error: shadcn CLI not available." >&2
  exit 1
fi

# -----------------------------
# Collect components
# -----------------------------
mapfile -d '' components < <(find "$UI_DIR" -maxdepth 1 -type f -name "*.tsx" -print0 | sort -z)

if [[ ${#components[@]} -eq 0 ]]; then
  echo "No .tsx components found in '$UI_DIR'."
  exit 0
fi

echo "Found ${#components[@]} components in $UI_DIR"
echo

# -----------------------------
# Run shadcn diff + commands per component
# -----------------------------
for path in "${components[@]}"; do
  base="$(basename "$path")"
  name="${base%.tsx}"

  echo "----------------------------------------"
  echo "shadcn diff $name"
  if ! invoke_shadcn diff "$name"; then
    echo "FAILED: shadcn diff $name" >&2
    continue
  fi

  # Run post-commands for this component, passing the file path
  if [[ ${#COMMANDS[@]} -gt 0 ]]; then
    echo "Running post-run commands for $path..."
    for cmd in "${COMMANDS[@]}"; do
      echo "+ $cmd $path"
      bash -lc "$cmd \"$path\""
    done
  fi

  echo "Completed $name"
  echo
done

echo "All done."
