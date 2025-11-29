// noinspection DuplicatedCode

import type { MouseEvent, ReactNode } from "react"
import { useState } from "react"

import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { CopyIcon, Edit2Icon, FolderPlusIcon, GlobeIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { collectionsApi, utilitySheetsApi } from "@/state"
import { useDialogs } from "@/hooks/useDialogs"
import { RootCollectionFolderId } from "@/types"

export type ActiveMenuItem =
  | {
      kind: "collection"
      collectionId: string
      name: string
    }
  | {
      kind: "folder"
      collectionId: string
      folderId: string
      name: string
    }
  | {
      kind: "request"
      collectionId: string
      requestId: string
      name: string
    }
  | null

export type CollectionContextMenuProps = {
  children: ReactNode
}

export function CollectionContextMenu({ children }: CollectionContextMenuProps) {
  const [activeMenuItem, setActiveMenuItem] = useState<ActiveMenuItem>(null)
  const dialogs = useDialogs()

  const handleContextMenuOpen = (event: MouseEvent<HTMLDivElement>) => {
    // Walk up the tree to find the data attributes
    let target: HTMLElement | null = event.target as HTMLElement | null
    while (target && !target.dataset.kind) {
      target = target.parentElement
    }

    if (!target) {
      return
    }

    const collectionId = target.dataset.collectionId
    const requestId = target.dataset.requestId
    const folderId = target.dataset.folderId
    const kind = target.dataset.kind
    const name = target.dataset.name

    if (!collectionId || !kind || !name) {
      return
    }

    switch (kind) {
      case "collection":
        setActiveMenuItem({ kind, collectionId, name })
        break
      case "folder":
        if (folderId) {
          setActiveMenuItem({ kind, collectionId, folderId, name })
        }
        break
      case "request":
        if (requestId) {
          setActiveMenuItem({ kind, collectionId, requestId, name })
        }
        break
    }
  }

  const handleContextMenuClose = (open: boolean) => {
    if (!open) {
      setActiveMenuItem(null)
    }
  }

  return (
    <ContextMenu onOpenChange={handleContextMenuClose}>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenuOpen}>
        {children}
      </ContextMenuTrigger>
      {activeMenuItem && renderContextMenuContent(activeMenuItem, dialogs)}
    </ContextMenu>
  )
}

