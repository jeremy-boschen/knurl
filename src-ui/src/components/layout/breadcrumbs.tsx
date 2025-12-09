import { Fragment, useMemo, useState } from "react"

import DeleteDialog from "@/components/shared/delete-dialog"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CollectionMenuContent } from "@/components/ui/knurl/collection-menu"
import { FolderMenuContent, type FolderMenuPayload } from "@/components/ui/knurl/folder-menu"
import RenameDialog from "@/components/ui/knurl/rename-dialog"
import { RequestMenuContent, type RequestMenuPayload } from "@/components/ui/knurl/request-menu"
import { isScratchCollection, useCollection, useCollections, useRequestTab } from "@/state"
import type { CollectionsApi, RequestTabsApi } from "@/types"
import { RootCollectionFolderId } from "@/types"

type RenameState =
  | {
      type: "request"
      collectionId: string
      requestId: string
      currentName: string
    }
  | {
      type: "folder"
      mode: "rename"
      collectionId: string
      folderId: string
      currentName: string
    }
  | {
      type: "folder"
      mode: "create"
      collectionId: string
      parentId: string | null
      currentName: ""
    }

type DeleteState =
  | {
      type: "request"
      collectionId: string
      requestId: string
      name: string
    }
  | {
      type: "folder"
      collectionId: string
      folderId: string
      name: string
    }

type LoadedRequestTab = NonNullable<ReturnType<typeof useRequestTab>>

type BreadcrumbsContentProps = {
  tabData: LoadedRequestTab
  collectionsApi: () => CollectionsApi
  requestTabsApi: RequestTabsApi
}

