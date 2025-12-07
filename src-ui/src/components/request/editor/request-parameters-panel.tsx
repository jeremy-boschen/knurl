import React, { Profiler } from "react"

import { RouteIcon, FilterIcon, CookieIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useRequestParameters } from "@/state"
import { ParamRow } from "./param-row"
import { EmptyState } from "./empty-state"

export type RequestParametersPanelProps = {
  tabId: string
}

function RequestParametersPanelComponent({ tabId }: RequestParametersPanelProps) {
  const {
    state: { queryParams, pathParams, cookieParams, original },
    actions,
  } = useRequestParameters(tabId)

  const pathOrder = Object.keys(pathParams ?? {})
  const queryOrder = Object.keys(queryParams ?? {})
  const cookieOrder = Object.keys(cookieParams ?? {})

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
            {pathOrder.map((paramId) => {
              const pathParam = pathParams?.[paramId]
              if (!pathParam) {
                return null
              }
              return (
                <ParamRow
                  key={pathParam.id}
                  tabId={tabId}
                  kind="path"
                  param={pathParam}
                  original={original.pathParams?.[pathParam.id]}
                  orderIds={pathOrder}
                />
              )
            })}

            {pathOrder.length === 0 && (
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
            {queryOrder.map((paramId) => {
              const param = queryParams?.[paramId]
              if (!param) {
                return null
              }
              return (
                <ParamRow
                  key={param.id}
                  tabId={tabId}
                  kind="query"
                  param={param}
                  original={original.queryParams?.[param.id]}
                  orderIds={queryOrder}
                />
              )
            })}

            {queryOrder.length === 0 && (
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
              {cookieOrder.map((paramId) => {
                const param = cookieParams?.[paramId]
                if (!param) {
                  return null
                }
                return (
                  <ParamRow
                    key={param.id}
                    tabId={tabId}
                    kind="cookie"
                    param={param}
                    original={original.cookieParams?.[param.id]}
                    orderIds={cookieOrder}
                  />
                )
              })}

              {cookieOrder.length === 0 && (
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
