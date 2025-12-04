import { useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { MaximizeIcon, MinusIcon, XIcon, SquareIcon } from "lucide-react"

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"

export function WindowControlContextMenuContent() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    const updateWindowState = async () => {
      const window = await getCurrentWindow()
      setIsMaximized(await window.isMaximized())
      setIsMinimized(await window.isMinimized())
    }

    updateWindowState()
  }, [])

  const handleRestore = async () => {
    const window = await getCurrentWindow()
    if (isMaximized) {
      await window.unmaximize()
      setIsMaximized(false)
    } else if (isMinimized) {
      await window.unminimize()
      setIsMinimized(false)
    }
  }

  const handleMinimize = () => {
    getCurrentWindow().minimize()
    setIsMinimized(true)
  }

  const handleMaximize = () => {
    getCurrentWindow().maximize()
    setIsMaximized(true)
  }

  const handleClose = () => {
    getCurrentWindow().close()
  }

  const canRestore = isMaximized || isMinimized

  return (
    <ContextMenuContent className="w-40">
      <ContextMenuItem onClick={handleRestore} disabled={!canRestore} data-action-id="restore">
        <SquareIcon className="h-4 w-4" />
        Restore
      </ContextMenuItem>
      <ContextMenuItem onClick={handleMinimize} data-action-id="minimize">
        <MinusIcon className="h-4 w-4" />
        Minimize
      </ContextMenuItem>
      <ContextMenuItem onClick={handleMaximize} data-action-id="maximize">
        <MaximizeIcon className="h-4 w-4" />
        Maximize
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={handleClose} data-action-id="close">
        <XIcon className="h-4 w-4" />
        Close
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
