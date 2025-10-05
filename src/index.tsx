import { attachConsole } from "@tauri-apps/plugin-log"
import { enablePatches } from "immer"
import { createRoot } from "react-dom/client"

import { loadApplicationState } from "@/state"
import App from "./App"
import "./App.css"
import React, { Suspense } from "react"

import { asSuspense } from "@/state/utils"

// This must be the first thing to run to ensure Immer is configured
// before any other module that might use it is imported.
enablePatches()

// This can be awaited as it doesn't block other module imports in the same way.
await attachConsole()

export const hydrationResource = asSuspense<void>(loadApplicationState)

function Root() {
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
