import { useCallback, useMemo } from "react"
import type React from "react"

import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  Edit2Icon,
  FolderPlusIcon,
  GlobeIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { isScratchCollection, useCollections, useOpenTabs, utilitySheetsApi } from "@/state"
import { RootCollectionFolderId } from "@/types"

export type CollectionAction =
  | "request:new"
  | "folder:new"
  | "rename"
  | "manage-settings"
  | "export"
  | "copy-json"
  | "move-up"
  | "move-down"
  | "delete"
  | "clear-scratch"

type MenuActionPayload = {
  actionId: CollectionAction
  kind: "collection"
  collectionId: string
  name: string
  parentId?: string | null
}

export type CollectionMenuContentProps = {
  collection: { id: string; name: string }
  collectionsIndex?: Array<{ id: string }>
  exclude?: CollectionAction[]
  onAction?: (
    event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement> | MenuActionPayload,
  ) => void
}

export function CollectionMenuContent({
  collection,
  collectionsIndex,
  exclude = [],
  onAction,
}: CollectionMenuContentProps) {
  const {
    actions: { collectionsApi },
    state: { collectionsIndex: defaultIndex },
  } = useCollections()
  const {
    actions: { requestTabsApi: requestsTabsApi },
  } = useOpenTabs()
  const sheetsApi = utilitySheetsApi()

  const isScratch = isScratchCollection(collection.id)
  const index = collectionsIndex ?? defaultIndex

  const currentIndex = useMemo(() => index.findIndex((entry) => entry.id === collection.id), [index, collection.id])
  const canMoveUp = useMemo(() => currentIndex > 0, [currentIndex])
  const canMoveDown = useMemo(() => currentIndex >= 0 && currentIndex < index.length - 1, [currentIndex, index.length])

  const handleMoveUp = useCallback(() => {
    if (canMoveUp) {
      const newOrder = [...index]
      ;[newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]]
      collectionsApi().reorderCollections(newOrder.map((e) => e.id))
    }
  }, [canMoveUp, currentIndex, index, collectionsApi])

  const handleMoveDown = useCallback(() => {
    if (canMoveDown) {
      const newOrder = [...index]
      ;[newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]]
      collectionsApi().reorderCollections(newOrder.map((e) => e.id))
    }
  }, [canMoveDown, currentIndex, index, collectionsApi])

  const internalActions: Record<CollectionAction, () => void> = {
    "request:new": () => requestsTabsApi.createRequestTab(collection.id),
    "folder:new": () => {
      try {
        collectionsApi().createFolder(collection.id, RootCollectionFolderId, "New Folder")
      } catch (error) {
        console.error("Failed to create folder", error)
      }
    },
    rename: () => {
      console.error("[CollectionMenu] Rename action should be handled via onAction callback")
    },
    "manage-settings": () => {
      try {
        sheetsApi.openSheet({ type: "collection-settings", context: { collectionId: collection.id } })
      } catch (error) {
        console.error("Failed to open collection settings", error)
      }
    },
    export: () => {
      try {
        sheetsApi.openSheet({ type: "export", context: { collectionId: collection.id } })
      } catch (error) {
        console.error("Failed to open export sheet", error)
      }
    },
    "copy-json": () => {
      try {
        const col = collectionsApi().getCollection(collection.id)
        if (col) {
          const { requestIndex: _, ...collectionData } = col
          void navigator.clipboard.writeText(JSON.stringify(collectionData, null, 2))
        }
      } catch (error) {
        console.error("Failed to copy collection as JSON", error)
      }
    },
    "move-up": handleMoveUp,
    "move-down": handleMoveDown,
    delete: () => {
      try {
        collectionsApi().removeCollection(collection.id)
      } catch (error) {
        console.error("Failed to remove collection", error)
      }
    },
    "clear-scratch": () => {
      try {
        collectionsApi().clearScratchCollection()
      } catch (error) {
        console.error("Failed to clear scratch collection", error)
      }
    },
  }

  const visible: CollectionAction[] = [
    "request:new",
    "folder:new",
    "move-up",
    "move-down",
    "rename",
    "manage-settings",
    "export",
    "copy-json",
    isScratch ? "clear-scratch" : "delete",
  ]
    .filter((id) => !exclude.includes(id))
    .filter((id) => !(isScratch && id === "folder:new")) as CollectionAction[]

  const renderItem = (
    id: CollectionAction,
    label: string,
    icon: React.ReactNode,
    destructive?: boolean,
    extraDataset?: Record<string, string | undefined>,
    disabled?: boolean,
  ) => {
    let handled = false

    const dataset =
      onAction !== undefined
        ? {
            "data-action-id": id,
            "data-kind": "collection",
            "data-collection-id": collection.id,
            "data-name": collection.name,
            ...(extraDataset ?? {}),
          }
        : undefined

    const handleSelect = async (_event?: Event) => {
      if (handled) {
        return
      }
      handled = true

      if (onAction) {
        const payload: MenuActionPayload = {
          actionId: id,
          kind: "collection",
          collectionId: collection.id,
          name: collection.name,
        }
        const parent = extraDataset?.["data-parent-id"]
        if (parent !== undefined) {
          payload.parentId = parent ?? null
        }
        onAction(payload)
        return
      }
      await collectionsApi().loadCollection(collection.id)
      internalActions[id]()
    }

    return (
      <DropdownMenuItem
        key={id}
        className="cursor-pointer"
        variant={destructive ? "destructive" : "default"}
        disabled={disabled}
        {...dataset}
        data-test-id={`collection-menu:item:${id}:${collection.id}`}
        onSelect={(event) => {
          void handleSelect(event as unknown as Event)
        }}
        onClick={(event) => {
          void handleSelect(event as unknown as Event)
        }}
      >
        {icon} {label}
      </DropdownMenuItem>
    )
  }

  const hasMovement = visible.some((id) => ["move-up", "move-down"].includes(id))
  const hasNonDestructive = visible.some((id) =>
    ["request:new", "rename", "manage-settings", "export", "copy-json"].includes(id),
  )
  const hasDestructive = visible.some((id) => ["delete", "clear-scratch"].includes(id))

  return (
    <DropdownMenuContent className="w-56" align="start" sideOffset={2}>
      {visible.includes("request:new") &&
        renderItem("request:new", "New Request", <PlusIcon className="mr-2 h-4 w-4" />)}
      {visible.includes("folder:new") &&
        renderItem("folder:new", "New Folder", <FolderPlusIcon className="mr-2 h-4 w-4" />, false, {
          "data-parent-id": RootCollectionFolderId,
        })}
      {(visible.includes("move-up") || visible.includes("move-down")) &&
        (visible.includes("request:new") || visible.includes("folder:new")) && <DropdownMenuSeparator />}
      {visible.includes("move-up") &&
        renderItem("move-up", "Move Up", <ChevronUpIcon className="mr-2 h-4 w-4" />, false, undefined, !canMoveUp)}
      {visible.includes("move-down") &&
        renderItem(
          "move-down",
          "Move Down",
          <ChevronDownIcon className="mr-2 h-4 w-4" />,
          false,
          undefined,
          !canMoveDown,
        )}
      {hasMovement && (hasNonDestructive || hasDestructive) && <DropdownMenuSeparator />}
      {visible.includes("rename") && renderItem("rename", "Rename", <Edit2Icon className="mr-2 h-4 w-4" />)}
      {visible.includes("manage-settings") &&
        renderItem("manage-settings", "Manage Settings", <GlobeIcon className="mr-2 h-4 w-4 text-primary" />)}
      {visible.includes("export") && renderItem("export", "Export", <UploadIcon className="mr-2 h-4 w-4" />)}
      {visible.includes("copy-json") && renderItem("copy-json", "Copy as JSON", <CopyIcon className="mr-2 h-4 w-4" />)}
      {(hasNonDestructive || hasMovement) && hasDestructive && <DropdownMenuSeparator />}
      {visible.includes("clear-scratch") &&
        renderItem("clear-scratch", "Clear All", <Trash2Icon className="mr-2 h-4 w-4" />, true)}
      {visible.includes("delete") && renderItem("delete", "Delete", <Trash2Icon className="mr-2 h-4 w-4" />, true)}
    </DropdownMenuContent>
  )
}
