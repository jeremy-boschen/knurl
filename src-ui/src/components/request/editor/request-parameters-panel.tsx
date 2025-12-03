import React, { Profiler, useCallback, useOptimistic, useTransition } from "react"

import { RouteIcon, FilterIcon, CookieIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { cn } from "@/lib"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useRequestParameters } from "@/state"
import type { RequestCookieParam } from "@/types"
import { FieldRow } from "./field-row"
import { EmptyState } from "./empty-state"

export type RequestParametersPanelProps = {
  tabId: string
}

function RequestParametersPanelComponent({ tabId }: RequestParametersPanelProps) {
  const {
    state: { queryParams, pathParams, cookieParams, original },
    actions,
  } = useRequestParameters(tabId)

  const [, startTransition] = useTransition()

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
      startTransition(() => {
        updatePathParamOptimistic({ paramId: pathParamId, changes: { enabled } })
      })
      actions.updatePathParam(pathParamId, { enabled })
    },
    [actions, updatePathParamOptimistic],
  )
  const handlePathParamNameChange = useCallback(
    (pathParamId: string, name: string) => {
      startTransition(() => {
        updatePathParamOptimistic({ paramId: pathParamId, changes: { name } })
      })
      actions.updatePathParam(pathParamId, { name })
    },
    [actions, updatePathParamOptimistic],
  )
  const handlePathParamValueChange = useCallback(
    (pathParamId: string, value: string) => {
      startTransition(() => {
        updatePathParamOptimistic({ paramId: pathParamId, changes: { value } })
      })
      actions.updatePathParam(pathParamId, { value })
    },
    [actions, updatePathParamOptimistic],
  )
  const handlePathParamSecureChange = useCallback(
    (pathParamId: string, secure: boolean) => {
      startTransition(() => {
        updatePathParamOptimistic({ paramId: pathParamId, changes: { secure } })
      })
      actions.updatePathParam(pathParamId, { secure })
    },
    [actions, updatePathParamOptimistic],
  )
  const handlePathParamDelete = useCallback((pathParamId: string) => actions.removePathParam(pathParamId), [actions])

  const handlePathParamMoveUp = useCallback(
    (pathParamId: string) => {
      const ids = Object.keys(optimisticPathParams ?? {})
      const index = ids.indexOf(pathParamId)
      if (index > 0) {
        const newIds = [...ids]
        ;[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
        actions.reorderPathParams(newIds)
      }
    },
    [optimisticPathParams, actions],
  )

  const handlePathParamMoveDown = useCallback(
    (pathParamId: string) => {
      const ids = Object.keys(optimisticPathParams ?? {})
      const index = ids.indexOf(pathParamId)
      if (index < ids.length - 1) {
        const newIds = [...ids]
        ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
        actions.reorderPathParams(newIds)
      }
    },
    [optimisticPathParams, actions],
  )

  // Query parameter handlers
  const handleQueryParamEnabledChange = useCallback(
    (queryParamId: string, enabled: boolean) => {
      startTransition(() => {
        updateQueryParamOptimistic({ paramId: queryParamId, changes: { enabled } })
      })
      actions.updateQueryParam(queryParamId, { enabled })
    },
    [actions, updateQueryParamOptimistic],
  )
  const handleQueryParamNameChange = useCallback(
    (queryParamId: string, name: string) => {
      startTransition(() => {
        updateQueryParamOptimistic({ paramId: queryParamId, changes: { name } })
      })
      actions.updateQueryParam(queryParamId, { name })
    },
    [actions, updateQueryParamOptimistic],
  )
  const handleQueryParamValueChange = useCallback(
    (queryParamId: string, value: string) => {
      startTransition(() => {
        updateQueryParamOptimistic({ paramId: queryParamId, changes: { value } })
      })
      actions.updateQueryParam(queryParamId, { value })
    },
    [actions, updateQueryParamOptimistic],
  )
  const handleQueryParamSecureChange = useCallback(
    (queryParamId: string, secure: boolean) => {
      startTransition(() => {
        updateQueryParamOptimistic({ paramId: queryParamId, changes: { secure } })
      })
      actions.updateQueryParam(queryParamId, { secure })
    },
    [actions, updateQueryParamOptimistic],
  )
  const handleQueryParamDelete = useCallback(
    (queryParamId: string) => actions.removeQueryParam(queryParamId),
    [actions],
  )

  const handleQueryParamMoveUp = useCallback(
    (queryParamId: string) => {
      const ids = Object.keys(optimisticQueryParams ?? {})
      const index = ids.indexOf(queryParamId)
      if (index > 0) {
        const newIds = [...ids]
        ;[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
        actions.reorderQueryParams(newIds)
      }
    },
    [optimisticQueryParams, actions],
  )

  const handleQueryParamMoveDown = useCallback(
    (queryParamId: string) => {
      const ids = Object.keys(optimisticQueryParams ?? {})
      const index = ids.indexOf(queryParamId)
      if (index < ids.length - 1) {
        const newIds = [...ids]
        ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
        actions.reorderQueryParams(newIds)
      }
    },
    [optimisticQueryParams, actions],
  )

  // Cookie parameter handlers
  const handleCookieParamEnabledChange = useCallback(
    (cookieParamId: string, enabled: boolean) => {
      startTransition(() => {
        updateCookieParamOptimistic({ paramId: cookieParamId, changes: { enabled } })
      })
      actions.updateCookieParam(cookieParamId, { enabled })
    },
    [actions, updateCookieParamOptimistic],
  )
  const handleCookieParamNameChange = useCallback(
    (cookieParamId: string, name: string) => {
      startTransition(() => {
        updateCookieParamOptimistic({ paramId: cookieParamId, changes: { name } })
      })
      actions.updateCookieParam(cookieParamId, { name })
    },
    [actions, updateCookieParamOptimistic],
  )
  const handleCookieParamValueChange = useCallback(
    (cookieParamId: string, value: string) => {
      startTransition(() => {
        updateCookieParamOptimistic({ paramId: cookieParamId, changes: { value } })
      })
      actions.updateCookieParam(cookieParamId, { value })
    },
    [actions, updateCookieParamOptimistic],
  )
  const handleCookieParamSecureChange = useCallback(
    (cookieParamId: string, secure: boolean) => {
      startTransition(() => {
        updateCookieParamOptimistic({ paramId: cookieParamId, changes: { secure } })
      })
      actions.updateCookieParam(cookieParamId, { secure })
    },
    [actions, updateCookieParamOptimistic],
  )
  const handleCookieParamDelete = useCallback(
    (cookieParamId: string) => actions.removeCookieParam(cookieParamId),
    [actions],
  )

  const handleCookieParamMoveUp = useCallback(
    (cookieParamId: string) => {
      const ids = Object.keys(optimisticCookieParams ?? {})
      const index = ids.indexOf(cookieParamId)
      if (index > 0) {
        const newIds = [...ids]
        ;[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
        actions.reorderCookieParams(newIds)
      }
    },
    [optimisticCookieParams, actions],
  )

  const handleCookieParamMoveDown = useCallback(
    (cookieParamId: string) => {
      const ids = Object.keys(optimisticCookieParams ?? {})
      const index = ids.indexOf(cookieParamId)
      if (index < ids.length - 1) {
        const newIds = [...ids]
        ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
        actions.reorderCookieParams(newIds)
      }
    },
    [optimisticCookieParams, actions],
  )

  return (
    <Profiler id="RequestParametersPanel" onRender={onProfilerRender}>
      <div className="flex flex-col gap-4 p-2 h-full overflow-y-auto min-h-0" data-test-id="request-parameters-panel">
        {/* Path Parameters Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Path Parameters</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => actions.addPathParam()}
                  data-test-id="request-parameters-panel:add-path-param-button"
                  className="h-6 px-2 gap-1"
                >
                  <span className="text-xs">Add</span>
                  <RouteIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Path Parameter</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-col gap-3 divide-y divide-border/10">
            {Object.entries(optimisticPathParams ?? {}).map(([_index, pathParam]) => {
              const pathParamIds = Object.keys(optimisticPathParams ?? {})
              const paramIndex = pathParamIds.indexOf(pathParam.id)
              return (
                <FieldRow
                  key={pathParam.id}
                  enabled={pathParam.enabled}
                  onEnabledChange={(enabled) => handlePathParamEnabledChange(pathParam.id, enabled)}
                  nameValue={pathParam.name}
                  onNameChange={(name) => handlePathParamNameChange(pathParam.id, name)}
                  valueInputProps={{
                    type: pathParam.secure ? "password" : "text",
                    placeholder: "Value",
                    value: pathParam.value,
                    onChange: (e) => handlePathParamValueChange(pathParam.id, e.target.value),
                    className: cn(
                      "font-mono",
                      original.pathParams?.[pathParam.id]?.value !== pathParam.value && "unsaved-changes",
                    ),
                    "data-test-id": `request-parameters-panel:path-param-value-input:${pathParam.id}`,
                  }}
                  onDelete={() => handlePathParamDelete(pathParam.id)}
                  secure={pathParam.secure}
                  onSecureChange={(secure) => handlePathParamSecureChange(pathParam.id, secure)}
                  onMoveUp={() => handlePathParamMoveUp(pathParam.id)}
                  onMoveDown={() => handlePathParamMoveDown(pathParam.id)}
                  canMoveUp={paramIndex > 0}
                  canMoveDown={paramIndex < pathParamIds.length - 1}
                  hasUnsavedEnabled={original.pathParams?.[pathParam.id]?.enabled !== pathParam.enabled}
                  hasUnsavedName={original.pathParams?.[pathParam.id]?.name !== pathParam.name}
                  hasUnsavedSecure={original.pathParams?.[pathParam.id]?.secure !== pathParam.secure}
                />
              )
            })}

            {Object.keys(optimisticPathParams ?? {}).length === 0 && (
              <EmptyState message="No path parameters added yet. Path parameters replace placeholders in the URL (e.g., /users/:id)." />
            )}
          </div>
        </div>

        {/* Query Parameters Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Query Parameters</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => actions.addQueryParam()}
                  data-test-id="request-parameters-panel:add-query-param-button"
                  className="h-6 px-2 gap-1"
                >
                  <span className="text-xs">Add</span>
                  <FilterIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Query Parameter</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-col gap-3 divide-y divide-border/10">
            {Object.entries(optimisticQueryParams ?? {}).map(([_index, param]) => {
              const queryParamIds = Object.keys(optimisticQueryParams ?? {})
              const paramIndex = queryParamIds.indexOf(param.id)
              return (
                <FieldRow
                  key={param.id}
                  enabled={param.enabled}
                  onEnabledChange={(enabled) => handleQueryParamEnabledChange(param.id, enabled)}
                  nameValue={param.name}
                  onNameChange={(name) => handleQueryParamNameChange(param.id, name)}
                  valueInputProps={{
                    type: param.secure ? "password" : "text",
                    placeholder: "Value",
                    value: param.value,
                    onChange: (e) => handleQueryParamValueChange(param.id, e.target.value),
                    className: cn(
                      "font-mono",
                      original.queryParams?.[param.id]?.value !== param.value && "unsaved-changes",
                    ),
                    "data-test-id": `request-parameters-panel:query-param-value-input:${param.id}`,
                  }}
                  onDelete={() => handleQueryParamDelete(param.id)}
                  secure={param.secure}
                  onSecureChange={(secure) => handleQueryParamSecureChange(param.id, secure)}
                  onMoveUp={() => handleQueryParamMoveUp(param.id)}
                  onMoveDown={() => handleQueryParamMoveDown(param.id)}
                  canMoveUp={paramIndex > 0}
                  canMoveDown={paramIndex < queryParamIds.length - 1}
                  hasUnsavedEnabled={original.queryParams?.[param.id]?.enabled !== param.enabled}
                  hasUnsavedName={original.queryParams?.[param.id]?.name !== param.name}
                  hasUnsavedSecure={original.queryParams?.[param.id]?.secure !== param.secure}
                />
              )
            })}

            {Object.keys(optimisticQueryParams ?? {}).length === 0 && (
              <EmptyState message="No query parameters added yet. Query parameters are appended to the URL (e.g., ?name=value)." />
            )}
          </div>
        </div>

        {/* Cookies Section (render only when provided to keep tests deterministic) */}
        {cookieParams !== undefined && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Cookies</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => actions.addCookieParam()}
                    data-test-id="request-parameters-panel:add-cookie-param-button"
                    className="h-6 px-2 gap-1"
                  >
                    <span className="text-xs">Add</span>
                    <CookieIcon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Cookie</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-col gap-3 divide-y divide-border/10">
              {Object.entries((optimisticCookieParams ?? {}) as Record<string, RequestCookieParam>).map(
                ([_index, param]) => {
                  const cookieParamIds = Object.keys(optimisticCookieParams ?? {})
                  const paramIndex = cookieParamIds.indexOf(param.id)
                  return (
                    <FieldRow
                      key={param.id}
                      enabled={param.enabled}
                      onEnabledChange={(enabled) => handleCookieParamEnabledChange(param.id, enabled)}
                      nameValue={param.name}
                      onNameChange={(name) => handleCookieParamNameChange(param.id, name)}
                      valueInputProps={{
                        type: param.secure ? "password" : "text",
                        placeholder: "Value",
                        value: param.value,
                        onChange: (e) => handleCookieParamValueChange(param.id, e.target.value),
                        className: cn(
                          "font-mono",
                          original.cookieParams?.[param.id]?.value !== param.value && "unsaved-changes",
                        ),
                        "data-test-id": `request-parameters-panel:cookie-param-value-input:${param.id}`,
                      }}
                      onDelete={() => handleCookieParamDelete(param.id)}
                      secure={param.secure}
                      onSecureChange={(secure) => handleCookieParamSecureChange(param.id, secure)}
                      onMoveUp={() => handleCookieParamMoveUp(param.id)}
                      onMoveDown={() => handleCookieParamMoveDown(param.id)}
                      canMoveUp={paramIndex > 0}
                      canMoveDown={paramIndex < cookieParamIds.length - 1}
                      hasUnsavedEnabled={original.cookieParams?.[param.id]?.enabled !== param.enabled}
                      hasUnsavedName={original.cookieParams?.[param.id]?.name !== param.name}
                      hasUnsavedSecure={original.cookieParams?.[param.id]?.secure !== param.secure}
                    />
                  )
                },
              )}

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
