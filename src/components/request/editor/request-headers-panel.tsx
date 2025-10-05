import { ShieldIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/knurl/input"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { cn } from "@/lib"
import { useRequestHeaders } from "@/state"

export type RequestHeadersPanelProps = {
  tabId: string
}

export function RequestHeadersPanel({ tabId }: RequestHeadersPanelProps) {
  const {
    state: { headers, original },
    actions,
  } = useRequestHeaders(tabId)

  return (
    <div className="flex flex-col gap-3 p-2 h-full overflow-y-auto min-h-0">
      <div className="flex items-center justify-start gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Request Headers</h3>
      </div>

      <div className="flex flex-col gap-1 divide-y divide-border/10">
        {Object.values(headers ?? {}).map((header) => (
          <div key={header.id} className="grid grid-cols-[1.5rem_2fr_3fr_auto_auto] items-center gap-3 py-3 first:pt-0">
            <div className="flex items-center h-9">
              <Checkbox
                checked={header.enabled}
                className={cn(original[header.id]?.enabled !== header.enabled && "unsaved-changes")}
                onCheckedChange={(checked) => actions.updateHeader(header.id, { enabled: !!checked })}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Name"
                value={header.name}
                onChange={(e) => actions.updateHeader(header.id, { name: e.target.value })}
                className={cn("font-mono", original[header.id]?.name !== header.name && "unsaved-changes")}
              />
            </div>
            <div>
              <Input
                type={header.secure ? "password" : "text"}
                placeholder="Value"
                value={header.value}
                onChange={(e) => actions.updateHeader(header.id, { value: e.target.value })}
                className={cn("font-mono", original[header.id]?.value !== header.value && "unsaved-changes")}
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
                    onPressedChange={(secure) => actions.updateHeader(header.id, { secure })}
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
                  <Button size="icon" variant="destructive" onClick={() => actions.removeHeader(header.id)}>
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Header</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}

        {Object.keys(headers ?? {}).length === 0 && (
          <div className="text-center text-muted-foreground/70 text-sm py-8">
            No headers added yet. Click "Add Header" to get started.
          </div>
        )}
      </div>
    </div>
  )
}
