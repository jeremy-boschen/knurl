import type React from "react"

import { Edit2Icon, FolderPlusIcon, GlobeIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { isScratchCollection, useCollections, useOpenTabs, utilitySheetsApi } from "@/state"
import { RootCollectionFolderId } from "@/types"

export type CollectionAction =
  | "new-request"
  | "new-folder"
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

type CollectionMenuContentProps = {
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
    "new-request": () => requestsTabsApi.createRequestTab(collection.id),
    "new-folder": () =>
      collectionsApi()
        .createFolder(collection.id, RootCollectionFolderId, "New Folder")
        .catch((error) => console.error("Failed to create folder", error)),
    rename: () => sheetsApi.openSheet({ type: "collection-settings", context: { collectionId: collection.id } }),
    "manage-settings": () =>
      sheetsApi.openSheet({ type: "collection-settings", context: { collectionId: collection.id } }),
    export: () => sheetsApi.openSheet({ type: "export", context: { collectionId: collection.id } }),
    delete: () => collectionsApi().removeCollection(collection.id),
    "clear-scratch": () => collectionsApi().clearScratchCollection(),
  }

  const visible: CollectionAction[] = [
    "new-request",
    "new-folder",
    "rename",
    "manage-settings",
    "export",
    isScratch ? "clear-scratch" : "delete",
  ]
    .filter((id) => !exclude.includes(id))
    .filter((id) => !(isScratch && id === "new-folder")) as CollectionAction[]

  const renderItem = (
    id: CollectionAction,
    label: string,
    icon: React.ReactNode,
    destructive?: boolean,
    extraDataset?: Record<string, string | undefined>,
  ) => (
    <DropdownMenuItem
      key={id}
      className="cursor-pointer"
      variant={destructive ? "destructive" : "default"}
      {...(onAction
        ? {
            onSelect: () => {
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
            },
            "data-action-id": id,
            "data-kind": "collection",
            "data-collection-id": collection.id,
            "data-name": collection.name,
            ...(extraDataset ?? {}),
          }
        : {
            onSelect: (e: Event) => {
              e.preventDefault?.()
              internalActions[id]()
            },
          })}
    >
      {icon} {label}
    </DropdownMenuItem>
  )

  const hasNonDestructive = visible.some((id) => ["new-request", "rename", "manage-settings", "export"].includes(id))
  const hasDestructive = visible.some((id) => ["delete", "clear-scratch"].includes(id))

  return (
    <DropdownMenuContent className="w-56" align="start" sideOffset={2}>
      {visible.includes("new-request") &&
        renderItem("new-request", "New Request", <PlusIcon className="mr-2 h-4 w-4" />)}
      {visible.includes("new-folder") &&
        renderItem("new-folder", "New Folder", <FolderPlusIcon className="mr-2 h-4 w-4" />, false, {
          "data-parent-id": RootCollectionFolderId,
        })}
      {visible.some((id) => ["rename", "manage-settings", "export"].includes(id)) &&
        (visible.includes("new-request") || visible.includes("new-folder")) && <DropdownMenuSeparator />}
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
