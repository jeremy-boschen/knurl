#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f /proc/sys/kernel/osrelease ]] || ! grep -qi 'microsoft' /proc/sys/kernel/osrelease; then
  echo "This helper must be run inside Windows Subsystem for Linux." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this script from within a Git repository." >&2
  exit 1
fi

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <local-branch> <worktrees-root>" >&2
  exit 1
fi

branch=$1
root=$2

if [[ -z $branch ]]; then
  echo "Branch name cannot be empty." >&2
  exit 1
fi

if [[ -z $root ]]; then
  echo "Worktrees root cannot be empty." >&2
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/$branch"; then
  echo "Local branch $branch does not exist." >&2
  exit 1
fi

safe_branch=$(printf '%s' "$branch" | sed 's#[^A-Za-z0-9._-]#-#g')
worktree_name="wsl-$safe_branch"
new_branch="wsl/$branch"

mkdir -p "$root"
root=$(realpath "$root")
dest="$root/$worktree_name"

if git worktree list --porcelain | grep -F "worktree $dest" >/dev/null; then
  echo "A worktree is already registered at $dest." >&2
  exit 1
fi

if [[ -e $dest ]]; then
  echo "Destination path $dest already exists." >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$new_branch"; then
  echo "Branch $new_branch already exists." >&2
  exit 1
fi

if git worktree list --porcelain | awk '/^branch / {print $2}' | grep -Fx "refs/heads/$new_branch" >/dev/null 2>&1; then
  echo "Branch $new_branch already checked out in another worktree." >&2
  exit 1
fi

echo "Creating worktree $worktree_name for branch $branch at $dest"
git worktree add -b "$new_branch" "$dest" "$branch"

# Configure the new branch to pull changes from the local base branch without hitting remotes.
git -C "$dest" config "branch.$new_branch.remote" "."
git -C "$dest" config "branch.$new_branch.merge" "refs/heads/$branch"

echo "Worktree created. To enter:"
echo "  cd $dest"
echo "Inside the worktree, 'git pull' will mirror commits from the local branch '$branch'."
