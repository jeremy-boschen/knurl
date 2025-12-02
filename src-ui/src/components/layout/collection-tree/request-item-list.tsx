import type { CollectionFolderNode } from "@/types"
import { RequestItem } from "./request-item"

type RequestItemListProps = {
  collectionId: string
  folder: CollectionFolderNode
}

export function RequestItemList({ collectionId, folder }: RequestItemListProps) {
  if (!folder.requestIds || folder.requestIds.length === 0) {
    return null
  }

  return (
    <div className="space-y-1 ml-2" data-folder-id={folder.id}>
      {folder.requestIds.map((requestId) => (
        <RequestItem key={requestId} collectionId={collectionId} requestId={requestId} />
      ))}
    </div>
  )
}
