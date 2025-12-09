import { useLayoutEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { MaximizeIcon, MinusIcon, XIcon } from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { RestoreIcon } from "@/components/icons"

type WindowState = {
  isMaximized: boolean
  isMinimized: boolean
}

function useWindowState() {
  const [state, setState] = useState<WindowState | null>(null)

  useLayoutEffect(() => {
    const loadWindowState = async () => {
      const window = await getCurrentWindow()
      const [isMaximized, isMinimized] = await Promise.all([
        window.isMaximized(),
        window.isMinimized(),
      ])
      setState({ isMaximized, isMinimized })
    }

    loadWindowState()
  }, [])

  const refreshState = async () => {
    const window = await getCurrentWindow()
    const [isMaximized, isMinimized] = await Promise.all([
      window.isMaximized(),
      window.isMinimized(),
    ])
    setState({ isMaximized, isMinimized })
  }

  return { state, refreshState }
}

export function WindowControlDropdownMenuContent({
  align,
  alignOffset,
}: {
  align?: "start" | "center" | "end"
  alignOffset?: number
}) {
  const { state, refreshState } = useWindowState()

  const handleRestore = async () => {
    const window = await getCurrentWindow()
    if (state?.isMaximized) {
      await window.unmaximize()
    } else if (state?.isMinimized) {
      await window.unminimize()
    }
    await refreshState()
  }

  const handleMinimize = async () => {
    const window = await getCurrentWindow()
    await window.minimize()
    await refreshState()
  }

  const handleMaximize = async () => {
    const window = await getCurrentWindow()
    await window.maximize()
    await refreshState()
  }

  const handleClose = () => {
    getCurrentWindow().close()
  }

  if (!state) {
    return null
  }

  const canRestore = state.isMaximized || state.isMinimized
  const canMaximize = !state.isMaximized

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
