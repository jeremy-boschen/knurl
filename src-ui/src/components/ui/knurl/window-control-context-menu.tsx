import { useCallback, useLayoutEffect, useRef, useState } from "react"
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
  const isLoadedRef = useRef(false)

  const updateWindowState = useCallback(async () => {
    const window = await getCurrentWindow()
    setIsMaximized(await window.isMaximized())
    setIsMinimized(await window.isMinimized())
  }, [])

  useLayoutEffect(() => {
    const initWindowState = async () => {
      await updateWindowState()
      isLoadedRef.current = true
    }

    initWindowState()
  }, [updateWindowState])

  const handleRestore = async () => {
    const window = await getCurrentWindow()
    if (isMaximized) {
      await window.unmaximize()
    } else if (isMinimized) {
      await window.unminimize()
    }
    await updateWindowState()
  }

  const handleMinimize = async () => {
    await getCurrentWindow().minimize()
    await updateWindowState()
  }

  const handleMaximize = async () => {
    await getCurrentWindow().maximize()
    await updateWindowState()
  }

  const handleClose = () => {
    getCurrentWindow().close()
  }

  const canRestore = isLoadedRef.current && (isMaximized || isMinimized)
  const canMaximize = isLoadedRef.current && !isMaximized

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
