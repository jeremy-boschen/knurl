import React, { Profiler, useCallback, useOptimistic, useTransition } from "react"

import { ListIcon, ChevronUpIcon, ChevronDownIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/knurl/input"
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

  const [, startTransition] = useTransition()

  const [optimisticHeaders, updateOptimisticHeader] = useOptimistic(
    headers,
    (state, { headerId, changes }: { headerId: string; changes: Record<string, unknown> }) => ({
      ...state,
      [headerId]: { ...state[headerId], ...changes },
    }),
  )

  const handleHeaderChange = useCallback(
    (headerId: string, changes: Record<string, unknown>) => {
      startTransition(() => {
        updateOptimisticHeader({ headerId, changes })
      })
      actions.updateHeader(headerId, changes)
    },
    [actions, updateOptimisticHeader],
  )

  const handleHeaderMoveUp = useCallback(
    (headerId: string) => {
      const ids = Object.keys(optimisticHeaders ?? {})
      const index = ids.indexOf(headerId)
      if (index > 0) {
        const newIds = [...ids]
        ;[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
        actions.reorderHeaders(newIds)
      }
    },
    [optimisticHeaders, actions],
  )

  const handleHeaderMoveDown = useCallback(
    (headerId: string) => {
      const ids = Object.keys(optimisticHeaders ?? {})
      const index = ids.indexOf(headerId)
      if (index < ids.length - 1) {
        const newIds = [...ids]
        ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
        actions.reorderHeaders(newIds)
      }
    },
    [optimisticHeaders, actions],
  )

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
          {Object.entries(optimisticHeaders ?? {}).map(([_index, header]) => {
            const headerIds = Object.keys(optimisticHeaders ?? {})
            const headerIndex = headerIds.indexOf(header.id)
            return (
              <div
                key={header.id}
                className="grid grid-cols-[1.5rem_2fr_3fr_auto] items-center gap-3 py-3 first:pt-0"
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
                <div className="flex justify-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        data-test-id={`request-headers-panel:menu-button:${header.id}`}
                      >
                        <div
                          className="w-1 h-1 bg-current rounded-full"
                          style={{ boxShadow: "-3px 0 0 0 currentColor, 3px 0 0 0 currentColor" }}
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuCheckboxItem
                        checked={header.secure}
                        onCheckedChange={(secure) => handleHeaderChange(header.id, { secure })}
                        className={cn(original[header.id]?.secure !== header.secure && "unsaved-changes")}
                        data-test-id={`request-headers-panel:menu-sensitive:${header.id}`}
                      >
                        Sensitive
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          handleHeaderMoveUp(header.id)
                        }}
                        disabled={headerIndex === 0}
                        data-test-id={`request-headers-panel:menu-move-up:${header.id}`}
                      >
                        <ChevronUpIcon className="mr-2 h-4 w-4" />
                        Move Up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          handleHeaderMoveDown(header.id)
                        }}
                        disabled={headerIndex === headerIds.length - 1}
                        data-test-id={`request-headers-panel:menu-move-down:${header.id}`}
                      >
                        <ChevronDownIcon className="mr-2 h-4 w-4" />
                        Move Down
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          actions.removeHeader(header.id)
                        }}
                        className="text-destructive focus:text-destructive"
                        data-test-id={`request-headers-panel:menu-delete:${header.id}`}
                      >
                        <Trash2Icon className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}

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
