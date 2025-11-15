import React, { Suspense } from "react"

import { attachConsole, debug, error, info, warn } from "@tauri-apps/plugin-log"
import { enablePatches } from "immer"
import { createRoot } from "react-dom/client"

import App from "./App"
import "./App.css"

import { getStartupState, setStartupState } from "@/lib/startup-state"
import { loadApplication } from "@/state"
import { asSuspense } from "@/state/utils"

// This must be the first thing to run to ensure Immer is configured
// before any other module that might use it is imported.
enablePatches()

// This can be awaited as it doesn't block other module imports in the same way.
await attachConsole()

const logMethods = ["log", "debug", "info", "warn", "error"] as const
type LogMethodName = (typeof logMethods)[number]

const pluginLoggers: Record<LogMethodName, typeof info> = {
  log: info,
  debug: debug,
  info: info,
  warn: warn,
  error: error,
}

for (const name of logMethods) {
  const original = console[name as keyof typeof console] as typeof console.log
  const plugin = pluginLoggers[name]
  console[name as keyof typeof console] = ((...args: Parameters<typeof console.log>) => {
    original(...args)
    void plugin(...args)
  }) as typeof console.log
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
