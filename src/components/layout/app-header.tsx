import { RequestTabBar } from "@/components/request/tabbar"
import { cn } from "@/lib"
import { TitleBar } from "./title-bar"

export function AppHeader({ className }: { className: string }) {
  return (
    <div className={cn("flex flex-col bg-background", className)}>
      {/* Top row: Title bar and window controls */}
      <div className="flex h-10 items-center justify-end bg-background" data-tauri-drag-region>
        <TitleBar />
      </div>
      {/* Bottom row: Request tabs */}
      <div className="flex-grow bg-sidebar">
        <RequestTabBar />
      </div>
    </div>
  )
}
