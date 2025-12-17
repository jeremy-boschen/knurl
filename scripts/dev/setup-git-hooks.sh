#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

if [[ ! -d ".githooks" ]]; then
  echo "Missing .githooks/ directory; cannot configure hooks." >&2
  exit 1
fi

git config core.hooksPath .githooks

# Ensure hooks are runnable locally (Git requires executable bit on Unix).
chmod +x .githooks/* 2>/dev/null || true

echo "Git hooks configured: core.hooksPath=.githooks"

