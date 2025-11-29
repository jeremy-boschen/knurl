import type { CollectionCache, CollectionFolderNode } from "@/types"
import { RequestItem } from "./request-item"

type RequestItemListProps = {
  collection: CollectionCache
  folder: CollectionFolderNode
  requestIds: string[]
}

export function RequestItemList({ collection, folder, requestIds }: RequestItemListProps) {
  if (!requestIds || requestIds.length === 0) {
    return null
  }

  return (
    <div className="space-y-1 pl-2" data-folder-id={folder.id}>
      {requestIds.map((requestId) => {
        const request = collection.requests[requestId]
        if (!request) {
          return null
        }

        return <RequestItem key={requestId} request={request} />
      })}
    </div>
  )
}
