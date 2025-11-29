import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { RequestContextMenuContent } from "@/components/ui/knurl/request-context-menu"
import type { ActiveMenuItem } from "./collection-tree2"

export type ContextMenuAction =
  | {
      actionId: "rename" | "delete"
      kind: "folder" | "collection"
      collectionId: string
      folderId?: string
      name: string
    }
  | {
      actionId: "rename" | "delete" | "duplicate" | "copy"
      kind: "request"
      collectionId: string
      requestId: string
      name: string
    }

type CollectionTreeContextMenuContentProps = {
  activeMenuItem: ActiveMenuItem
  onAction: (action: ContextMenuAction) => void
}

export function ContextMenuContentProvider({ activeMenuItem, onAction }: CollectionTreeContextMenuContentProps) {
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
          onRename={() =>
            onAction({
              actionId: "rename",
              kind: "request",
              collectionId: activeMenuItem.collectionId,
              requestId,
              name: activeMenuItem.name,
            })
          }
          onDelete={() =>
            onAction({
              actionId: "delete",
              kind: "request",
              collectionId: activeMenuItem.collectionId,
              requestId,
              name: activeMenuItem.name,
            })
          }
        />
      )
    }
    case "folder":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            onClick={() =>
              onAction({
                actionId: "rename",
                kind: "folder",
                collectionId: activeMenuItem.collectionId,
                folderId: activeMenuItem.folderId,
                name: activeMenuItem.name,
              })
            }
          >
            Rename Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() =>
              onAction({
                actionId: "delete",
                kind: "folder",
                collectionId: activeMenuItem.collectionId,
                folderId: activeMenuItem.folderId,
                name: activeMenuItem.name,
              })
            }
            variant="destructive"
          >
            Delete Folder
          </ContextMenuItem>
        </ContextMenuContent>
      )
    case "collection":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            onClick={() =>
              onAction({
                actionId: "rename",
                kind: "collection",
                collectionId: activeMenuItem.collectionId,
                name: activeMenuItem.name,
              })
            }
          >
            Rename Collection
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() =>
              onAction({
                actionId: "delete",
                kind: "collection",
                collectionId: activeMenuItem.collectionId,
                name: activeMenuItem.name,
              })
            }
            variant="destructive"
          >
            Delete Collection
          </ContextMenuItem>
        </ContextMenuContent>
      )
  }
}