function renderContextMenuContent(activeMenuItem: NonNullable<ActiveMenuItem>, dialogs: ReturnType<typeof useDialogs>) {
  switch (activeMenuItem.kind) {
    case "request":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            onClick={() => {
              dialogs.showRenameDialog({
                title: "Rename Request",
                description: (
                  <>
                    Rename the <span className="text-lg text-primary">{activeMenuItem.name}</span> request?
                  </>
                ),
                context: {
                  kind: "request",
                  collectionId: activeMenuItem.collectionId,
                  requestId: activeMenuItem.requestId,
                },
                name: activeMenuItem.name,
                onConfirm: (ctx, newName) => {
                  collectionsApi().updateRequest(ctx.collectionId, ctx.requestId, { name: newName })
                },
              })
            }}
          >
            <Edit2Icon className="h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              try {
                collectionsApi().duplicateRequest(activeMenuItem.collectionId, activeMenuItem.requestId)
              } catch (error) {
                console.error(`Failed to duplicate request:${activeMenuItem.requestId}`, error)
              }
            }}
          >
            <CopyIcon className="h-4 w-4" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              try {
                const request = collectionsApi().getRequest(activeMenuItem.collectionId, activeMenuItem.requestId)
                if (request) {
                  void writeText(JSON.stringify(request, null, 2))
                }
              } catch (error) {
                console.error(`Failed to copy request:${activeMenuItem.requestId}`, error)
              }
            }}
          >
            <CopyIcon className="h-4 w-4" />
            Copy as JSON
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              dialogs.showDeleteDialog({
                title: "Delete Request",
                description: (
                  <>
                    Are you sure you want to delete the <span className="text-lg text-primary">{activeMenuItem.name}</span>{" "}
                    request?
                  </>
                ),
                context: {
                  kind: "request",
                  collectionId: activeMenuItem.collectionId,
                  requestId: activeMenuItem.requestId,
                },
                onConfirm: (ctx) => {
                  collectionsApi().deleteRequest(ctx.collectionId, ctx.requestId)
                },
              })
            }}
            variant="destructive"
          >
            <Trash2Icon className="h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      )
    case "folder":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            onClick={() => {
              dialogs.showRenameDialog({
                title: "Rename Folder",
                description: (
                  <>
                    Rename the <span className="text-lg text-primary">{activeMenuItem.name}</span> folder?
                  </>
                ),
                context: {
                  kind: "folder",
                  collectionId: activeMenuItem.collectionId,
                  folderId: activeMenuItem.folderId,
                },
                name: activeMenuItem.name,
                onConfirm: (ctx, newName) => {
                  collectionsApi().renameFolder(ctx.collectionId, ctx.folderId, newName)
                },
              })
            }}
          >
            <Edit2Icon className="h-4 w-4" />
            Rename Folder
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              dialogs.showCreateFolderDialog({
                collectionId: activeMenuItem.collectionId,
                parentId: activeMenuItem.folderId,
                onConfirm: (context) => {
                  try {
                    collectionsApi().createFolder(context.collectionId, activeMenuItem.folderId, context.name)
                  } catch (error) {
                    console.error("Failed to create folder", error)
                  }
                },
              })
            }}
          >
            <FolderPlusIcon className="h-4 w-4" />
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              dialogs.showDeleteDialog({
                title: "Delete Folder",
                description: (
                  <>
                    Are you sure you want to delete the <span className="text-lg text-primary">{activeMenuItem.name}</span>{" "}
                    folder?
                  </>
                ),
                context: {
                  kind: "folder",
                  collectionId: activeMenuItem.collectionId,
                  folderId: activeMenuItem.folderId,
                },
                onConfirm: (ctx) => {
                  collectionsApi().deleteFolder(ctx.collectionId, ctx.folderId)
                },
              })
            }}
            variant="destructive"
          >
            <Trash2Icon className="h-4 w-4" />
            Delete Folder
          </ContextMenuItem>
        </ContextMenuContent>
      )
    case "collection":
      return (
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onClick={() => {
              dialogs.showCreateRequestDialog({
                collectionId: activeMenuItem.collectionId,
                parentId: RootCollectionFolderId,
                onConfirm: (context) => {
                  try {
                    collectionsApi().createRequest(activeMenuItem.collectionId, RootCollectionFolderId, context.name)
                  } catch (error) {
                    console.error("Failed to create request", error)
                  }
                },
              })
            }}
          >
            <PlusIcon className="h-4 w-4" />
            New Request
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              dialogs.showCreateFolderDialog({
                collectionId: activeMenuItem.collectionId,
                parentId: RootCollectionFolderId,
                onConfirm: (context) => {
                  try {
                    collectionsApi().createFolder(activeMenuItem.collectionId, RootCollectionFolderId, context.name)
                  } catch (error) {
                    console.error("Failed to create folder", error)
                  }
                },
              })
            }}
          >
            <FolderPlusIcon className="h-4 w-4" />
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              dialogs.showRenameDialog({
                title: "Rename Collection",
                description: (
                  <>
                    Rename the <span className="text-lg text-primary">{activeMenuItem.name}</span> collection?
                  </>
                ),
                context: { kind: "collection", collectionId: activeMenuItem.collectionId },
                name: activeMenuItem.name,
                onConfirm: (ctx, newName) => {
                  collectionsApi().updateCollection(ctx.collectionId, { name: newName })
                },
              })
            }}
          >
            <Edit2Icon className="h-4 w-4" />
            Rename Collection
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              try {
                utilitySheetsApi().openSheet({
                  type: "collection-settings",
                  context: { collectionId: activeMenuItem.collectionId },
                })
              } catch (error) {
                console.error("Failed to open collection settings", error)
              }
            }}
          >
            <GlobeIcon className="h-4 w-4" />
            Manage Settings
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              try {
                utilitySheetsApi().openSheet({ type: "export", context: { collectionId: activeMenuItem.collectionId } })
              } catch (error) {
                console.error("Failed to open export sheet", error)
              }
            }}
          >
            <UploadIcon className="h-4 w-4" />
            Export Collection
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              dialogs.showDeleteDialog({
                title: "Delete Collection",
                description: (
                  <>
                    Are you sure you want to delete the <span className="text-lg text-primary">{activeMenuItem.name}</span>{" "}
                    collection?
                  </>
                ),
                context: { kind: "collection", collectionId: activeMenuItem.collectionId },
                onConfirm: (ctx) => {
                  collectionsApi().removeCollection(ctx.collectionId)
                },
              })
            }}
            variant="destructive"
          >
            <Trash2Icon className="h-4 w-4" />
            Delete Collection
          </ContextMenuItem>
        </ContextMenuContent>
      )
  }
}
