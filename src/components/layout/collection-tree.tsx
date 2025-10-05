import React, { Suspense, useCallback } from "react"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { capitalize } from "es-toolkit"
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  Edit2Icon,
  EllipsisIcon,
  FolderClosedIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { CollectionMenuContent } from "@/components/collection/collection-menu-content"
import ErrorBoundary from "@/components/error/error-boundary"
import { DndTreeProvider, useDndTreeContext, useOptionalDndTreeContext } from "@/components/layout/dnd-tree-context"
import DeleteDialog from "@/components/shared/delete-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HttpBadge } from "@/components/ui/knurl"
import RenameDialog from "@/components/ui/knurl/rename-dialog"
import { cn, isNotEmpty } from "@/lib/utils"
import {
  collectionsApi,
  isScratchCollection,
  useApplication,
  useCollection,
  useCollections,
  useOpenTabs,
  useSidebar,
  useUtilitySheets,
} from "@/state"
import type { CollectionCacheState, CollectionFolderNode, RequestState } from "@/types"
import { RootCollectionFolderId } from "@/types"

type FolderOption = {
  id: string
  path: string
  depth: number
}

const buildFolderOptions = (collection: CollectionCacheState): FolderOption[] => {
  const result: FolderOption[] = []

  const traverse = (folderId: string, ancestry: string[]) => {
    const node = collection.folders[folderId]
    if (!node) {
      return
    }
    const label = folderId === RootCollectionFolderId ? "Root" : node.name
    const pathSegments = [...ancestry, label]
    result.push({ id: folderId, path: pathSegments.join(" / "), depth: pathSegments.length - 1 })
    for (const childId of node.childFolderIds) {
      traverse(childId, [...ancestry, label])
    }
  }

  traverse(RootCollectionFolderId, [])
  return result
}

type RenameContext =
  | {
      kind: "request"
      collectionId: string
      requestId: string
    }
  | {
      kind: "collection"
      collectionId: string
      requestId: never
    }
  | {
      kind: "folder"
      collectionId: string
      folderId: string
    }

type DeleteContext =
  | {
      kind: "request"
      collectionId: string
      requestId: string
    }
  | {
      kind: "collection"
      collectionId: string
      requestId: never
    }
  | {
      kind: "folder"
      collectionId: string
      folderId: string
    }

type ClearScratchContext = {
  collectionId: string
}

type FolderCreateContext = {
  collectionId: string
  parentId: string | null
}

type FolderDragData = {
  type: "folder-item"
  collectionId: string
  folderId: string
  parentId: string
  siblings: string[]
  childIds: string[]
}

type CollectionDragData = {
  type: "collection"
  collectionId: string
}

type RequestDragData = {
  type: "request-item"
  collectionId: string
  requestId: string
  folderId: string
  siblings: string[]
}

type DragPayload = FolderDragData | CollectionDragData | RequestDragData
export type DropPosition = "top" | "bottom" | "middle" | null

type DialogProps =
  | { action: "rename"; name: string; title: string; description: React.ReactNode; context: RenameContext }
  | { action: "delete"; name: string; title: string; description: React.ReactNode; context: DeleteContext }
  | {
      action: "clear-scratch"
      name: string
      title: string
      description: React.ReactNode
      context: ClearScratchContext
    }
  | { action: "export"; context: string }
  | {
      action: "folder-create"
      name: string
      title: string
      description: React.ReactNode
      context: FolderCreateContext
    }

const MAX_COLLECTIONS_WHEN_COLLAPSED = 10

type ActionId =
  | "select"
  | "select:expand"
  | "new-request"
  | "new-folder"
  | "rename"
  | "manage-settings"
  | "export"
  | "delete"
  | "clear-scratch"
  | "copy"
  | "duplicate"
  | "request:move"
  | "folder:new"
  | "folder:rename"
  | "folder:delete"

type ActionPayload = {
  actionId: ActionId
  kind: string
  collectionId?: string
  requestId?: string
  folderId?: string
  parentId?: string | null
  targetFolderId?: string
  name?: string
}

type CollectionsTreeProps = {
  searchTerm: string | undefined
}

