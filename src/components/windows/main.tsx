import React, { lazy, Suspense } from "react"

import { getCurrentWindow } from "@tauri-apps/api/window"
import { Route, Switch } from "wouter"

import { deleteFile } from "@/bindings/knurl"
import ErrorBoundary from "@/components/error/error-boundary"
import { KnurlIcon } from "@/components/icons/knurl-icon"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useInterval } from "@/hooks/use-interval"
import { useApplication } from "@/state"

const combinedPromise = Promise.all([import("@/pages/home"), new Promise((resolve) => setTimeout(resolve, 1500))]).then(
  ([homeModule]) => homeModule,
)

const Home = lazy(() => combinedPromise)

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
  return (
    <Suspense fallback={<LoadingSplash />}>
      <Switch>
        <Route path="/" component={Home} />
      </Switch>
    </Suspense>
  )
}

export function MainWindow() {
  const interval = useApplication((app) => app.settingsState.requests.autoSave)

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

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={700} skipDelayDuration={0}>
        <Router />
        <Toaster />
      </TooltipProvider>
    </ErrorBoundary>
  )
}
