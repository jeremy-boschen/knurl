import { Fragment } from "react"
import { useAsync } from "react-use"

import { CollectionMenuContent } from "@/components/collection/collection-menu-content"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCollections, useRequestTab } from "@/state"
import { RootCollectionFolderId } from "@/types"

export function Breadcrumbs() {
  const tabData = useRequestTab()
  const {
    actions: { collectionsApi },
  } = useCollections()

  const { value: collection } = useAsync(async () => {
    if (!tabData?.state.activeTab?.collectionId) {
      return null
    }
    return collectionsApi().getCollection(tabData.state.activeTab.collectionId)
  }, [collectionsApi, tabData?.state.activeTab?.collectionId])

  if (!tabData || !collection) {
    return <div className="h-6" /> // Placeholder for height consistency
  }

  const { request } = tabData.state
  const location = request ? collection.requestIndex[request.id] : undefined
  const folderTrail = (location?.ancestry ?? [])
    .filter((folderId) => folderId !== RootCollectionFolderId)
    .map((folderId) => collection.folders[folderId])
    .filter((folder): folder is NonNullable<typeof folder> => Boolean(folder))

  return (
    <Breadcrumb className="pl-2">
      <BreadcrumbList>
        <BreadcrumbItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="link" className="h-auto p-0 text-sm font-normal">
                <span className="max-w-48 truncate">{collection.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <CollectionMenuContent collection={collection} exclude={["delete", "clear-scratch"]} />
          </DropdownMenu>
        </BreadcrumbItem>
        {folderTrail.map((folder) => (
          <Fragment key={folder.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="max-w-48 truncate text-sm text-muted-foreground">{folder.name}</span>
            </BreadcrumbItem>
          </Fragment>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="max-w-48 truncate">{request.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