function BreadcrumbsContent({ tabData, collectionsApi, requestTabsApi }: BreadcrumbsContentProps) {
  const activeTab = tabData.state.activeTab as NonNullable<typeof tabData.state.activeTab>
  const {
    state: { collection },
  } = useCollection(activeTab.collectionId)
  const {
    state: { collectionsIndex },
  } = useCollections()

  const request = tabData.state.request as NonNullable<typeof tabData.state.request>
  const location = collection.requestIndex[request.id]

  const [renameState, setRenameState] = useState<RenameState | null>(null)
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null)

  const folderTrail = useMemo(() => {
    return (location?.ancestry ?? [])
      .filter((folderId) => folderId !== RootCollectionFolderId)
      .map((folderId) => collection.folders[folderId])
      .filter((folder): folder is NonNullable<typeof folder> => Boolean(folder))
  }, [collection, location])

  const handleFolderAction = (payload: FolderMenuPayload) => {
    switch (payload.actionId) {
      case "request:new": {
        requestTabsApi.createRequestTab(payload.collectionId, { folderId: payload.folderId })
        break
      }
      case "folder:new": {
        setRenameState({
          type: "folder",
          mode: "create",
          collectionId: payload.collectionId,
          parentId: payload.parentId ?? payload.folderId,
          currentName: "",
        })
        break
      }
      case "move-up": {
        // Handled by FolderMenuContent
        break
      }
      case "move-down": {
        // Handled by FolderMenuContent
        break
      }
      case "folder:move": {
        if (payload.targetParentId !== undefined) {
          collectionsApi().moveFolder(payload.collectionId, payload.folderId, payload.targetParentId)
        }
        break
      }
      case "folder:rename": {
        setRenameState({
          type: "folder",
          mode: "rename",
          collectionId: payload.collectionId,
          folderId: payload.folderId,
          currentName: payload.name,
        })
        break
      }
      case "delete": {
        setDeleteState({
          type: "folder",
          collectionId: payload.collectionId,
          folderId: payload.folderId,
          name: payload.name,
        })
        break
      }
    }
  }

  const handleRequestAction = async (payload: RequestMenuPayload) => {
    switch (payload.actionId) {
      case "rename": {
        setRenameState({
          type: "request",
          collectionId: payload.collectionId,
          requestId: payload.requestId,
          currentName: payload.name,
        })
        break
      }
      case "duplicate": {
        try {
          await requestTabsApi.loadTab(payload.collectionId, payload.requestId)
          collectionsApi().duplicateRequest(payload.collectionId, payload.requestId)
        } catch (error) {
          console.error("Failed to duplicate request from breadcrumbs", error)
        }
        break
      }
      case "request:move": {
        if (payload.targetFolderId) {
          collectionsApi().moveRequestToFolder(payload.collectionId, payload.requestId, payload.targetFolderId)
        }
        break
      }
      case "copy-json": {
        try {
          const req = collectionsApi().getRequest(payload.collectionId, payload.requestId)
          if (req) {
            await navigator.clipboard.writeText(JSON.stringify(req, null, 2))
          }
        } catch (error) {
          console.error("Failed to copy request JSON", error)
        }
        break
      }
      case "delete": {
        setDeleteState({
          type: "request",
          collectionId: payload.collectionId,
          requestId: payload.requestId,
          name: payload.name,
        })
        break
      }
    }
  }

  const handleRenameSubmit = async (nextName: string, state: RenameState) => {
    try {
      if (state.type === "request") {
        collectionsApi().updateRequest(state.collectionId, state.requestId, { name: nextName })
      } else if (state.mode === "rename") {
        collectionsApi().renameFolder(state.collectionId, state.folderId, nextName)
      } else {
        collectionsApi().createFolder(state.collectionId, state.parentId ?? RootCollectionFolderId, nextName)
      }
    } catch (error) {
      console.error("Failed to apply rename action from breadcrumbs", error)
    }
  }

  const handleRenameCancel = () => {
    setRenameState(null)
  }

  const handleDeleteConfirm = async (state: DeleteState) => {
    try {
      if (state.type === "request") {
        const tab = requestTabsApi.getOpenTab(state.collectionId, state.requestId)
        if (tab) {
          requestTabsApi.removeTab(tab.tabId)
        }
        collectionsApi().deleteRequest(state.collectionId, state.requestId)
      } else {
        const collectRequestIds = (folderId: string, acc: string[]): string[] => {
          const node = collection.folders[folderId]
          if (!node) {
            return acc
          }
          acc.push(...node.requestIds)
          for (const childId of node.childFolderIds) {
            collectRequestIds(childId, acc)
          }
          return acc
        }

        const requestIds = collectRequestIds(state.folderId, [])
        for (const requestId of requestIds) {
          const tab = requestTabsApi.getOpenTab(state.collectionId, requestId)
          if (tab) {
            requestTabsApi.removeTab(tab.tabId)
          }
        }
        collectionsApi().deleteFolder(state.collectionId, state.folderId)
      }
    } catch (error) {
      console.error("Failed to delete item from breadcrumbs", error)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteState(null)
  }

  const isScratch = isScratchCollection(collection.id)

  return (
    <>
      <Breadcrumb className="pl-[1px]" data-test-id="breadcrumbs">
        <BreadcrumbList>
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm font-normal"
                  data-test-id="breadcrumbs:collection-button"
                >
                  <span className="max-w-48 truncate">{collection.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <CollectionMenuContent
                collection={collection}
                collectionsIndex={collectionsIndex}
                exclude={["delete", "clear-scratch"]}
              />
            </DropdownMenu>
          </BreadcrumbItem>
          {folderTrail.map((folder, index) => (
            <Fragment key={folder.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm font-normal text-muted-foreground"
                      data-test-id={`breadcrumbs:folder-button:${index}`}
                    >
                      <span className="max-w-48 truncate">{folder.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <FolderMenuContent collectionId={collection.id} folder={folder} onAction={handleFolderAction} />
                </DropdownMenu>
              </BreadcrumbItem>
            </Fragment>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm font-normal text-foreground"
                  aria-current="page"
                  data-test-id="breadcrumbs:request-button"
                >
                  <span className="max-w-48 truncate">{request.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <RequestMenuContent
                collectionId={collection.id}
                requestId={request.id}
                requestName={request.name}
                isScratch={isScratch}
                onAction={handleRequestAction}
              />
            </DropdownMenu>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {renameState && (
        <RenameDialog
          open={true}
          title={
            renameState.type === "request"
              ? "Rename Request"
              : renameState.mode === "rename"
                ? "Rename Folder"
                : "Create Folder"
          }
          description={
            renameState.type === "request"
              ? "Update the request name."
              : renameState.mode === "rename"
                ? "Rename this folder."
                : "Add a new folder to organize requests."
          }
          name={renameState.type === "folder" && renameState.mode === "create" ? "" : renameState.currentName}
          context={renameState}
          onRename={handleRenameSubmit}
          onCancel={handleRenameCancel}
          submitLabel={renameState.type === "folder" && renameState.mode === "create" ? "Create" : "Save"}
          placeholder="Enter name..."
        />
      )}

      {deleteState && (
        <DeleteDialog
          open={true}
          title={deleteState.type === "request" ? "Delete Request" : "Delete Folder"}
          description={
            deleteState.type === "request" ? (
              <>
                Are you sure you want to delete the <span className="text-lg text-primary">{deleteState.name}</span>{" "}
                request?
              </>
            ) : (
              <>
                Deleting the <span className="text-lg text-primary">{deleteState.name}</span> folder will remove all
                nested folders and requests. This cannot be undone.
              </>
            )
          }
          context={deleteState}
          onDelete={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </>
  )
}

export function Breadcrumbs() {
  const tabData = useRequestTab()
  const {
    actions: { collectionsApi },
  } = useCollections()
  const activeCollectionId = tabData?.state.activeTab?.collectionId
  const request = tabData?.state.request
  const original = tabData?.state.original
  const tabsApi = tabData?.actions.requestTabsApi

  if (!tabData || !activeCollectionId || !request || !original || !tabsApi) {
    return <div className="h-6" />
  }

  return (
    <BreadcrumbsContent tabData={tabData} collectionsApi={collectionsApi} requestTabsApi={tabsApi as RequestTabsApi} />
  )
}
