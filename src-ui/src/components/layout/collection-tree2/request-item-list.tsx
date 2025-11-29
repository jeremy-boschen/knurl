import type { CollectionFolderNode } from "@/types"
import { RequestItem } from "./request-item"

type RequestItemListProps = {
  collectionId: string
  folder: CollectionFolderNode
  requestIds: string[]
}

export function RequestItemList({ collectionId, folder, requestIds }: RequestItemListProps) {
  if (!requestIds || requestIds.length === 0) {
    return null
  }

  return (
    <div className="space-y-1 pl-2" data-folder-id={folder.id}>
      {requestIds.map((requestId) => (
        <RequestItem key={requestId} collectionId={collectionId} requestId={requestId} />
      ))}
    </div>
  )
}
