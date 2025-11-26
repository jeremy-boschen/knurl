import React, { Profiler, useCallback, useOptimistic } from "react"

import { Input } from "@/components/ui/knurl/input"
import { cn } from "@/lib"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useRequestParameters } from "@/state"
import type { RequestCookieParam } from "@/types"
import { FieldRow } from "./field-row"
import { SectionHeader } from "./section-header"
import { EmptyState } from "./empty-state"

export type RequestParametersPanelProps = {
  tabId: string
}

function RequestParametersPanelComponent({ tabId }: RequestParametersPanelProps) {
  const {
    state: { queryParams, pathParams, cookieParams, original },
    actions,
  } = useRequestParameters(tabId)

  // Optimistic updates for instant feedback
  const [optimisticPathParams, updatePathParamOptimistic] = useOptimistic(
    pathParams,
    (state, { paramId, changes }: { paramId: string; changes: Record<string, unknown> }) => ({
      ...state,
      [paramId]: { ...state[paramId], ...changes },
    }),
  )
  const [optimisticQueryParams, updateQueryParamOptimistic] = useOptimistic(
    queryParams,
    (state, { paramId, changes }: { paramId: string; changes: Record<string, unknown> }) => ({
      ...state,
      [paramId]: { ...state[paramId], ...changes },
    }),
  )
  const [optimisticCookieParams, updateCookieParamOptimistic] = useOptimistic(
    cookieParams,
    (state, { paramId, changes }: { paramId: string; changes: Record<string, unknown> }) => ({
      ...state,
      [paramId]: { ...state[paramId], ...changes },
    }),
  )

  // Path parameter handlers
  const handlePathParamEnabledChange = useCallback(
    (pathParamId: string, enabled: boolean) => {
      updatePathParamOptimistic({ paramId: pathParamId, changes: { enabled } })
      actions.updatePathParam(pathParamId, { enabled })
    },
    [actions, updatePathParamOptimistic],
  )
  const handlePathParamNameChange = useCallback(
    (pathParamId: string, name: string) => {
      updatePathParamOptimistic({ paramId: pathParamId, changes: { name } })
      actions.updatePathParam(pathParamId, { name })
    },
    [actions, updatePathParamOptimistic],
  )
  const handlePathParamValueChange = useCallback(
    (pathParamId: string, value: string) => {
      updatePathParamOptimistic({ paramId: pathParamId, changes: { value } })
      actions.updatePathParam(pathParamId, { value })
    },
    [actions, updatePathParamOptimistic],
  )
  const handlePathParamSecureChange = useCallback(
    (pathParamId: string, secure: boolean) => {
      updatePathParamOptimistic({ paramId: pathParamId, changes: { secure } })
      actions.updatePathParam(pathParamId, { secure })
    },
    [actions, updatePathParamOptimistic],
  )
  const handlePathParamDelete = useCallback((pathParamId: string) => actions.removePathParam(pathParamId), [actions])

  // Query parameter handlers
  const handleQueryParamEnabledChange = useCallback(
    (queryParamId: string, enabled: boolean) => {
      updateQueryParamOptimistic({ paramId: queryParamId, changes: { enabled } })
      actions.updateQueryParam(queryParamId, { enabled })
    },
    [actions, updateQueryParamOptimistic],
  )
  const handleQueryParamNameChange = useCallback(
    (queryParamId: string, name: string) => {
      updateQueryParamOptimistic({ paramId: queryParamId, changes: { name } })
      actions.updateQueryParam(queryParamId, { name })
    },
    [actions, updateQueryParamOptimistic],
  )
  const handleQueryParamValueChange = useCallback(
    (queryParamId: string, value: string) => {
      updateQueryParamOptimistic({ paramId: queryParamId, changes: { value } })
      actions.updateQueryParam(queryParamId, { value })
    },
    [actions, updateQueryParamOptimistic],
  )
  const handleQueryParamSecureChange = useCallback(
    (queryParamId: string, secure: boolean) => {
      updateQueryParamOptimistic({ paramId: queryParamId, changes: { secure } })
      actions.updateQueryParam(queryParamId, { secure })
    },
    [actions, updateQueryParamOptimistic],
  )
  const handleQueryParamDelete = useCallback(
    (queryParamId: string) => actions.removeQueryParam(queryParamId),
    [actions],
  )

  // Cookie parameter handlers
  const handleCookieParamEnabledChange = useCallback(
    (cookieParamId: string, enabled: boolean) => {
      updateCookieParamOptimistic({ paramId: cookieParamId, changes: { enabled } })
      actions.updateCookieParam(cookieParamId, { enabled })
    },
    [actions, updateCookieParamOptimistic],
  )
  const handleCookieParamNameChange = useCallback(
    (cookieParamId: string, name: string) => {
      updateCookieParamOptimistic({ paramId: cookieParamId, changes: { name } })
      actions.updateCookieParam(cookieParamId, { name })
    },
    [actions, updateCookieParamOptimistic],
  )
  const handleCookieParamValueChange = useCallback(
    (cookieParamId: string, value: string) => {
      updateCookieParamOptimistic({ paramId: cookieParamId, changes: { value } })
      actions.updateCookieParam(cookieParamId, { value })
    },
    [actions, updateCookieParamOptimistic],
  )
  const handleCookieParamSecureChange = useCallback(
    (cookieParamId: string, secure: boolean) => {
      updateCookieParamOptimistic({ paramId: cookieParamId, changes: { secure } })
      actions.updateCookieParam(cookieParamId, { secure })
    },
    [actions, updateCookieParamOptimistic],
  )
  const handleCookieParamDelete = useCallback(
    (cookieParamId: string) => actions.removeCookieParam(cookieParamId),
    [actions],
  )

  return (
    <Profiler id="RequestParametersPanel" onRender={onProfilerRender}>
      <div className="flex flex-col gap-4 p-2 h-full overflow-y-auto min-h-0" data-test-id="request-parameters-panel">
        {/* Path Parameters Section */}
        <div className="flex flex-col gap-3">
          <SectionHeader title="Path Parameters" />

          <div className="flex flex-col gap-3 divide-y divide-border/10">
            {Object.values(optimisticPathParams ?? {}).map((pathParam) => (
              <FieldRow
                key={pathParam.id}
                enabled={pathParam.enabled}
                onEnabledChange={(enabled) => handlePathParamEnabledChange(pathParam.id, enabled)}
                nameValue={pathParam.name}
                onNameChange={(name) => handlePathParamNameChange(pathParam.id, name)}
                valueSlot={
                  <Input
                    type={pathParam.secure ? "password" : "text"}
                    placeholder="Value"
                    value={pathParam.value}
                    onChange={(e) => handlePathParamValueChange(pathParam.id, e.target.value)}
                    className={cn(
                      "font-mono",
                      original.pathParams?.[pathParam.id]?.value !== pathParam.value && "unsaved-changes",
                    )}
                    data-test-id={`request-parameters-panel:path-param-value-input:${pathParam.id}`}
                  />
                }
                onDelete={() => handlePathParamDelete(pathParam.id)}
                secure={pathParam.secure}
                onSecureChange={(secure) => handlePathParamSecureChange(pathParam.id, secure)}
                deleteTooltip="Delete Path Parameter"
                hasUnsavedEnabled={original.pathParams?.[pathParam.id]?.enabled !== pathParam.enabled}
                hasUnsavedName={original.pathParams?.[pathParam.id]?.name !== pathParam.name}
                hasUnsavedSecure={original.pathParams?.[pathParam.id]?.secure !== pathParam.secure}
              />
            ))}

            {Object.keys(optimisticPathParams ?? {}).length === 0 && (
              <EmptyState message="No path parameters added yet. Path parameters replace placeholders in the URL (e.g., /users/:id)." />
            )}
          </div>
        </div>

        {/* Query Parameters Section */}
        <div className="flex flex-col gap-3">
          <SectionHeader title="Query Parameters" />

          <div className="flex flex-col gap-3 divide-y divide-border/10">
            {Object.values(optimisticQueryParams ?? {}).map((param) => (
              <FieldRow
                key={param.id}
                enabled={param.enabled}
                onEnabledChange={(enabled) => handleQueryParamEnabledChange(param.id, enabled)}
                nameValue={param.name}
                onNameChange={(name) => handleQueryParamNameChange(param.id, name)}
                valueSlot={
                  <Input
                    type={param.secure ? "password" : "text"}
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => handleQueryParamValueChange(param.id, e.target.value)}
                    className={cn(
                      "font-mono",
                      original.queryParams?.[param.id]?.value !== param.value && "unsaved-changes",
                    )}
                    data-test-id={`request-parameters-panel:query-param-value-input:${param.id}`}
                  />
                }
                onDelete={() => handleQueryParamDelete(param.id)}
                secure={param.secure}
                onSecureChange={(secure) => handleQueryParamSecureChange(param.id, secure)}
                deleteTooltip="Delete Query Parameter"
                hasUnsavedEnabled={original.queryParams?.[param.id]?.enabled !== param.enabled}
                hasUnsavedName={original.queryParams?.[param.id]?.name !== param.name}
                hasUnsavedSecure={original.queryParams?.[param.id]?.secure !== param.secure}
              />
            ))}

            {Object.keys(optimisticQueryParams ?? {}).length === 0 && (
              <EmptyState message="No query parameters added yet. Query parameters are appended to the URL (e.g., ?name=value)." />
            )}
          </div>
        </div>

        {/* Cookies Section (render only when provided to keep tests deterministic) */}
        {cookieParams !== undefined && (
          <div className="flex flex-col gap-3">
            <SectionHeader title="Cookies" />

            <div className="flex flex-col gap-3 divide-y divide-border/10">
              {Object.values((optimisticCookieParams ?? {}) as Record<string, RequestCookieParam>).map((param) => (
                <FieldRow
                  key={param.id}
                  enabled={param.enabled}
                  onEnabledChange={(enabled) => handleCookieParamEnabledChange(param.id, enabled)}
                  nameValue={param.name}
                  onNameChange={(name) => handleCookieParamNameChange(param.id, name)}
                  valueSlot={
                    <Input
                      type={param.secure ? "password" : "text"}
                      placeholder="Value"
                      value={param.value}
                      onChange={(e) => handleCookieParamValueChange(param.id, e.target.value)}
                      className={cn(
                        "font-mono",
                        original.cookieParams?.[param.id]?.value !== param.value && "unsaved-changes",
                      )}
                      data-test-id={`request-parameters-panel:cookie-param-value-input:${param.id}`}
                    />
                  }
                  onDelete={() => handleCookieParamDelete(param.id)}
                  secure={param.secure}
                  onSecureChange={(secure) => handleCookieParamSecureChange(param.id, secure)}
                  deleteTooltip="Delete Cookie"
                  hasUnsavedEnabled={original.cookieParams?.[param.id]?.enabled !== param.enabled}
                  hasUnsavedName={original.cookieParams?.[param.id]?.name !== param.name}
                  hasUnsavedSecure={original.cookieParams?.[param.id]?.secure !== param.secure}
                />
              ))}

              {Object.keys((optimisticCookieParams ?? {}) as Record<string, RequestCookieParam>).length === 0 && (
                <EmptyState message="No cookies added yet." />
              )}
            </div>
          </div>
        )}
      </div>
    </Profiler>
  )
}

export const RequestParametersPanel = React.memo(RequestParametersPanelComponent)
