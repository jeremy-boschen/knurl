import { useApplication } from "@/state/application"

// Avoid autoloading during Vitest to prevent touching Tauri IPC in unit tests
export const loadApplication = (async () => {
  // Avoid invoking Tauri IPC when running in non-Tauri contexts (e.g., unit tests/jsdom)
  if (typeof window !== "undefined" && !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    return
  }
  await useApplication.loadAll()
})()

export * from "./application"
export * from "./collections"
export * from "./dialogs"
export * from "./request-tabs"
export * from "./settings"
export * from "./sidebar"
