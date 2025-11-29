import { FileTextIcon } from "lucide-react"

import { useCollectionFromCache } from "@/state"

type RequestItemProps = {
  collectionId: string
  requestId: string
}

export function RequestItem({ collectionId, requestId }: RequestItemProps) {
  const { state: { collection } } = useCollectionFromCache(collectionId)
  const request = collection.requests[requestId]

  return (
    <div
      className="flex items-center space-x-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
      data-request-id={requestId}
      role="treeitem"
      tabIndex={0}
    >
      <span aria-hidden className="text-primary">
        <FileTextIcon className="h-3.5 w-3.5" />
      </span>
      <span>{request.name}</span>
    </div>
  )
}
