import React from "react"

import { FileTextIcon } from "lucide-react"

import type { RequestState } from "@/types"

type RequestItemProps = {
  request: RequestState
}

export function RequestItem({ request }: RequestItemProps) {
  return (
    <div className="request-item" data-request-id={request.id} role="treeitem">
      <span aria-hidden className="request-item__icon">
        <FileTextIcon size={14} />
      </span>
      <span className="request-item__name">{request.name}</span>
    </div>
  )
}
