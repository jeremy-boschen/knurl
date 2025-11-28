import React, { Suspense } from "react"

import { useDroppable } from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderClosedIcon,
  FolderOpenIcon,
  MoreHorizontalIcon,
} from "lucide-react"

import ErrorBoundary from "@/components/error/error-boundary"
import { useDndTreeContext } from "@/components/layout/dnd-tree-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CollectionMenuContent } from "@/components/ui/knurl/collection-menu"
import { buildFolderOptions } from "@/lib/collections/folder-options"
import { cn } from "@/lib/utils"
import { RootCollectionFolderId, collectionsApi, useCollectionFromCache } from "@/state/application"

import type { CollectionDragData } from "./actions/action-types"
import { CollectionContent } from "./collection-content"
import { RequestList } from "./request-list"

export type CollectionRowProps = {
  collectionId: string
  collectionName: string
  open: boolean
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

export function CollectionRow({ collectionId, collectionName, open, onAction }: CollectionRowProps) {
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
        data-test-id={`collection-tree:collection-row:${collectionId}`}
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
              data-test-id={`collection-tree:collection-row:menu-button:${collectionId}`}
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

export type CollectionRowSearchableProps = {
  collectionId: string
  collectionName: string
  query: string
  onAction: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
}

export function CollectionRowSearchable({
  collectionId,
  collectionName,
  query,
  onAction,
}: CollectionRowSearchableProps) {
  const {
    state: { collection },
  } = useCollectionFromCache(collectionId)

  React.useEffect(() => {
    if (!collection) {
      void collectionsApi().loadCollection(collectionId)
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