export function CollectionTree({ searchTerm }: CollectionsTreeProps) {
  const {
    state: { collectionsIndex },
    actions: { collectionsApi },
  } = useCollections()
  const {
    state: { isCollapsed },
    actions: { expandSidebar },
  } = useSidebar()
  const {
    actions: { requestTabsApi },
  } = useOpenTabs()
  const {
    actions: { utilitySheetsApi: sheetsApi },
  } = useUtilitySheets()

  // DnD sensors
  const treeSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }

    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length > 0) {
      return rectCollisions
    }

    return closestCenter(args)
  }

  ///
  /// Expanded and selected state of each CollectionRow. Managed here because so we can transition
  /// a collection to expanded when the tree is collapsed
  ///
  type RowState = {
    current: {
      collectionId?: string
      requestId?: string
    }
    opened: Record<string, boolean>
  }
  const [rowState, setRowState] = React.useState<RowState>({
    current: {},
    opened: {},
  })

  ///
  /// Rename/Delete dialog support
  ///
  const [dialogProps, setDialogProps] = React.useState<DialogProps | null>(null)
  const ignoreNextClickRef = React.useRef(false)

  ///
  /// DnD State
  ///
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = React.useState<{ id: string; position: DropPosition } | null>(null)

  const handleAction = async (
    input: ActionPayload | Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => {
    if ("key" in input) {
      if (input.key !== "Enter" && input.key !== " ") {
        return
      }
    }

    let actionId: ActionId | undefined
    let kind: string | undefined
    let collectionId: string | undefined
    let requestId: string | undefined
    let name: string | undefined
    const dataset: Record<string, string | undefined> = {}

    if ("actionId" in input) {
      ignoreNextClickRef.current = true
      actionId = input.actionId
      kind = input.kind
      collectionId = input.collectionId
      requestId = input.requestId
      name = input.name
      if (input.folderId) {
        dataset.folderId = input.folderId
      }
      if (input.parentId != null) {
        dataset.parentId = input.parentId ?? undefined
      }
      if (input.targetFolderId) {
        dataset.targetFolderId = input.targetFolderId
      }
    } else {
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false
        const evt = input as Event
        evt.preventDefault?.()
        evt.stopPropagation?.()
        return
      }
      const target = (input as Event).currentTarget as HTMLElement | null
      if (!target) {
        return
      }
      const ds = target.dataset
      actionId = ds.actionId as ActionId | undefined
      kind = ds.kind
      collectionId = ds.collectionId
      requestId = ds.requestId
      name = ds.name
      dataset.folderId = ds.folderId
      dataset.parentId = ds.parentId
      dataset.targetFolderId = ds.targetFolderId
    }

    if (!actionId) {
      console.error("[CollectionTree] handleAction missing actionId", { dataset })
      return
    }

    if (["select", "select:expand"].includes(actionId)) {
      if (!("actionId" in input)) {
        ;(input as Event).preventDefault?.()
      }
    }

    if (!("actionId" in input)) {
      ;(input as Event).stopPropagation?.()
    }

    kind = kind ?? "collection"

    const domEvent = "actionId" in input ? undefined : (input as Event & { ctrlKey?: boolean; metaKey?: boolean })

    switch (actionId) {
      case "select:expand":
      case "select": {
        // Always expand the sidebar when a collection/request is selected
        expandSidebar()

        if (collectionId) {
          // Fire off loading the collection. No need to wait for it. The CollectionRow will handle that.
          void collectionsApi().getCollection(collectionId)

          // If we're expanding the sidebar because a folder was clicked, and the folder clicked was already open,
          // then we don't want to toggle it.
          if (actionId === "select:expand" && rowState.opened[collectionId]) {
            return
          }

          setRowState((state) => ({
            current: {
              collectionId,
              requestId,
            },
            opened: {
              ...state.opened,
              // If selecting a request, the collection is always open; otherwise we're toggling the collection
              [collectionId]: kind === "request" ? true : !state.opened[collectionId],
            },
          }))

          if (requestId) {
            // Fire & Forget
            void requestTabsApi.openRequestTab(collectionId, requestId)
          }
        }
        break
      }
      case "new-request": {
        if (collectionId) {
          void requestTabsApi.createRequestTab(collectionId)
        }
        break
      }
      case "clear-scratch": {
        setDialogProps({
          action: "clear-scratch",
          name,
          title: "Clear All Requests",
          description: (
            <>
              Are you sure you want to clear all requests from the <span className="text-lg text-primary">{name}</span>{" "}
              collection?
            </>
          ),
          context: {
            collectionId,
          },
        })
        break
      }
      case "delete":
      case "rename": {
        if (kind === "folder") {
          const folderId = dataset.folderId
          if (!collectionId || !folderId) {
            return
          }
          setDialogProps({
            action: actionId,
            name,
            title: `${capitalize(actionId)} Folder`,
            description:
              actionId === "rename" ? (
                <>
                  Rename the <span className="text-lg text-primary">{name}</span> folder?
                </>
              ) : (
                <>
                  Deleting the <span className="text-lg text-primary">{name}</span> folder will remove all nested
                  folders and requests. This cannot be undone.
                </>
              ),
            context: {
              kind: "folder",
              collectionId,
              folderId,
            },
          })
          break
        }

        const hasModifier =
          actionId === "delete" && domEvent && ((domEvent.ctrlKey ?? false) || (domEvent.metaKey ?? false))
        if (hasModifier) {
          void handleDelete({
            kind,
            collectionId,
            requestId,
          })

          return
        }

        setDialogProps({
          action: actionId,
          name,
          title: `${capitalize(actionId)} ${capitalize(kind)}`,
          description:
            actionId === "rename" ? (
              <>
                Rename the <span className="text-lg text-primary">{name}</span> {kind}?
              </>
            ) : (
              <>
                Are you sure you want to delete the <span className="text-lg text-primary">{name}</span> {kind}?
              </>
            ),
          context: {
            kind,
            collectionId,
            requestId,
          },
        })
        break
      }
      case "manage-settings": {
        if (collectionId) {
          sheetsApi.openSheet({
            type: "collection-settings",
            context: { collectionId },
          })
        }
        break
      }
      case "export": {
        if (collectionId) {
          sheetsApi.openSheet({
            type: "export",
            context: { collectionId },
          })
        }
        break
      }
      case "duplicate": {
        if (collectionId && requestId) {
          void collectionsApi().duplicateRequest(collectionId, requestId)
        }
        break
      }
      case "copy": {
        if (collectionId && requestId) {
          const request = await collectionsApi().getRequest(collectionId, requestId)
          if (request) {
            void navigator.clipboard.writeText(JSON.stringify(request, null, 2))
          }
        }
        break
      }
      case "request:move": {
        if (collectionId && requestId && dataset.targetFolderId) {
          await collectionsApi().moveRequestToFolder(collectionId, requestId, dataset.targetFolderId)
        }
        break
      }
      case "request:new": {
        if (collectionId && dataset.folderId) {
          void requestTabsApi.createRequestTab(collectionId, { folderId: dataset.folderId })
        }
        break
      }
      case "new-folder":
      case "folder:new": {
        if (collectionId) {
          const parentId = dataset.parentId ?? dataset.folderId ?? RootCollectionFolderId
          setDialogProps({
            action: "folder-create",
            name: "",
            title: "Create Folder",
            description: "Add a new folder to organize requests.",
            context: {
              collectionId,
              parentId,
            },
          })
        }
        break
      }
      case "folder:rename": {
        if (collectionId && dataset.folderId && name) {
          setDialogProps({
            action: "rename",
            name,
            title: "Rename Folder",
            description: (
              <>
                Rename the <span className="text-lg text-primary">{name}</span> folder?
              </>
            ),
            context: {
              kind: "folder",
              collectionId,
              folderId: dataset.folderId,
            },
          })
        }
        break
      }
      case "folder:delete": {
        if (collectionId && dataset.folderId && name) {
          setDialogProps({
            action: "delete",
            name,
            title: "Delete Folder",
            description: (
              <>
                Deleting the <span className="text-lg text-primary">{name}</span> folder will remove all nested folders
                and requests. This cannot be undone.
              </>
            ),
            context: {
              kind: "folder",
              collectionId,
              folderId: dataset.folderId,
            },
          })
        }
        break
      }
      default:
        throw new Error(`Not implemented: ${actionId}`)
    }
  }

  const handleRename = async (newName: string, ctx: RenameContext) => {
    if (ctx.kind === "request") {
      await collectionsApi().updateRequest(ctx.collectionId, ctx.requestId, { name: newName })
    } else if (ctx.kind === "collection") {
      await collectionsApi().updateCollection(ctx.collectionId, { name: newName })
    } else if (ctx.kind === "folder") {
      await collectionsApi().renameFolder(ctx.collectionId, ctx.folderId, newName)
    }
  }

  const handleClearScratch = async (_: ClearScratchContext) => {
    await collectionsApi().clearScratchCollection()
  }

  const handleDelete = async (ctx: DeleteContext) => {
    if (ctx.kind === "request") {
      // Close the tab if it's open
      const tab = requestTabsApi.getOpenTab(ctx.collectionId, ctx.requestId)
      if (tab) {
        await requestTabsApi.removeTab(tab.tabId)
      }
      await collectionsApi().deleteRequest(ctx.collectionId, ctx.requestId)
    } else if (ctx.kind === "collection") {
      await collectionsApi().removeCollection(ctx.collectionId)
    } else if (ctx.kind === "folder") {
      const collection = await collectionsApi().getCollection(ctx.collectionId)

      const collectRequestIds = (folderId: string, acc: string[]) => {
        const folder = collection.folders[folderId]
        if (!folder) {
          return acc
        }
        acc.push(...folder.requestIds)
        for (const childId of folder.childFolderIds) {
          collectRequestIds(childId, acc)
        }
        return acc
      }

      const requestIds = collectRequestIds(ctx.folderId, [])

      for (const requestId of requestIds) {
        const tab = requestTabsApi.getOpenTab(ctx.collectionId, requestId)
        if (tab) {
          await requestTabsApi.removeTab(tab.tabId)
        }
      }

      await collectionsApi().deleteFolder(ctx.collectionId, ctx.folderId)
    }
  }

  const handleFolderCreate = async (name: string, ctx: FolderCreateContext) => {
    await collectionsApi().createFolder(ctx.collectionId, ctx.parentId, name)
  }

  const handleCancel = (_: DialogProps["context"]) => {
    setDialogProps(null)
  }

  // Sort collections by order
  const index = React.useMemo(() => {
    return collectionsIndex.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [collectionsIndex])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) {
      setDropIndicator(null)
      return
    }

    const activeData = active.data.current as DragPayload | undefined
    const overData = over.data.current as DragPayload | undefined

    if (
      (activeData?.type === "request-item" || activeData?.type === "folder-item") &&
      overData?.type === "collection"
    ) {
      setDropIndicator({ id: over.id as string, position: "middle" })
      return
    }

    if (activeData?.type === "request-item" && overData?.type === "folder-item") {
      setDropIndicator({ id: over.id as string, position: "middle" })
      return
    }

    const overRect = over.rect
    const activeRect = event.active.rect.current.translated ?? event.active.rect.current
    const pointerY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top + overRect.height / 2
    const topBoundary = overRect.top + overRect.height / 3
    const bottomBoundary = overRect.top + (overRect.height * 2) / 3

    let position: DropPosition = null
    if (pointerY < topBoundary) {
      position = "top"
    } else if (pointerY > bottomBoundary) {
      position = "bottom"
    } else {
      position = "middle"
    }

    if (activeData?.type === "request-item" && (overData?.type === "folder-item" || overData?.type === "collection")) {
      position = "middle"
    }

    setDropIndicator({ id: over.id as string, position })
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setDropIndicator(null)
  }

  const handleTreeDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      setActiveId(null)
      setDropIndicator(null)

      if (!over || active.id === over.id) {
        return
      }

      const activeData = active.data.current as DragPayload | undefined
      const overData = over.data.current as DragPayload | undefined

      if (!activeData || !overData) {
        return
      }

      // Handle Collection reordering
      if (activeData.type === "collection" && overData.type === "collection") {
        const oldIndex = index.findIndex((item) => item.id === active.id)
        const newIndex = index.findIndex((item) => item.id === over.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(index, oldIndex, newIndex).map((item) => item.id)
          void collectionsApi().reorderCollections(newOrder)
        }
        return
      }

      // Handle Folder Drag
      if (activeData.type === "folder-item") {
        const { collectionId, folderId } = activeData
        if (overData.type === "folder-item") {
          const position = dropIndicator?.position
          if (!position) {
            return
          }
          if (position === "middle") {
            // Reparent folder
            void collectionsApi().moveFolder(collectionId, folderId, overData.folderId)
          } else {
            // Reorder folder
            const overIndex = overData.siblings.indexOf(overData.folderId)
            const newPosition = position === "top" ? overIndex : overIndex + 1
            void collectionsApi().moveFolder(collectionId, folderId, overData.parentId, newPosition)
          }
        }
      }

      // Handle Request Drag
      if (activeData.type === "request-item") {
        const { collectionId, requestId } = activeData
        if (overData.type === "collection") {
          void collectionsApi().moveRequestToFolder(collectionId, requestId, RootCollectionFolderId)
          return
        } else if (overData.type === "folder-item") {
          // Drop on folder always moves into that folder (appends to end)
          void collectionsApi().moveRequestToFolder(collectionId, requestId, overData.folderId)
          return
        } else if (overData.type === "request-item") {
          const position = dropIndicator?.position
          if (!position) {
            return
          }
          // Reorder request
          const overIndex = overData.siblings.indexOf(overData.requestId)
          const newPosition = position === "top" ? overIndex : overIndex + 1
          void collectionsApi().moveRequestToFolder(collectionId, requestId, overData.folderId, newPosition)
        }
      }
    },
    [index, collectionsApi, dropIndicator],
  )

  // Normalize query once
  const query = (searchTerm ?? "").trim().toLowerCase()
  const contextValue = { activeId, dropIndicator }

  const collapsedContent = (
    <div className="flex flex-col items-center space-y-2 py-2 overflow-y-auto">
      {index.slice(0, 10).map((meta) => (
        <Button
          key={meta.id}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={meta.name}
          data-action-id="select:expand"
          data-kind="collection"
          data-collection-id={meta.id}
          onClick={handleAction}
        >
          {rowState.opened[meta.id] ? (
            <FolderOpenIcon className="h-5 w-5 text-primary" />
          ) : (
            <FolderClosedIcon className="h-5 w-5 text-primary" />
          )}
        </Button>
      ))}
      {index.length > MAX_COLLECTIONS_WHEN_COLLAPSED && (
        <Button
          key="more"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={`+${index.length - MAX_COLLECTIONS_WHEN_COLLAPSED} more`}
          onClick={expandSidebar}
        >
          <EllipsisIcon className="h-4 w-4 text-primary" />
        </Button>
      )}
    </div>
  )

  const expandedContent = (
    <>
      {dialogProps?.action === "rename" && (
        <RenameDialog
          open={true}
          title={dialogProps.title}
          description={dialogProps.description}
          name={dialogProps.name}
          context={dialogProps.context}
          onRename={handleRename}
          onCancel={handleCancel}
        />
      )}

      {dialogProps?.action === "folder-create" && (
        <RenameDialog
          open={true}
          title={dialogProps.title}
          description={dialogProps.description}
          name={dialogProps.name}
          placeholder="Folder name"
          submitLabel="Create"
          context={dialogProps.context}
          onRename={handleFolderCreate}
          onCancel={handleCancel}
        />
      )}

      {dialogProps?.action === "clear-scratch" && (
        <DeleteDialog
          open={true}
          title={dialogProps.title}
          description={dialogProps.description}
          context={dialogProps.context}
          onDelete={handleClearScratch}
          onCancel={handleCancel}
        />
      )}

      {dialogProps?.action === "delete" && (
        <DeleteDialog
          open={true}
          title={dialogProps.title}
          description={dialogProps.description}
          context={dialogProps.context}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {/* When searching, render search-aware rows that self-filter and expand. */}
        {query ? (
          <div role="tree" aria-label="Collections (search)">
            {index.map((meta) => (
              <CollectionRowSearchable
                key={meta.id}
                collectionId={meta.id}
                collectionName={meta.name}
                query={query}
                onAction={handleAction}
              />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={treeSensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleTreeDragEnd}
            onDragCancel={handleDragCancel}
          >
            <DndTreeProvider value={contextValue}>
              <SortableContext items={index.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                {index.map((meta) => (
                  <CollectionRow
                    key={meta.id}
                    collectionId={meta.id}
                    collectionName={meta.name}
                    open={rowState.opened[meta.id] ?? false}
                    onAction={handleAction}
                  />
                ))}
              </SortableContext>
            </DndTreeProvider>
          </DndContext>
        )}
      </div>
    </>
  )

  return isCollapsed ? collapsedContent : expandedContent
}

type CollectionRowProps = {
  collectionId: string
  collectionName: string
  open: boolean
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

function CollectionRow({ collectionId, collectionName, open, onAction }: CollectionRowProps) {
  const { dropIndicator } = useDndTreeContext()
  const isOver = dropIndicator?.id === collectionId
  const dropPosition = isOver ? dropIndicator.position : null
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: collectionId,
    data: {
      type: "collection",
      collectionId,
    } satisfies CollectionDragData,
  })
  const { setNodeRef: setDropRef } = useDroppable({
    id: collectionId,
    data: {
      type: "collection",
      collectionId,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div key={collectionId} className={cn("mb-2 relative")} ref={setNodeRef} style={style}>
      {isOver && dropPosition !== "middle" && (
        <>
          {dropPosition === "top" && <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-10" />}
          {dropPosition === "bottom" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10" />}
        </>
      )}
      <div
        role="treeitem"
        tabIndex={0}
        id={collectionId}
        ref={setDropRef}
        className={cn(
          "group/col relative flex w-full cursor-pointer items-center justify-between rounded p-2 hover:bg-accent has-[button[data-state=open]]:bg-accent",
          isDragging && "opacity-50",
          isOver && dropPosition === "middle" && "bg-primary/10",
        )}
        data-action-id="select"
        data-kind="collection"
        data-collection-id={collectionId}
        onClick={onAction}
        onKeyDown={onAction}
      >
        <div className="flex flex-1 items-center space-x-2">
          <div
            className="tree-offset-flex hover:cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            {open ? (
              <>
                <ChevronDownIcon className="h-3 w-3 text-primary" />
                <FolderOpenIcon className="h-4 w-4 text-primary" />
              </>
            ) : (
              <>
                <ChevronRightIcon className="h-3 w-3 text-primary" />
                <FolderClosedIcon className="h-4 w-4 text-primary" />
              </>
            )}
            <span className="text-sm">{collectionName}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 dropdown-trigger group-hover/col:opacity-100 transition-none"
            >
              <MoreHorizontalIcon className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <CollectionMenuContent collection={{ id: collectionId, name: collectionName }} onAction={onAction} />
        </DropdownMenu>
      </div>

      {open && (
        <div className="ml-6 space-y-1">
          <ErrorBoundary
            fallback={(error) => (
              <Alert variant="destructive">
                <AlertTriangleIcon className="h-4 w-4" />
                <AlertTitle>Collection {collectionName} could not be loaded</AlertTitle>
                <AlertDescription>
                  <p>{error?.message ?? "An unexpected error occurred while loading the collection."}</p>
                </AlertDescription>
              </Alert>
            )}
          >
            <Suspense name="collection" fallback={<div />}>
              <CollectionContent collectionId={collectionId} onAction={onAction} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </div>
  )
}

type CollectionRowSearchableProps = {
  collectionId: string
  collectionName: string
  query: string
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

function CollectionRowSearchable({ collectionId, collectionName, query, onAction }: CollectionRowSearchableProps) {
  const collection = useApplication((app) => app.collectionsState.cache[collectionId])

  React.useEffect(() => {
    if (!collection) {
      void collectionsApi().getCollection(collectionId)
    }
  }, [collection, collectionId])

  const nameMatches = collectionName.toLowerCase().includes(query)
  const matchingRequests = React.useMemo(() => {
    const reqs = Object.values(collection?.requests ?? {})
    if (!query) {
      return reqs
    }
    return reqs.filter((r) => [r.name, r.method, r.url ?? ""].some((v) => v.toLowerCase().includes(query)))
  }, [collection, query])
  const folderOptions = React.useMemo(() => (collection ? buildFolderOptions(collection) : []), [collection])

  if (!collection) {
    return (
      <div role="tree" className="px-3 py-2 text-sm text-muted-foreground">
        Loading {collectionName}…
      </div>
    )
  }

  // If neither the collection name nor any of its requests match, skip rendering entirely
  if (!nameMatches && matchingRequests.length === 0) {
    return null
  }

  return (
    <div role="tree">
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={true}
        className={cn(
          "group/col relative flex w-full cursor-pointer items-center justify-between rounded p-2 hover:bg-accent has-[button[data-state=open]]:bg-accent",
        )}
        data-action-id="select:expand"
        data-kind="collection"
        data-collection-id={collectionId}
        onClick={onAction}
        onKeyDown={onAction}
      >
        <div className="flex items-center space-x-2">
          <div className="tree-offset-flex hover:cursor-grab active:cursor-grabbing">
            <ChevronDownIcon className="h-4 w-4 text-foreground" />
            <span className="pt-1 text-sm leading-none">{collectionName}</span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 dropdown-trigger group-hover/col:opacity-100">
                <MoreHorizontalIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <CollectionMenuContent collection={{ id: collectionId, name: collectionName }} onAction={onAction} />
          </DropdownMenu>
        </div>
      </div>

      <div className="ml-6 space-y-1">
        <ErrorBoundary
          fallback={(error) => (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertTitle>Collection {collectionName} could not be loaded</AlertTitle>
              <AlertDescription>
                <p>{error?.message ?? "An unexpected error occurred while loading the collection."}</p>
              </AlertDescription>
            </Alert>
          )}
        >
          <RequestList
            collectionId={collectionId}
            folderId={RootCollectionFolderId}
            requests={matchingRequests}
            folderOptions={folderOptions}
            onAction={onAction}
            filterQuery={query}
          />
        </ErrorBoundary>
      </div>
    </div>
  )
}

type RequestListProps = {
  collectionId: string
  folderId: string
  requests: RequestState[]
  folderOptions: FolderOption[]
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  filterQuery?: string
}

function RequestList({
  collectionId,
  folderId,
  requests: sourceRequests,
  folderOptions,
  onAction,
  filterQuery,
}: RequestListProps) {
  const allRequests = sourceRequests

  const moveTargets = React.useMemo(
    () => folderOptions.filter((option) => option.id !== folderId),
    [folderOptions, folderId],
  )

  const folderOptionMap = React.useMemo(() => {
    return new Map(folderOptions.map((option) => [option.id, option.path]))
  }, [folderOptions])

  const showFolderContext = Boolean(filterQuery)

  const q = (filterQuery ?? "").trim().toLowerCase()
  const requests = React.useMemo(() => {
    if (!q) {
      return allRequests
    }
    return allRequests.filter((r) => [r.name, r.method, r.url ?? ""].some((v) => v.toLowerCase().includes(q)))
  }, [allRequests, q])

  const requestOrder = React.useMemo(() => requests.map((item) => item.id), [requests])

  const folderPathFor = React.useCallback(
    (request: RequestState) => {
      if (!showFolderContext) {
        return undefined
      }
      const rawPath = folderOptionMap.get(request.folderId ?? "")
      if (!rawPath) {
        return undefined
      }
      const trimmed = rawPath.replace(/^Root\s*\/\s*/i, "")
      return trimmed.length > 0 ? trimmed : undefined
    },
    [folderOptionMap, showFolderContext],
  )

  // Disable DnD while filtering to avoid confusing reorder behavior on subsets
  if (q) {
    return (
      <div>
        {requests.map((r) => (
          <RequestRow
            key={r.id}
            r={r}
            collectionId={collectionId}
            folderId={folderId}
            onAction={onAction}
            dndDisabled={true}
            moveTargets={moveTargets}
            siblings={requestOrder}
            folderPath={folderPathFor(r)}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <SortableContext items={requestOrder} strategy={verticalListSortingStrategy}>
        {requests.map((r) => (
          <RequestRow
            key={r.id}
            r={r}
            collectionId={collectionId}
            folderId={folderId}
            onAction={onAction}
            moveTargets={moveTargets}
            siblings={requestOrder}
            folderPath={folderPathFor(r)}
          />
        ))}
      </SortableContext>
    </div>
  )
}

type CollectionContentProps = {
  collectionId: string
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

function CollectionContent({ collectionId, onAction }: CollectionContentProps) {
  const {
    state: { collection },
  } = useCollection(collectionId)
  const rootFolder = collection.folders[RootCollectionFolderId]
  const rootRequests =
    rootFolder?.requestIds.map((id) => collection.requests[id]).filter((r): r is RequestState => !!r) ?? []
  const folderOptions = React.useMemo(() => buildFolderOptions(collection), [collection])

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-root-${collectionId}`,
    data: {
      type: "folder-drop",
      collectionId,
      folderId: RootCollectionFolderId,
      childIds: rootFolder?.childFolderIds ? [...rootFolder.childFolderIds] : [],
    },
  })

  return (
    <div
      ref={setDropRef}
      className={cn("space-y-1", isOver && "rounded-md border border-dashed border-primary/50 bg-primary/5")}
    >
      <RequestList
        collectionId={collectionId}
        folderId={RootCollectionFolderId}
        requests={rootRequests}
        folderOptions={folderOptions}
        onAction={onAction}
      />

      <SortableContext items={rootFolder?.childFolderIds ?? []} strategy={verticalListSortingStrategy}>
        {rootFolder?.childFolderIds.map((folderId) => (
          <CollectionFolderBranch
            key={folderId}
            collection={collection}
            collectionId={collectionId}
            folderId={folderId}
            depth={0}
            folderOptions={folderOptions}
            onAction={onAction}
          />
        ))}
      </SortableContext>
    </div>
  )
}

type CollectionFolderBranchProps = {
  collection: CollectionCacheState
  collectionId: string
  folderId: string
  depth: number
  folderOptions: FolderOption[]
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

function CollectionFolderBranch({
  collection,
  collectionId,
  folderId,
  depth,
  folderOptions,
  onAction,
}: CollectionFolderBranchProps) {
  const { dropIndicator } = useDndTreeContext()
  const isOver = dropIndicator?.id === folderId
  const dropPosition = isOver ? dropIndicator.position : null
  const folder = collection.folders[folderId]
  const parentId = folder?.parentId ?? RootCollectionFolderId
  const parentNode = collection.folders[parentId]
  const siblingOrder = parentNode?.childFolderIds ? [...parentNode.childFolderIds] : []
  const childFolderIds = folder?.childFolderIds ? [...folder.childFolderIds] : []
  const [open, setOpen] = React.useState(true)
  const isScratch = isScratchCollection(collectionId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderId,
    data: {
      type: "folder-item",
      collectionId,
      folderId,
      parentId,
      siblings: siblingOrder,
      childIds: childFolderIds,
    } satisfies FolderDragData,
    disabled: isScratch,
  })
  const { setNodeRef: setFolderDropRef } = useDroppable({
    id: folderId,
    data: {
      type: "folder-item",
      collectionId,
      folderId,
      parentId,
      childIds: childFolderIds,
    },
  })

  const style = React.useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging],
  )

  if (!folder) {
    return null
  }

  const requests = folder.requestIds.map((id) => collection.requests[id]).filter((r): r is RequestState => !!r)

  const toggle = () => setOpen((prev) => !prev)

  return (
    <div role="tree" className="space-y-1" ref={setNodeRef} style={style}>
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={open}
        ref={setFolderDropRef}
        className={cn(
          "group/col relative flex w-full cursor-pointer items-center justify-between rounded p-2 hover:bg-accent",
          isDragging && "opacity-50",
          isOver && dropPosition === "middle" && "bg-primary/10",
        )}
        data-action-id="select:expand"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folderId}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            toggle()
          }
        }}
        style={{ marginLeft: depth * 12 }}
      >
        {isOver && dropPosition === "top" && <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-10" />}
        {isOver && dropPosition === "bottom" && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10" />
        )}
        <div className="flex flex-1 items-center space-x-2">
          <div
            className={cn("tree-offset-flex", !isScratch && "hover:cursor-grab active:cursor-grabbing")}
            title={isScratch ? undefined : "Drag to move folder"}
            {...(!isScratch ? { ...attributes, ...listeners } : {})}
          >
            {open ? (
              <FolderOpenIcon className="h-3 w-3 text-primary" />
            ) : (
              <FolderClosedIcon className="h-3 w-3 text-primary" />
            )}
            <span className="text-sm font-medium">{folder.name}</span>
          </div>
        </div>

        {!isScratchCollection(collectionId) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover/col:opacity-100"
              >
                <MoreHorizontalIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <FolderMenu collectionId={collectionId} folder={folder} onAction={onAction} />
          </DropdownMenu>
        )}
      </div>

      {open && (
        <div className="ml-5 space-y-1">
          <RequestList
            collectionId={collectionId}
            folderId={folderId}
            requests={requests}
            folderOptions={folderOptions}
            onAction={onAction}
          />
          <SortableContext items={folder.childFolderIds} strategy={verticalListSortingStrategy}>
            {folder.childFolderIds.map((childId) => (
              <CollectionFolderBranch
                key={childId}
                collection={collection}
                collectionId={collectionId}
                folderId={childId}
                depth={depth + 1}
                folderOptions={folderOptions}
                onAction={onAction}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  )
}

type FolderMenuProps = {
  collectionId: string
  folder: CollectionFolderNode
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

function FolderMenu({ collectionId, folder, onAction }: FolderMenuProps) {
  return (
    <DropdownMenuContent align="start" className="w-44" sideOffset={4}>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={onAction}
        onKeyDown={onAction}
        data-action-id="request:new"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
      >
        <PlusIcon className="mr-2 h-4 w-4" /> New Request
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={onAction}
        onKeyDown={onAction}
        data-action-id="folder:new"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-parent-id={folder.id}
      >
        <FolderPlusIcon className="mr-2 h-4 w-4" /> New Subfolder
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={onAction}
        onKeyDown={onAction}
        data-action-id="folder:rename"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-name={folder.name}
      >
        <Edit2Icon className="mr-2 h-4 w-4" /> Rename
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="cursor-pointer"
        variant="destructive"
        onClick={onAction}
        onKeyDown={onAction}
        data-action-id="delete"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-name={folder.name}
      >
        <Trash2Icon className="mr-2 h-4 w-4" /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

type RequestRowProps = {
  r: RequestState
  collectionId: string
  folderId: string
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  dndDisabled?: boolean
  moveTargets: FolderOption[]
  siblings: string[]
  folderPath?: string
}

function RequestRow({
  r,
  collectionId,
  folderId,
  onAction,
  dndDisabled = false,
  moveTargets = [],
  siblings,
  folderPath,
}: RequestRowProps) {
  const dndContext = useOptionalDndTreeContext()
  const dropIndicator = dndContext?.dropIndicator ?? null
  const isOver = dropIndicator?.id === r.id
  const dropPosition = isOver ? (dropIndicator?.position ?? null) : null
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: r.id,
    data: {
      type: "request-item",
      collectionId,
      requestId: r.id,
      folderId,
      siblings,
    } satisfies RequestDragData,
    disabled: isScratchCollection(collectionId) || dndDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isScratch = isScratchCollection(collectionId)
  const hasMoveTargets = !isScratch && moveTargets.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="treeitem"
      tabIndex={0}
      className={cn(
        "group/col relative flex w-full cursor-pointer items-center justify-between rounded p-2 hover:bg-accent has-[button[data-state=open]]:bg-accent",
        isDragging && "opacity-50",
        isOver && dropPosition === "middle" && "bg-primary/10",
      )}
      data-testid="collection-request-row"
      data-action-id="select"
      data-kind="request"
      data-collection-id={collectionId}
      data-request-id={r.id}
      data-folder-id={folderId}
      onClick={onAction}
      onKeyDown={onAction}
    >
      {isOver && dropPosition === "top" && <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-10" />}
      {isOver && dropPosition === "bottom" && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10" />
      )}
      <div className="flex flex-1 items-start space-x-2">
        <div
          className={cn("tree-offset-stack", !isScratch && !dndDisabled && "hover:cursor-grab active:cursor-grabbing")}
          title={
            isScratchCollection(collectionId)
              ? "Scratch requests cannot be reordered"
              : dndDisabled
                ? "Reordering disabled while filtering"
                : "Drag to reorder"
          }
          {...(!isScratch && !dndDisabled ? { ...attributes, ...listeners } : {})}
        >
          <div className="flex items-center space-x-2">
            <div className="relative">
              <HttpBadge method={r.method} className={cn(isNotEmpty(r.patch) && "unsaved-changes")} />
            </div>
            <span className="pt-1 text-sm leading-none">{r.name}</span>
          </div>
          {folderPath && <span className="pl-6 text-xs text-muted-foreground max-w-64 truncate">{folderPath}</span>}
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 dropdown-trigger group-hover/col:opacity-100 transition-none"
            >
              <MoreHorizontalIcon className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="start" sideOffset={2}>
            {!isScratch && (
              <>
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-action-id="rename"
                  data-kind="request"
                  data-collection-id={collectionId}
                  data-request-id={r.id}
                  data-name={r.name}
                  onClick={onAction}
                  onKeyDown={onAction}
                >
                  <Edit2Icon className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-action-id="duplicate"
                  data-kind="request"
                  data-collection-id={collectionId}
                  data-request-id={r.id}
                  onClick={onAction}
                  onKeyDown={onAction}
                >
                  <CopyIcon className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                {hasMoveTargets && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <FolderOpenIcon className="mr-2 h-4 w-4" /> Move to Folder
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      {moveTargets.map((target) => (
                        <DropdownMenuItem
                          key={target.id}
                          className="cursor-pointer"
                          data-action-id="request:move"
                          data-kind="request"
                          data-collection-id={collectionId}
                          data-request-id={r.id}
                          data-target-folder-id={target.id}
                          onClick={onAction}
                          onKeyDown={onAction}
                        >
                          {target.path}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className="cursor-pointer"
              data-action-id="copy"
              data-kind="request"
              data-collection-id={collectionId}
              data-request-id={r.id}
              data-name={r.name}
              onClick={onAction}
              onKeyDown={onAction}
            >
              <CopyIcon className="mr-2 h-4 w-4" /> Copy as JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer"
              data-action-id="delete"
              data-kind="request"
              data-collection-id={collectionId}
              data-request-id={r.id}
              data-name={r.name}
              onClick={onAction}
              onKeyDown={onAction}
            >
              <Trash2Icon className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
