# Frontend Coverage Push (2025-10-21)

## Checklist
- [x] Record current Vitest coverage baseline
- [x] Cover `src/state/utils.ts` (`asSuspense`)
- [x] Extend application store hook coverage (`src/state/application.ts`)
- [x] Strengthen utility sheets slice coverage (`src/state/utility-sheets.ts`)
- [x] Exercise hook helpers (`src/hooks/use-event.ts`)
- [x] Add error boundary regression tests (`src/components/error/error-boundary.tsx`)
- [x] Cover Prettier worker shim (`src/lib/prettier.ts`)
- [x] Re-run coverage aiming for ≥85% lines

## Notes
- Focus on deterministic, pure logic first to raise coverage fast.
- Prefer store-level tests over component renderings when possible.
