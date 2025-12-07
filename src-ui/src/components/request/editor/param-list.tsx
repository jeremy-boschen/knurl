import { EmptyState } from "./empty-state"
import { ParamRow, type ParamKind } from "./param-row"
import type { RequestHeader, RequestPathParam, RequestQueryParam, RequestCookieParam } from "@/types"

type Param = RequestHeader | RequestPathParam | RequestQueryParam | RequestCookieParam

type ParamListProps = {
  tabId: string
  kind: ParamKind
  items?: Record<string, Param> | null
  original?: Record<string, Param> | null
  emptyMessage: string
  emptyStateTestId?: string
}

export function ParamList({ tabId, kind, items, original, emptyMessage, emptyStateTestId }: ParamListProps) {
  const order = Object.keys(items ?? {})

  return (
    <div className="flex flex-col gap-3 divide-y divide-border/10">
      {order.map((id) => {
        const item = items?.[id]
        if (!item) {
          return null
        }
        return (
          <ParamRow
            key={item.id}
            tabId={tabId}
            kind={kind}
            param={item}
            original={original?.[id]}
            orderIds={order}
          />
        )
      })}

      {order.length === 0 && (
        <div data-test-id={emptyStateTestId}>
          <EmptyState message={emptyMessage} />
        </div>
      )}
    </div>
  )
}
