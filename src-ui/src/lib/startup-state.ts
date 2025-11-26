export type StartupState = 0 | 1 | 2

declare global {
  // eslint-disable-next-line no-var
  var __KNURL_STARTUP_STATE__: StartupState | undefined
}

export function setStartupState(state: StartupState) {
  globalThis.__KNURL_STARTUP_STATE__ = state
}

export function getStartupState(): StartupState {
  return globalThis.__KNURL_STARTUP_STATE__ ?? 0
}
