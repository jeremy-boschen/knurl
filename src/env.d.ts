/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_VALIDATE_COLLECTION_INDEX?: string
  // add your VITE_* vars here
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

// E2E testing and feature flags
interface Window {
  __KNURL_DISABLE_EVENTS?: boolean
  __KNURL_ENABLE_EVENT_HISTORY?: boolean
  __KNURL_DISABLE_STRICT_MODE?: boolean
  __KNURL_E2E_CONFIG_DIR__?: string
  __KNURL_STARTUP_STATE__?: number
  __knurlEventBus?: {
    lastEvent: unknown | null
    events: unknown[]
    on: (type: string, handler: (event: unknown) => void) => () => void
    off: (type: string, handler: (event: unknown) => void) => void
    getHistory: () => unknown[]
  }
}
