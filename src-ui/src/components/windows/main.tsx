import React, { lazy, Suspense } from "react"

import { getCurrentWindow } from "@tauri-apps/api/window"
import { Route, Switch } from "wouter"

import { deleteFile } from "@/bindings/knurl"
import ErrorBoundary from "@/components/error/error-boundary"
import { KnurlIcon } from "@/components/icons/knurl-icon"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useInterval } from "@/hooks/use-interval"
import { useApplication, useSettings } from "@/state"

const combinedPromise = Promise.all([import("@/pages/home"), new Promise((resolve) => setTimeout(resolve, 1500))]).then(
  ([homeModule]) => homeModule,
)

const Home = lazy(() => combinedPromise)
const TestUxReference = import.meta.env.MODE === "e2e" ? lazy(() => import("@/pages/e2e-ux-reference")) : null

function LoadingSplash() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="relative flex h-72 w-72 items-center justify-center">
        <div className="absolute h-full w-full rounded-full border-4 border-primary/20 border-t-primary animate-spin-slow" />
        <KnurlIcon className="h-48 w-48 animate-in fade-in duration-500" />
      </div>
    </div>
  )
}

function Router() {
  console.log('[Router] render - about to enter Suspense')
  return (
    <Suspense fallback={<LoadingSplash />}>
      <Switch>
        <Route path="/" component={Home} />
        {import.meta.env.MODE === "e2e" && TestUxReference ? (
          <Route path="/__tests/ui" component={TestUxReference} />
        ) : null}
      </Switch>
    </Suspense>
  )
}

export function MainWindow() {
  console.log('[MainWindow] render start')
  const {
    state: { requests },
  } = useSettings()
  const interval = requests.autoSave

  const saveAll = React.useCallback(async () => {
    await useApplication.saveAll()
  }, [])

  // Setup auto-save every minute
  useInterval(saveAll, (interval ?? 0) * 1000)

  // Listen for the main window to close and trigger save all when it does
  React.useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async () => {
      // Clean up any temp response files before saving
      try {
        const state = useApplication.getState()
        for (const tab of Object.values(state.requestTabsState.openTabs)) {
          const data = tab.response?.data
          if (data && data.type === "http") {
            const fp = (data.data as { filePath?: string }).filePath
            if (fp) {
              void deleteFile(fp)
            }
          }
        }
      } catch {}
      await useApplication.saveAll()
    })
    return () => {
      unlisten.then((f) => f())
    }
  }, [])

  // Ensure all state is saved before page unload (e.g., browser.refresh(), navigation, closing tab, etc.)
  React.useEffect(() => {
    const handleBeforeUnload = async () => {
      await useApplication.saveAll()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={700} skipDelayDuration={0}>
        <Router />
        <Toaster />
      </TooltipProvider>
    </ErrorBoundary>
  )
}
