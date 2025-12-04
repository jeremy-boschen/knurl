import { useLayoutEffect, useRef, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { MaximizeIcon, MinusIcon, XIcon } from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Restore</title>
      {/* Bottom right square */}
      <rect x="5" y="9" width="6" height="6" rx="1" />
      {/* Top left square */}
      <rect x="13" y="3" width="6" height="6" rx="1" />
    </svg>
  )
}

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
        <RestoreIcon className="h-4 w-4" />
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
