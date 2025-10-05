import { useApplication } from "@/state/application"

// Avoid auto-loading during Vitest to prevent touching Tauri IPC in unit tests
export const loadApplicationState = (async () => {
  // Avoid invoking Tauri IPC when running in non-Tauri contexts (e.g., unit tests/jsdom)
  if (typeof window !== "undefined" && !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    return
  }
  await useApplication.loadAll()
})()

export * from "./application"
export * from "./collections"
export * from "./request-tabs"
export * from "./settings"
export * from "./sidebar"
