import React, { Profiler } from "react"

import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useRequestHeaders } from "@/state"
import { ParamList } from "./param-list"

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
                className="h-6 px-2 gap-1 hover:text-primary"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span className="text-xs">Header</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Header</TooltipContent>
          </Tooltip>
        </div>

        <ParamList
          tabId={tabId}
          kind="header"
          items={headers}
          original={original}
          emptyMessage='No headers added yet. Click "Add Header" to get started.'
          emptyStateTestId="request-headers-panel:empty-state"
        />
      </div>
    </Profiler>
  )
}

export const RequestHeadersPanel = React.memo(RequestHeadersPanelComponent)
