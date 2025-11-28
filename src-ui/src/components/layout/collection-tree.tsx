import React, { Profiler, useCallback, useDeferredValue, useMemo } from "react"

import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { capitalize } from "es-toolkit"
import { EllipsisIcon, FolderClosedIcon, FolderOpenIcon } from "lucide-react"

import { CollectionRow, CollectionRowSearchable } from "@/components/layout/collection-tree/collection-row"
import { DndTreeProvider } from "@/components/layout/dnd-tree-context"
import DeleteDialog from "@/components/shared/delete-dialog"
import { Button } from "@/components/ui/button"
import RenameDialog from "@/components/ui/knurl/rename-dialog"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useApplication, useCollections, useOpenTabs, useSidebar, useUtilitySheets } from "@/state"
import { RootCollectionFolderId } from "@/types"
import type {
  ActionId,
  ActionPayload,
  ClearScratchContext,
  DeleteContext,
  DialogProps,
  DragPayload,
  DropPosition,
  FolderCreateContext,
  RenameContext,
} from "./collection-tree/actions/action-types"
import { createCollisionDetectionStrategy } from "./collection-tree/utils/dnd-collision"
import { calculateDropPosition } from "./collection-tree/utils/drop-position"

const MAX_COLLECTIONS_WHEN_COLLAPSED = 10

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

  // Memoize collision detection strategy
  const collisionDetectionStrategy: CollisionDetection = useMemo(() => createCollisionDetectionStrategy(), [])

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

    // If we have a collectionId, we can assume that we must load the collection
    if (collectionId) {
      // Fire off loading the collection. No need to wait for it. The CollectionRow will handle that.
      await collectionsApi().loadCollection(collectionId)
    }

    kind = kind ?? "collection"

    const domEvent = "actionId" in input ? undefined : (input as Event & { ctrlKey?: boolean; metaKey?: boolean })

    switch (actionId) {
      case "select:expand":
      case "select": {
        // Always expand the sidebar when a collection/request is selected
        expandSidebar()

        if (collectionId) {
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
            try {
              await requestTabsApi.loadTab(collectionId, requestId)
              requestTabsApi.openRequestTab(collectionId, requestId)
            } catch (error) {
              console.error("Failed to open request tab", error)
            }
          }
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
          try {
            await requestTabsApi.loadTab(collectionId, requestId)
            collectionsApi().duplicateRequest(collectionId, requestId)
          } catch (error) {
            console.error("Failed to duplicate request", error)
          }
        }
        break
      }
      case "copy": {
        if (collectionId && requestId) {
          try {
            await requestTabsApi.loadTab(collectionId, requestId)
            const request = collectionsApi().getRequest(collectionId, requestId)
            if (request) {
              void navigator.clipboard.writeText(JSON.stringify(request, null, 2))
            }
          } catch (error) {
            console.error("Failed to copy request", error)
          }
        }
        break
      }
      case "request:move": {
        if (collectionId && requestId && dataset.targetFolderId) {
          collectionsApi().moveRequestToFolder(collectionId, requestId, dataset.targetFolderId)
        }
        break
      }
      case "request:new": {
        if (collectionId && dataset.folderId) {
          void requestTabsApi.createRequestTab(collectionId, { folderId: dataset.folderId })
        }
        break
      }
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

  const handleRename = (newName: string, ctx: RenameContext) => {
    if (ctx.kind === "request") {
      collectionsApi().updateRequest(ctx.collectionId, ctx.requestId, { name: newName })
    } else if (ctx.kind === "collection") {
      collectionsApi().updateCollection(ctx.collectionId, { name: newName })
    } else if (ctx.kind === "folder") {
      collectionsApi().renameFolder(ctx.collectionId, ctx.folderId, newName)
    }
  }

  const handleClearScratch = (_: ClearScratchContext) => {
    collectionsApi().clearScratchCollection()
  }

  const handleDelete = async (ctx: DeleteContext) => {
    if (ctx.kind === "request") {
      // Close the tab if it's open
      const tab = requestTabsApi.getOpenTab(ctx.collectionId, ctx.requestId)
      if (tab) {
        requestTabsApi.removeTab(tab.tabId)
      }
      collectionsApi().deleteRequest(ctx.collectionId, ctx.requestId)
    } else if (ctx.kind === "collection") {
      collectionsApi().removeCollection(ctx.collectionId)
    } else if (ctx.kind === "folder") {
      const collection = useApplication.getState().collectionsState.cache[ctx.collectionId]
      if (!collection) {
        return
      }

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
          requestTabsApi.removeTab(tab.tabId)
        }
      }

      collectionsApi().deleteFolder(ctx.collectionId, ctx.folderId)
    }
  }

  const handleFolderCreate = (name: string, ctx: FolderCreateContext) => {
    collectionsApi().createFolder(ctx.collectionId, ctx.parentId, name)
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

    const position = calculateDropPosition(event, activeData, overData)
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
        } else if (overData.type === "collection") {
          void collectionsApi().moveFolder(collectionId, folderId, RootCollectionFolderId)
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
  const deferredQuery = useDeferredValue(query)
  const contextValue = useMemo(() => ({ activeId, dropIndicator }), [activeId, dropIndicator])

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
          data-test-id={`collection-tree:collapsed-collection-button:${meta.id}`}
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
          data-test-id="collection-tree:collapsed-expand-button"
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

      <div className="flex-1 overflow-y-auto p-2" data-test-id="collection-tree">
        {/* When searching, render search-aware rows that self-filter and expand. */}
        {deferredQuery ? (
          <div role="tree" aria-label="Collections (search)">
            {index.map((meta) => (
              <CollectionRowSearchable
                key={meta.id}
                collectionId={meta.id}
                collectionName={meta.name}
                query={deferredQuery}
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

  return (
    <Profiler id="CollectionTree" onRender={onProfilerRender}>
      {isCollapsed ? collapsedContent : expandedContent}
    </Profiler>
  )
}
