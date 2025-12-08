import React, { Profiler } from "react"

import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useRequestParameters } from "@/state"
import { ParamList } from "./param-list"

export type RequestParametersPanelProps = {
  tabId: string
}

function RequestParametersPanelComponent({ tabId }: RequestParametersPanelProps) {
  const {
    state: { queryParams, pathParams, cookieParams, original },
    actions,
  } = useRequestParameters(tabId)

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
                  className="h-6 px-2 gap-1 hover:text-primary"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span className="text-xs">Path</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Path Parameter</TooltipContent>
            </Tooltip>
          </div>

          <ParamList
            tabId={tabId}
            kind="path"
            items={pathParams}
            original={original.pathParams}
            emptyMessage="No path parameters added yet. Path parameters replace placeholders in the URL (e.g., /users/:id)."
          />
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
                  className="h-6 px-2 gap-1 hover:text-primary"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span className="text-xs">Query</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Query Parameter</TooltipContent>
            </Tooltip>
          </div>

          <ParamList
            tabId={tabId}
            kind="query"
            items={queryParams}
            original={original.queryParams}
            emptyMessage="No query parameters added yet. Query parameters are appended to the URL (e.g., ?name=value)."
          />
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
                    className="h-6 px-2 gap-1 hover:text-primary"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span className="text-xs">Cookie</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Cookie</TooltipContent>
              </Tooltip>
            </div>

            <ParamList
              tabId={tabId}
              kind="cookie"
              items={cookieParams}
              original={original.cookieParams}
              emptyMessage="No cookies added yet."
            />
          </div>
        )}
      </div>
    </Profiler>
  )
}

export const RequestParametersPanel = React.memo(RequestParametersPanelComponent)
