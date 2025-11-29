import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { RequestContextMenuContent } from "@/components/ui/knurl/request-context-menu"
import type { ActiveMenuItem } from "./collection-tree2"

type CollectionTreeContextMenuContentProps = {
  activeMenuItem: ActiveMenuItem
}

export function ContextMenuContentProvider({ activeMenuItem }: CollectionTreeContextMenuContentProps) {
  if (!activeMenuItem) {
    return null
  }

  switch (activeMenuItem.kind) {
    case "request": {
      // biome-ignore lint/style/noNonNullAssertion: requestId is guaranteed for request kind
      const requestId = activeMenuItem.requestId!
      return (
        <RequestContextMenuContent
          collectionId={activeMenuItem.collectionId}
          requestId={requestId}
          requestName={activeMenuItem.name}
        />
      )
    }
    case "folder":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => console.log("Rename folder:", activeMenuItem.name)}>
            Rename Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => console.log("Delete folder:", activeMenuItem.name)} variant="destructive">
            Delete Folder
          </ContextMenuItem>
        </ContextMenuContent>
      )
    case "collection":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => console.log("Rename collection:", activeMenuItem.name)}>
            Rename Collection
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => console.log("Delete collection:", activeMenuItem.name)} variant="destructive">
            Delete Collection
          </ContextMenuItem>
        </ContextMenuContent>
      )
  }
}
