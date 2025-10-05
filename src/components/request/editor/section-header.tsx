import type { ReactNode } from "react"

export type SectionHeaderProps = {
  title: string
  children?: ReactNode
  actions?: ReactNode
}

export function SectionHeader({ title, children, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        {children}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
