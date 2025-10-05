import { Children, isValidElement } from "react"
import type { HTMLAttributes, ReactElement, ReactNode } from "react"

import { cn } from "@/lib/utils"

type DataTableProps = {
  children: ReactNode
  className?: string
  columnTemplate?: string
}

export function DataTable({ children, className, columnTemplate }: DataTableProps) {
  const columnWidths = columnTemplate?.trim().split(/\s+/) ?? []
  const childArray = Children.toArray(children) as ReactElement[]

  const headerRows: ReactElement[] = []
  const bodyRows: ReactElement[] = []

  for (const child of childArray) {
    if (!isValidElement(child)) {
      continue
    }

    if (child.type === DataTableRow && child.props.variant === "header") {
      headerRows.push(child)
    } else {
      bodyRows.push(child)
    }
  }

  const widthOccurrences = new Map<string, number>()

  return (
    <div className="h-full overflow-auto font-mono text-sm">
      <table className={cn("w-full border-collapse", className)}>
        {columnWidths.length > 0 && (
          <colgroup>
            {columnWidths.map((width) => {
              const occurrence = widthOccurrences.get(width) ?? 0
              widthOccurrences.set(width, occurrence + 1)
              const key = occurrence === 0 ? width : `${width}-${occurrence}`
              return <col key={key} style={{ width }} />
            })}
          </colgroup>
        )}
        {headerRows.length > 0 && <thead>{headerRows}</thead>}
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  )
}

type DataTableCellProps = HTMLAttributes<HTMLTableCellElement> & {
  children: ReactNode
  className?: string
  type: "header" | "cell"
}

export function DataTableCell({ children, className, type, ...props }: DataTableCellProps) {
  if (type === "header") {
    return (
      <th
        scope="col"
        className={cn(
          "sticky top-0 z-10 border-b border-border/50 bg-muted/50 px-4 pt-4 pb-3 text-left font-bold uppercase tracking-wide text-muted-foreground backdrop-blur-sm",
          className,
        )}
        {...props}
      >
        {children}
      </th>
    )
  }

  return (
    <td className={cn("border-b border-border/25 px-4 py-3 text-foreground/90", className)} {...props}>
      {children}
    </td>
  )
}

type DataTableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  children: ReactNode
  className?: string
  variant?: "body" | "header"
}

export function DataTableRow({ children, className, variant = "body", ...props }: DataTableRowProps) {
  return (
    <tr
      className={cn("last:border-b-0", variant === "body" ? "border-b border-border/25" : undefined, className)}
      {...props}
    >
      {children}
    </tr>
  )
}
