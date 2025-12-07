import React, { Profiler } from "react"

import { ListIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useRequestHeaders } from "@/state"
import { EmptyState } from "./empty-state"
import { ParamRow } from "./param-row"

export type RequestHeadersPanelProps = {
  tabId: string
}

function RequestHeadersPanelComponent({ tabId }: RequestHeadersPanelProps) {
  const {
    state: { headers, original },
    actions,
  } = useRequestHeaders(tabId)

  return (
    <Profiler id="RequestHeadersPanel" onRender={onProfilerRender}>
      <div className="flex flex-col gap-3 p-2 h-full overflow-y-auto min-h-0" data-test-id="request-headers-panel">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Request Headers</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actions.addHeader()}
                data-test-id="request-headers-panel:add-header-button"
                className="h-6 px-2 gap-1"
              >
                <span className="text-xs">Add</span>
                <ListIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Header</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-col gap-1 divide-y divide-border/10">
          {Object.keys(headers ?? {}).map((headerId) => {
            const header = headers?.[headerId]
            if (!header) {
              return null
            }
            const orderIds = Object.keys(headers ?? {})
            return (
              <ParamRow
                key={header.id}
                tabId={tabId}
                kind="header"
                param={header}
                original={original[header.id]}
                orderIds={orderIds}
              />
            )
          })}

          {Object.keys(headers ?? {}).length === 0 && (
            <div data-test-id="request-headers-panel:empty-state">
              <EmptyState message='No headers added yet. Click "Add Header" to get started.' />
            </div>
          )}
        </div>
      </div>
    </Profiler>
  )
}

export const RequestHeadersPanel = React.memo(RequestHeadersPanelComponent)
