import { getCurrentWindow } from "@tauri-apps/api/window"
import { MaximizeIcon, MinusIcon, XIcon, SquareIcon } from "lucide-react"

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"

export function WindowControlContextMenuContent() {
  const handleRestore = async () => {
    const window = await getCurrentWindow()
    const isMaximized = await window.isMaximized()
    const isMinimized = await window.isMinimized()

    if (isMaximized) {
      await window.unmaximize()
    } else if (isMinimized) {
      await window.unminimize()
    }
  }

  const handleMinimize = () => {
    getCurrentWindow().minimize()
  }

  const handleMaximize = () => {
    getCurrentWindow().maximize()
  }

  const handleClose = () => {
    getCurrentWindow().close()
  }

  return (
    <ContextMenuContent className="w-40">
      <ContextMenuItem onClick={handleRestore} data-action-id="restore">
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
      <ContextMenuItem
        variant="destructive"
        onClick={handleClose}
        data-action-id="close"
      >
        <XIcon className="h-4 w-4" />
        Close
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
