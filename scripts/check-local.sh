#!/usr/bin/env bash
set -euo pipefail

echo "Knurl: running consolidated local checks"

# Toggles (default to enabled = 1). Set to 0 to skip a step.
CHECK_TYPES=${CHECK_TYPES:-1}
CHECK_LINT=${CHECK_LINT:-1}
CHECK_FMT_RUST=${CHECK_FMT_RUST:-1}
CHECK_CLIPPY=${CHECK_CLIPPY:-1}
CHECK_TEST_FE=${CHECK_TEST_FE:-1}
CHECK_TEST_BE=${CHECK_TEST_BE:-1}
CHECK_AUDIT=${CHECK_AUDIT:-1}
CHECK_DENY=${CHECK_DENY:-1}
CHECK_GITLEAKS=${CHECK_GITLEAKS:-1}

step() {
  local name=$1
  shift
  echo "\n=== ${name} ==="
  bash -lc "$*"
}

maybe() {
  local enabled=$1
  shift
  local name=$1
  shift
  if [[ "$enabled" == "1" ]]; then
    step "$name" "$@"
  else
    echo "Skipping ${name} (disabled via env)"
  fi
}

cmd_exists() { command -v "$1" >/dev/null 2>&1; }

# JS/TS type-check
maybe "$CHECK_TYPES" "TypeScript typecheck" yarn run -T typecheck

# JS/TS lint (Biome)
maybe "$CHECK_LINT" "Biome lint" yarn run -T lint

# Rust fmt (check only)
if [[ "$CHECK_FMT_RUST" == "1" ]]; then
  if cmd_exists cargo; then
    step "Rust fmt (check)" cd src-tauri \&\& cargo fmt -- --check
  else
    echo "Skipping Rust fmt: cargo not found"
  fi
fi

# Rust clippy
if [[ "$CHECK_CLIPPY" == "1" ]]; then
  if cmd_exists cargo; then
    step "Clippy" yarn run -T lint:rust
  else
    echo "Skipping Clippy: cargo not found"
  fi
fi

# Frontend unit tests
maybe "$CHECK_TEST_FE" "Vitest (frontend)" yarn run -T test:frontend

# Backend unit tests
if [[ "$CHECK_TEST_BE" == "1" ]]; then
  if cmd_exists cargo; then
    step "Cargo tests (backend)" yarn run -T test:backend
  else
    echo "Skipping backend tests: cargo not found"
  fi
fi

# Security: cargo-audit
if [[ "$CHECK_AUDIT" == "1" ]]; then
  if cmd_exists cargo-audit; then
    step "cargo-audit" cd src-tauri \&\& cargo audit
  else
    echo "Skipping cargo-audit: cargo-audit not installed"
  fi
fi

# Security: cargo-deny (advisories, bans, sources)
if [[ "$CHECK_DENY" == "1" ]]; then
  if cmd_exists cargo-deny; then
    step "cargo-deny" cd src-tauri \&\& cargo deny check advisories bans sources
  else
    echo "Skipping cargo-deny: cargo-deny not installed"
  fi
fi

# Security: gitleaks
if [[ "$CHECK_GITLEAKS" == "1" ]]; then
  if cmd_exists gitleaks; then
    step "gitleaks" gitleaks detect --redact
  else
    echo "Skipping gitleaks: gitleaks not installed"
  fi
fi

echo "\nAll enabled checks completed."
