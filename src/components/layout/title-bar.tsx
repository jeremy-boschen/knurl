import { getCurrentWindow } from "@tauri-apps/api/window"
import { MaximizeIcon, MinusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useRequestTab } from "@/state"
import NewRequestButton from "../request/tabbar/new-request-button"
import { Breadcrumbs } from "./breadcrumbs"
import { EnvironmentSelector } from "./environment-selector"

export function TitleBar() {
  const activeTabData = useRequestTab()

  return (
    <div className="flex flex-grow items-center justify-end mr-1">
      {activeTabData ? (
        <>
          <div className="flex-shrink-0">
            <Breadcrumbs />
          </div>
          <div className="flex-shrink-0 ml-2">
            <EnvironmentSelector />
          </div>
        </>
      ) : (
        <div className="flex-shrink-0 pl-4">
          <NewRequestButton variant="ghost" />
        </div>
      )}

      <div className="flex-grow" />

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => getCurrentWindow().minimize()}>
        <MinusIcon className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => getCurrentWindow().toggleMaximize()}>
        <MaximizeIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-destructive"
        onClick={() => getCurrentWindow().close()}
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}
