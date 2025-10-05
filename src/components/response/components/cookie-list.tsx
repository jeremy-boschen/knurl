import type * as React from "react"

import { CopyIcon, PlusCircleIcon } from "lucide-react"

import type { Cookie } from "@/types"
import { Badge } from "@/components/ui/badge"
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { useRequestCookies } from "@/state"

const CookieBadge = ({ children }: { children: React.ReactNode }) => (
  <Badge variant="secondary" className="px-1 py-0.5 text-xs">
    {children}
  </Badge>
)

const CookieRow = ({
  cookie,
  onCopy,
  onAddToCookies,
}: {
  cookie: Cookie
  onCopy: (value: string) => void
  onAddToCookies: (cookie: Cookie) => void
}) => {
  const flags = [
    cookie.httpOnly && "HttpOnly",
    cookie.secure && "Secure",
    cookie.sameSite && `SameSite=${cookie.sameSite}`,
    !cookie.expires && "Session",
  ].filter(Boolean)

  const cookieValue = `${cookie.name}=${cookie.value}`

  return (
    <DataTableRow>
      <DataTableCell type="cell">{cookie.name}</DataTableCell>
      <DataTableCell type="cell" className="min-w-0 break-all" title={cookie.value}>
        {cookie.value}
      </DataTableCell>
      <DataTableCell type="cell">{cookie.domain ?? "—"}</DataTableCell>
      <DataTableCell type="cell">{cookie.path ?? "/"}</DataTableCell>
      <DataTableCell type="cell">{cookie.expires ? new Date(cookie.expires).toLocaleString() : "—"}</DataTableCell>
      <DataTableCell type="cell">
        <div className="flex flex-wrap items-center gap-1">
          {flags.map((f) => (
            <CookieBadge key={f as string}>{f}</CookieBadge>
          ))}
        </div>
      </DataTableCell>
      <DataTableCell type="cell" className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onCopy(cookieValue)} title="Copy cookie">
          <CopyIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onAddToCookies(cookie)} title="Add to request cookies">
          <PlusCircleIcon className="h-4 w-4" />
        </Button>
      </DataTableCell>
    </DataTableRow>
  )
}

export const CookieList = ({ tabId, cookies }: { tabId: string; cookies: Cookie[] }) => {
  const { actions } = useRequestCookies(tabId)

  const handleCopy = (value: string) => {
    void navigator.clipboard.writeText(value)
  }

  const handleAddToCookies = (cookie: Cookie) => {
    actions.addCookieFromResponse(cookie)
  }

  return (
    <DataTable columnTemplate="minmax(120px,1fr) minmax(240px,3fr) minmax(140px,1fr) minmax(80px,0.7fr) minmax(200px,1fr) minmax(100px,1fr) minmax(100px,0.8fr)">
      <DataTableRow variant="header">
        <DataTableCell type="header">Name</DataTableCell>
        <DataTableCell type="header">Value</DataTableCell>
        <DataTableCell type="header">Domain</DataTableCell>
        <DataTableCell type="header">Path</DataTableCell>
        <DataTableCell type="header">Expires</DataTableCell>
        <DataTableCell type="header">Flags</DataTableCell>
        <DataTableCell type="header" className="text-right pr-2">
          Actions
        </DataTableCell>
      </DataTableRow>
      {cookies.map((c) => (
        <CookieRow
          key={`${c.name}@${c.domain || ""}${c.path || "/"}`}
          cookie={c}
          onCopy={handleCopy}
          onAddToCookies={handleAddToCookies}
        />
      ))}
    </DataTable>
  )
}
