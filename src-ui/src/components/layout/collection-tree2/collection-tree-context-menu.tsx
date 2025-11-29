import { RequestContextMenuContent } from "@/components/ui/knurl/request-context-menu"
import type { ActiveMenuItem } from "./collection-tree2"

type CollectionTreeContextMenuContentProps = {
  activeMenuItem: ActiveMenuItem
}

export function CollectionTreeContextMenuContent({
  activeMenuItem,
}: CollectionTreeContextMenuContentProps) {
  if (!activeMenuItem) {
    return null
  }

  switch (activeMenuItem.kind) {
    case "request":
      return (
        <RequestContextMenuContent
          collectionId={activeMenuItem.collectionId}
          requestId={activeMenuItem.requestId!}
          requestName={activeMenuItem.name}
        />
      )
    case "folder":
      // TODO: Implement folder context menu
      return null
    case "collection":
      // TODO: Implement collection context menu
      return null
  }
}
