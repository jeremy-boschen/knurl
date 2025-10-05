import type React from "react"

import { Badge } from "@/components/ui/badge"
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table"

type HeadersMap = Record<string, string>

const Badge2 = ({ children }: { children: React.ReactNode }) => (
  <Badge variant="outline" className="px-1 py-0.5 text-[10px]">
    {children}
  </Badge>
)

const prettyValue = (name: string, value: string) => {
  const n = name.toLowerCase()
  if (n === "content-length") {
    return { text: `${Number(value).toLocaleString()} B`, sub: value }
  }
  if (n === "date") {
    return { text: new Date(value).toLocaleString(), sub: value }
  }
  if (n === "etag") {
    return { text: value, badge: value.startsWith("W/") ? "weak" : "strong" }
  }
  if (n === "content-type") {
    const [mt, ...rest] = value.split(";")
    return { text: mt?.trim(), sub: rest.join(";").trim() }
  }
  if (n === "cache-control") {
    return { text: value, tokens: value.split(",").map((s) => s.trim()) }
  }
  return { text: value }
}

export const HeadersList = ({ headers }: { headers: HeadersMap }) => {
  return (
    <DataTable columnTemplate="220px 1fr">
      <DataTableRow variant="header">
        <DataTableCell type="header">Header</DataTableCell>
        <DataTableCell type="header">Value</DataTableCell>
      </DataTableRow>
      {Object.entries(headers).map(([name, value]) => {
        const { text, sub, badge, tokens } = prettyValue(name, value)
        return (
          <DataTableRow key={name}>
            <DataTableCell type="cell">{name}</DataTableCell>
            <DataTableCell type="cell">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className="min-w-0 break-all" title={value}>
                  {text}
                </div>
                {badge && <Badge2>{badge}</Badge2>}
                {tokens?.map((t) => (
                  <Badge2 key={t}>{t}</Badge2>
                ))}
                {sub && <span className="truncate text-xs text-foreground/70">{sub}</span>}
              </div>
            </DataTableCell>
          </DataTableRow>
        )
      })}
    </DataTable>
  )
}
