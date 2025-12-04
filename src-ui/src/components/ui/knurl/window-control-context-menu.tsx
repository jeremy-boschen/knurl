import { useLayoutEffect, useRef, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { MaximizeIcon, MinusIcon, XIcon, SquareIcon } from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

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

  useLayoutEffect(() => {
    const updateWindowState = async () => {
      const window = await getCurrentWindow()
      setIsMaximized(await window.isMaximized())
      setIsMinimized(await window.isMinimized())
      isLoadedRef.current = true
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

  const canRestore = isLoadedRef.current && (isMaximized || isMinimized)

  return (
    <DropdownMenuContent align={align} alignOffset={alignOffset} className="w-40">
      <DropdownMenuItem onClick={handleRestore} disabled={!canRestore} data-action-id="restore">
        <SquareIcon className="h-4 w-4" />
        Restore
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleMinimize} data-action-id="minimize">
        <MinusIcon className="h-4 w-4" />
        Minimize
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleMaximize} data-action-id="maximize">
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
