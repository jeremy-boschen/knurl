# Plan: Remove lefthook; use manual Git hooks (2025-12-17)

## Goal

Stop using `lefthook` and replace it with manually-managed Git hooks that developers enable locally.

## Checklist

- [x] Remove `lefthook` usage from repo config (files + package scripts).
- [x] Add manual Git hook scripts that replicate current lefthook behavior.
- [x] Document how to enable the hooks locally.
- [x] Keep `yarn git:setup` to install/update hooks.
