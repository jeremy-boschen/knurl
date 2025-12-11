import { EmptyState } from "./empty-state"
import { ParamRow, type ParamKind } from "./param-row"
import type { RequestHeader, RequestPathParam, RequestQueryParam, RequestCookieParam } from "@/types"

type Param = RequestHeader | RequestPathParam | RequestQueryParam | RequestCookieParam

type ParamListProps = {
  tabId: string
  kind: ParamKind
  items?: Record<string, Param> | null
  original?: Record<string, Param> | null
}

const EMPTY_MESSAGES: Record<ParamKind, string> = {
  path: "No path parameters added yet. Path parameters replace placeholders in the URL (e.g., /users/:id).",
  query: "No query parameters added yet. Query parameters are appended to the URL (e.g., ?name=value).",
  header: "No headers added yet.",
  cookie: "No cookies added yet.",
}

const EMPTY_STATE_TEST_IDS: Record<ParamKind, string> = {
  path: "empty-path-params-message",
  query: "empty-query-params-message",
  header: "empty-headers-message",
  cookie: "empty-cookies-message",
}

export function ParamList({ tabId, kind, items, original }: ParamListProps) {
  const order = Object.keys(items ?? {})
  const emptyMessage = EMPTY_MESSAGES[kind]
  const emptyStateTestId = EMPTY_STATE_TEST_IDS[kind]

  return (
    <div className="flex flex-col gap-3 divide-y divide-border/10">
      {order.map((id) => {
        const item = items?.[id]
        if (!item) {
          return null
        }
        return (
          <ParamRow key={item.id} tabId={tabId} kind={kind} param={item} original={original?.[id]} orderIds={order} />
        )
      })}

      {order.length === 0 &&
        (kind === "header" ? (
          <div data-test-id="request-headers-panel:empty-state">
            <div data-test-id={emptyStateTestId}>
              <EmptyState message={emptyMessage} />
            </div>
          </div>
        ) : (
          <div data-test-id={emptyStateTestId}>
            <EmptyState message={emptyMessage} />
          </div>
        ))}
    </div>
  )
}
