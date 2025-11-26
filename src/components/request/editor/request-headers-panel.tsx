import React, { Profiler, useCallback, useOptimistic } from "react"

import { ShieldIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/knurl/input"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { cn } from "@/lib"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useRequestHeaders } from "@/state"

export type RequestHeadersPanelProps = {
  tabId: string
}

function RequestHeadersPanelComponent({ tabId }: RequestHeadersPanelProps) {
  const {
    state: { headers, original },
    actions,
  } = useRequestHeaders(tabId)

  const [optimisticHeaders, updateOptimisticHeader] = useOptimistic(
    headers,
    (state, { headerId, changes }: { headerId: string; changes: Record<string, unknown> }) => ({
      ...state,
      [headerId]: { ...state[headerId], ...changes },
    }),
  )

  const handleHeaderChange = useCallback(
    (headerId: string, changes: Record<string, unknown>) => {
      updateOptimisticHeader({ headerId, changes })
      actions.updateHeader(headerId, changes)
    },
    [actions, updateOptimisticHeader],
  )

  return (
    <Profiler id="RequestHeadersPanel" onRender={onProfilerRender}>
      <div className="flex flex-col gap-3 p-2 h-full overflow-y-auto min-h-0" data-test-id="request-headers-panel">
        <div className="flex items-center justify-start gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Request Headers</h3>
        </div>

        <div className="flex flex-col gap-1 divide-y divide-border/10">
          {Object.values(optimisticHeaders ?? {}).map((header) => (
            <div
              key={header.id}
              className="grid grid-cols-[1.5rem_2fr_3fr_auto_auto] items-center gap-3 py-3 first:pt-0"
              data-test-id={`request-headers-panel:header-row:${header.id}`}
            >
              <div className="flex items-center h-9">
                <Checkbox
                  checked={header.enabled}
                  className={cn(original[header.id]?.enabled !== header.enabled && "unsaved-changes")}
                  onCheckedChange={(checked) => handleHeaderChange(header.id, { enabled: !!checked })}
                  data-test-id={`request-headers-panel:enabled-checkbox:${header.id}`}
                />
              </div>
              <div>
                <Input
                  type="text"
                  placeholder="Name"
                  value={header.name}
                  onChange={(e) => handleHeaderChange(header.id, { name: e.target.value })}
                  className={cn("font-mono", original[header.id]?.name !== header.name && "unsaved-changes")}
                  data-test-id={`request-headers-panel:name-input:${header.id}`}
                />
              </div>
              <div>
                <Input
                  type={header.secure ? "password" : "text"}
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => handleHeaderChange(header.id, { value: e.target.value })}
                  className={cn("font-mono", original[header.id]?.value !== header.value && "unsaved-changes")}
                  data-test-id={`request-headers-panel:value-input:${header.id}`}
                />
              </div>
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      variant="default"
                      pressed={header.secure}
                      className={cn(original[header.id]?.secure !== header.secure && "unsaved-changes")}
                      onPressedChange={(secure) => handleHeaderChange(header.id, { secure })}
                      data-test-id={`request-headers-panel:secure-toggle:${header.id}`}
                    >
                      {header.secure ? <ShieldCheckIcon className="h-4 w-4" /> : <ShieldIcon className="h-4 w-4" />}
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Encrypt value in storage</TooltipContent>
                </Tooltip>
              </div>
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => actions.removeHeader(header.id)}
                      data-test-id={`request-headers-panel:delete-button:${header.id}`}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Header</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}

          {Object.keys(headers ?? {}).length === 0 && (
            <div
              className="text-center text-muted-foreground/70 text-sm py-8"
              data-test-id="request-headers-panel:empty-state"
            >
              No headers added yet. Click "Add Header" to get started.
            </div>
          )}
        </div>
      </div>
    </Profiler>
  )
}

export const RequestHeadersPanel = React.memo(RequestHeadersPanelComponent)
