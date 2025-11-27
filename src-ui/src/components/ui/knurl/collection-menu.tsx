import type React from "react"

import { Edit2Icon, FolderPlusIcon, GlobeIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { isScratchCollection, useCollections, useOpenTabs, utilitySheetsApi } from "@/state"
import { RootCollectionFolderId } from "@/types"

export type CollectionAction =
  | "request:new"
  | "folder:new"
  | "rename"
  | "manage-settings"
  | "export"
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
  exclude?: CollectionAction[]
  onAction?: (
    event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement> | MenuActionPayload,
  ) => void
}

export function CollectionMenuContent({ collection, exclude = [], onAction }: CollectionMenuContentProps) {
  const {
    actions: { collectionsApi },
  } = useCollections()
  const {
    actions: { requestTabsApi: requestsTabsApi },
  } = useOpenTabs()
  const sheetsApi = utilitySheetsApi()

  const isScratch = isScratchCollection(collection.id)

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
    "rename",
    "manage-settings",
    "export",
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

  const hasNonDestructive = visible.some((id) => ["request:new", "rename", "manage-settings", "export"].includes(id))
  const hasDestructive = visible.some((id) => ["delete", "clear-scratch"].includes(id))

  return (
    <DropdownMenuContent className="w-56" align="start" sideOffset={2}>
      {visible.includes("request:new") &&
        renderItem("request:new", "New Request", <PlusIcon className="mr-2 h-4 w-4" />)}
      {visible.includes("folder:new") &&
        renderItem("folder:new", "New Folder", <FolderPlusIcon className="mr-2 h-4 w-4" />, false, {
          "data-parent-id": RootCollectionFolderId,
        })}
      {visible.some((id) => ["rename", "manage-settings", "export"].includes(id)) &&
        (visible.includes("request:new") || visible.includes("folder:new")) && <DropdownMenuSeparator />}
      {visible.includes("rename") && renderItem("rename", "Rename", <Edit2Icon className="mr-2 h-4 w-4" />)}
      {visible.includes("manage-settings") &&
        renderItem("manage-settings", "Manage Settings", <GlobeIcon className="mr-2 h-4 w-4 text-primary" />)}
      {visible.includes("export") && renderItem("export", "Export", <UploadIcon className="mr-2 h-4 w-4" />)}
      {hasDestructive && hasNonDestructive && <DropdownMenuSeparator />}
      {visible.includes("clear-scratch") &&
        renderItem("clear-scratch", "Clear All", <Trash2Icon className="mr-2 h-4 w-4" />, true)}
      {visible.includes("delete") && renderItem("delete", "Delete", <Trash2Icon className="mr-2 h-4 w-4" />, true)}
    </DropdownMenuContent>
  )
}
