# Development

## Setup

1. Install deps: `yarn install`
2. Install/update Git hooks: `yarn git:setup`

## Git Hooks

Hooks live in `.githooks/`. `yarn git:setup` sets `core.hooksPath` to `.githooks` and makes hook scripts executable.

Hooks currently run:

- `pre-commit`: `yarn build:format`, `yarn check:lint`
- `pre-push`: `yarn test:unit`
- `commit-msg`: `commitlint`

## Common Commands

- `yarn check:local`
- `yarn test:unit`
- `yarn test:e2e`
- `yarn tauri dev`

