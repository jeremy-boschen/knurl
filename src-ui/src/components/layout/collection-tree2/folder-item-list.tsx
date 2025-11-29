import { useCollectionFromCache } from "@/state"
import { RootCollectionFolderId } from "@/types"
import { FolderItem } from "./folder-item"
import { RequestItemList } from "./request-item-list"

type FolderItemListProps = {
  collectionId: string
  folderId: string
}

export function FolderItemList({ collectionId, folderId }: FolderItemListProps) {
  const {
    state: { collection },
  } = useCollectionFromCache(collectionId)
  const folder = collection.folders[folderId]
  if (!folder) {
    return null
  }

  const isRoot = folderId === RootCollectionFolderId

  return (
    <div className={`space-y-1 ${isRoot ? "" : "ml-3"}`} data-folder-id={folderId}>
      {!isRoot ? <FolderItem collectionId={collectionId} folderId={folderId} /> : null}

      {isRoot ? (
        <>
          <RequestItemList collectionId={collectionId} folder={folder} requestIds={folder.requestIds} />

          {folder.childFolderIds.map((childFolderId) => (
            <FolderItemList key={childFolderId} collectionId={collectionId} folderId={childFolderId} />
          ))}
        </>
      ) : null}
    </div>
  )
}
