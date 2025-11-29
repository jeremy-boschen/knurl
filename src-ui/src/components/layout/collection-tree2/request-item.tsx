import { FileTextIcon } from "lucide-react"

import type { RequestState } from "@/types"

type RequestItemProps = {
  request: RequestState
}

export function RequestItem({ request }: RequestItemProps) {
  return (
    <div
      className="flex items-center space-x-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
      data-request-id={request.id}
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
