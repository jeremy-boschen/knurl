import { useLayoutEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { MaximizeIcon, MinusIcon, XIcon } from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { RestoreIcon } from "@/components/icons"

export function WindowControlDropdownMenuContent({
  align,
  alignOffset,
}: {
  align?: "start" | "center" | "end"
  alignOffset?: number
}) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useLayoutEffect(() => {
    const loadWindowState = async () => {
      const window = await getCurrentWindow()
      setIsMaximized(await window.isMaximized())
      setIsMinimized(await window.isMinimized())
      setIsLoaded(true)
    }

    loadWindowState()
  }, [])

  const handleRestore = async () => {
    const window = await getCurrentWindow()
    if (isMaximized) {
      await window.unmaximize()
    } else if (isMinimized) {
      await window.unminimize()
    }
    // Refresh state after operation
    setIsMaximized(await window.isMaximized())
    setIsMinimized(await window.isMinimized())
  }

  const handleMinimize = async () => {
    const window = await getCurrentWindow()
    await window.minimize()
    // Refresh state after operation
    setIsMaximized(await window.isMaximized())
    setIsMinimized(await window.isMinimized())
  }

  const handleMaximize = async () => {
    const window = await getCurrentWindow()
    await window.maximize()
    // Refresh state after operation
    setIsMaximized(await window.isMaximized())
    setIsMinimized(await window.isMinimized())
  }

  const handleClose = () => {
    getCurrentWindow().close()
  }

  const canRestore = isMaximized || isMinimized
  const canMaximize = !isMaximized

  if (!isLoaded) {
    return null
  }

  return (
    <DropdownMenuContent align={align} alignOffset={alignOffset} className="w-40">
      <DropdownMenuItem onClick={handleRestore} disabled={!canRestore} data-action-id="restore">
        <RestoreIcon className="h-4 w-4" />
        Restore
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleMinimize} data-action-id="minimize">
        <MinusIcon className="h-4 w-4" />
        Minimize
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleMaximize} disabled={!canMaximize} data-action-id="maximize">
        <MaximizeIcon className="h-4 w-4" />
        Maximize
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={handleClose} data-action-id="close">
        <XIcon className="h-4 w-4" />
        Close
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
