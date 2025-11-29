import { HttpBadge } from "@/components/ui/knurl"
import { cn, isNotEmpty } from "@/lib"
import { useCollectionFromCache } from "@/state"

type RequestItemProps = {
  collectionId: string
  requestId: string
}

export function RequestItem({ collectionId, requestId }: RequestItemProps) {
  const {
    state: { collection },
  } = useCollectionFromCache(collectionId)
  const request = collection.requests[requestId]
  if (!request) {
    return null
  }

  return (
    <div
      className="flex items-center space-x-2 rounded px-2 py-1 cursor-pointer text-sm text-muted-foreground hover:bg-muted"
      data-request-id={requestId}
      role="treeitem"
      tabIndex={0}
    >
      <span aria-hidden className="text-primary">
        <HttpBadge method={request.method} className={cn(isNotEmpty(request.patch) && "unsaved-changes")} />
      </span>
      <span className="pt-1 text-sm leading-none">{request.name}</span>
    </div>
  )
}
