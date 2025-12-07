import { FieldRow } from "./field-row"
import { useRequestHeaders, useRequestParameters } from "@/state"
import type { RequestHeader, RequestPathParam, RequestQueryParam, RequestCookieParam } from "@/types"

export type ParamKind = "header" | "path" | "query" | "cookie"

type Param = RequestHeader | RequestPathParam | RequestQueryParam | RequestCookieParam

const prefixByKind: Record<ParamKind, string> = {
  header: "request-headers-panel",
  path: "request-parameters-panel:path",
  query: "request-parameters-panel:query",
  cookie: "request-parameters-panel:cookie",
}

export type ParamRowProps = {
  tabId: string
  kind: ParamKind
  param: Param
  original?: Param
  orderIds: string[]
}

export function ParamRow({ tabId, kind, param, original, orderIds }: ParamRowProps) {
  const headerApi = useRequestHeaders(tabId)
  const paramsApi = useRequestParameters(tabId)

  const update = (changes: Partial<Param>) => {
    switch (kind) {
      case "header":
        headerApi.actions.updateHeader(param.id, changes)
        break
      case "path":
        paramsApi.actions.updatePathParam(param.id, changes)
        break
      case "query":
        paramsApi.actions.updateQueryParam(param.id, changes)
        break
      case "cookie":
        paramsApi.actions.updateCookieParam(param.id, changes)
        break
    }
  }

  const remove = () => {
    switch (kind) {
      case "header":
        headerApi.actions.removeHeader(param.id)
        break
      case "path":
        paramsApi.actions.removePathParam(param.id)
        break
      case "query":
        paramsApi.actions.removeQueryParam(param.id)
        break
      case "cookie":
        paramsApi.actions.removeCookieParam(param.id)
        break
    }
  }

  const reorder = (direction: "up" | "down") => {
    const idx = orderIds.indexOf(param.id)
    if (idx === -1) {
      return
    }
    const target = direction === "up" ? idx - 1 : idx + 1
    if (target < 0 || target >= orderIds.length) {
      return
    }
    const next = [...orderIds]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    switch (kind) {
      case "header":
        headerApi.actions.reorderHeaders(next)
        break
      case "path":
        paramsApi.actions.reorderPathParams(next)
        break
      case "query":
        paramsApi.actions.reorderQueryParams(next)
        break
      case "cookie":
        paramsApi.actions.reorderCookieParams(next)
        break
    }
  }

  const prefix = prefixByKind[kind]
  const originalEntry = original ?? ({} as Param)
  const canMoveUp = orderIds.indexOf(param.id) > 0
  const canMoveDown = orderIds.indexOf(param.id) < orderIds.length - 1

  return (
    <FieldRow
      fieldKey={param.id}
      dataTestIdPrefix={prefix}
      field={{
        enabled: param.enabled,
        name: param.name,
        value: param.value,
        secure: (param as RequestHeader).secure,
      }}
      unsaved={{
        enabled: originalEntry.enabled !== param.enabled,
        name: originalEntry.name !== param.name,
        value: originalEntry.value !== param.value,
        secure: (originalEntry as RequestHeader).secure !== (param as RequestHeader).secure,
      }}
      onChange={(changes) => update(changes)}
      onDelete={remove}
      onMoveUp={() => reorder("up")}
      onMoveDown={() => reorder("down")}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
    />
  )
}
