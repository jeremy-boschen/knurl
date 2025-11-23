import React, { Suspense } from "react"

import { attachConsole } from "@tauri-apps/plugin-log"
import { enablePatches } from "immer"
import { createRoot } from "react-dom/client"

import App from "./App"
import "./App.css"

import { getStartupState, setStartupState } from "@/lib/startup-state"
import { loadApplication } from "@/state"
import { asSuspense } from "@/state/utils"

// Load test bridges (integration + E2E)
// Integration bridge: Only loaded when VITE_INTEGRATION_ENABLED is set (for integration tests)
// E2E bridge: Only during E2E tests (when VITE_E2E_ENABLED is set by wdio.conf.ts)
if (import.meta.env.VITE_INTEGRATION_ENABLED) {
  await import("./test/integration-bridge")
}
if (import.meta.env.VITE_E2E_ENABLED) {
  await import("./test/e2e-bridge")
}

// This must be the first thing to run to ensure Immer is configured
// before any other module that might use it is imported.
enablePatches()

// This can be awaited as it doesn't block other module imports in the same way.
try {
  await attachConsole()

  console.log("[app] Console attached to Tauri logger and console methods redirected")
} catch (err) {
  console.error("[app] Failed to attach console:", err)
}

setStartupState(0)

export const hydrationResource = asSuspense<void>(loadApplication)

function Root() {
  if (getStartupState() < 1) {
    setStartupState(1)
  }
  hydrationResource.read()
  return <App />
}

// biome-ignore lint/style/noNonNullAssertion: Cannot be null
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<div />}>
      <Root />
    </Suspense>
  </React.StrictMode>,
)
