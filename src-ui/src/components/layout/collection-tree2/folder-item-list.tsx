import type { CollectionCache } from "@/types"
import { RootCollectionFolderId } from "@/types"
import { FolderItem } from "./folder-item"
import { RequestItemList } from "./request-item-list"

type FolderItemListProps = {
  collection: CollectionCache
  folderId: string
}

export function FolderItemList({ collection, folderId }: FolderItemListProps) {
  const folder = collection.folders[folderId]
  if (!folder) {
    return null
  }

  const isRoot = folderId === RootCollectionFolderId

  return (
    <div className={`space-y-1 ${isRoot ? "" : "ml-3"}`} data-folder-id={folderId}>
      {!isRoot ? <FolderItem collection={collection} folder={folder} /> : null}

      {isRoot ? (
        <>
          <RequestItemList collection={collection} folder={folder} requestIds={folder.requestIds} />

          {folder.childFolderIds.map((childFolderId) => (
            <FolderItemList key={childFolderId} collection={collection} folderId={childFolderId} />
          ))}
        </>
      ) : null}
    </div>
  )
}
