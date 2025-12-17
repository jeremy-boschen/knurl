#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this script from within a Git repository." >&2
  exit 1
fi

WORKTREES_ROOT="$HOME/worktrees/knurl"
BRANCH_PREFIX="wsl/"
BASE_BRANCH="main"

usage() {
  echo "Usage: $0 {--add <name>|--pull|--push}" >&2
  exit 1
}

if [[ $# -lt 1 ]]; then
  usage
fi

mode="$1"

case "$mode" in
  --add)
    if [[ $# -lt 2 ]]; then
      echo "Error: Name required for --add" >&2
      usage
    fi
    name="$2"
    
    worktree_path="$WORKTREES_ROOT/$name"
    branch_name="${BRANCH_PREFIX}${name}"
    
    echo "Creating worktree..."
    echo "Path: $worktree_path"
    echo "Branch: $branch_name"
    echo "Base: $BASE_BRANCH"
    
    mkdir -p "$WORKTREES_ROOT"
    
    if [[ -d "$worktree_path" ]]; then
        echo "Error: Worktree path $worktree_path already exists." >&2
        exit 1
    fi

    git worktree add "$worktree_path" -b "$branch_name" "$BASE_BRANCH"
    ;;
    
  --pull)
    if [[ ! -d "$WORKTREES_ROOT" ]]; then
      echo "Directory $WORKTREES_ROOT does not exist. No worktrees to pull." >&2
      exit 0
    fi
    
    echo "Pulling updates for all worktrees in $WORKTREES_ROOT..."
    for dir in "$WORKTREES_ROOT"/*; do
      if [[ -d "$dir" ]]; then
        echo "Updating $(basename "$dir")..."
        if [[ -f "$dir/.git" ]] || [[ -d "$dir/.git" ]]; then
           # Run merge in a subshell to preserve current directory
           (cd "$dir" && git merge "$BASE_BRANCH")
        else
           echo "Skipping $(basename "$dir") (not a git repository)"
        fi
      fi
    done
    ;;
    
  --push)
    if [[ ! -d "$WORKTREES_ROOT" ]]; then
      echo "Directory $WORKTREES_ROOT does not exist. No worktrees to push." >&2
      exit 0
    fi
    
    echo "Merging all worktree branches into $BASE_BRANCH..."
    
    # Ensure we are on the base branch in the main repo
    # If git checkout fails (e.g. dirty state), script exits due to set -e
    git checkout "$BASE_BRANCH"
    
    for dir in "$WORKTREES_ROOT"/*; do
      if [[ -d "$dir" ]]; then
        name=$(basename "$dir")
        branch_name="${BRANCH_PREFIX}${name}"
        
        if git show-ref --verify --quiet "refs/heads/$branch_name"; then
          echo "Merging $branch_name..."
          git merge "$branch_name"
        else
          echo "Skipping $name: branch $branch_name not found."
        fi
      fi
    done
    ;;
    
  *)
    usage
    ;;
esac