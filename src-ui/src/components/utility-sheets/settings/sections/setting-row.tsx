import type React from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib"

export function SettingRow({
  label,
  description,
  className,
  children,
}: {
  label?: React.ReactNode
  description?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex items-center justify-between pb-0 mb-4 gap-2", className)}>
      <div className="space-y-0.5">
        {label && <Label>{label}</Label>}
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export const FieldHelp = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
)
