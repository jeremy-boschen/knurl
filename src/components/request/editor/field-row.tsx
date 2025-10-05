import { ShieldIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/knurl/input"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { cn } from "@/lib"

export type FieldRowProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  nameValue: string
  onNameChange: (name: string) => void
  valueSlot: ReactNode
  onDelete: () => void
  secure?: boolean
  onSecureChange?: (secure: boolean) => void
  deleteTooltip?: string
  hasUnsavedEnabled?: boolean
  hasUnsavedName?: boolean
  hasUnsavedSecure?: boolean
}

export function FieldRow({
  enabled,
  onEnabledChange,
  nameValue,
  onNameChange,
  valueSlot,
  onDelete,
  secure,
  onSecureChange,
  deleteTooltip = "Delete",
  hasUnsavedEnabled = false,
  hasUnsavedName = false,
  hasUnsavedSecure = false,
}: FieldRowProps) {
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,6fr)_minmax(0,8fr)_2rem_2rem] items-center gap-3 py-1 first:pt-0">
      <div className="flex h-9 items-center">
        <Checkbox
          checked={enabled}
          className={cn(hasUnsavedEnabled && "unsaved-changes")}
          onCheckedChange={(checked) => onEnabledChange(!!checked)}
        />
      </div>
      <div>
        <Input
          type="text"
          placeholder="Name"
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
          className={cn("font-mono", hasUnsavedName && "unsaved-changes")}
        />
      </div>
      <div className="min-w-0">{valueSlot}</div>
      <div className="flex justify-center">
        {onSecureChange ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                variant="default"
                pressed={secure}
                onPressedChange={onSecureChange}
                className={cn(hasUnsavedSecure && "unsaved-changes")}
              >
                {secure ? <ShieldCheckIcon className="h-4 w-4" /> : <ShieldIcon className="h-4 w-4" />}
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Encrypt value in storage</TooltipContent>
          </Tooltip>
        ) : (
          <div className="w-8" />
        )}
      </div>
      <div className="flex justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="destructive" onClick={onDelete} className="h-8 w-8 p-0">
              <Trash2Icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{deleteTooltip}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
