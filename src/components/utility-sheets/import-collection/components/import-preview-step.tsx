import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { LabeledField } from "@/components/ui/knurl"
import { Input } from "@/components/ui/knurl/input"
import type { Environment, RequestState } from "@/types"

interface ImportPreviewStepProps {
  requests: RequestState[]
  environments: Environment[]
  selectedRequests: Set<string>
  selectedEnvironments: Set<string>
  reqMasterState: boolean | "indeterminate"
  envMasterState: boolean | "indeterminate"
  onToggleRequest: (id: string, checked: boolean) => void
  onToggleAllRequests: (checked: boolean) => void
  onToggleEnvironment: (id: string, checked: boolean) => void
  onToggleAllEnvironments: (checked: boolean) => void
  filter: string
  onFilterChange: (newFilter: string) => void
}

export function ImportPreviewStep({
  requests,
  environments,
  selectedRequests,
  selectedEnvironments,
  reqMasterState,
  envMasterState,
  onToggleRequest,
  onToggleAllRequests,
  onToggleEnvironment,
  onToggleAllEnvironments,
  filter,
  onFilterChange,
}: ImportPreviewStepProps) {
  const filteredReqs = requests.filter((r) =>
    [r.name, r.method, r.url ?? ""].some((v) => v?.toLowerCase().includes(filter.trim().toLowerCase())),
  )

  return (
    <div className="min-h-0 h-full overflow-auto grid grid-cols-[1.3fr_0.8fr] gap-4">
      <section className="flex min-h-0 flex-col rounded-md border">
        <header className="flex items-center justify-between px-3 py-2 border-b gap-2">
          <LabeledField label="Requests" placement="after">
            <Checkbox checked={reqMasterState} onCheckedChange={(c) => onToggleAllRequests(c === true)} />
          </LabeledField>
          <Input
            name="import-filter"
            value={filter}
            onChange={(e) => onFilterChange(e.currentTarget.value)}
            placeholder="Filter..."
            className="ml-2"
            endAddon={
              <Button variant="ghost" size="sm" onClick={() => onFilterChange("")} className="rounded-l-none">
                <XIcon className="w-4 h-4" />
              </Button>
            }
          />
        </header>
        <div className="flex-1 min-h-0 overflow-auto p-1">
          <ul className="space-y-1">
            {filteredReqs.map((r) => (
              <li key={r.id}>
                <div className="grid grid-cols-[auto_0.4fr_1fr_minmax(0,1fr)] items-center gap-2 p-2 rounded hover:bg-muted/50 focus-within:bg-muted/60 cursor-pointer min-w-0">
                  <Checkbox
                    checked={selectedRequests.has(r.id)}
                    onCheckedChange={(c) => onToggleRequest(r.id, c === true)}
                  />
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded shrink-0 basis-8">{r.method}</span>
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{r.url || " "}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="flex min-h-0 flex-col rounded-md border">
        <header className="flex items-center justify-between px-3 py-2 border-b gap-2">
          <LabeledField label="Environments">
            <Checkbox
              checked={envMasterState}
              onCheckedChange={(c) => onToggleAllEnvironments(c === true)}
              disabled={environments.length === 0}
            />
          </LabeledField>
        </header>
        <div className="flex-1 min-h-0 overflow-auto p-1">
          <ul className="space-y-1">
            {environments.map((e) => (
              <li key={e.id}>
                <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 focus-within:bg-muted/60 cursor-pointer min-w-0">
                  <Checkbox
                    checked={selectedEnvironments.has(e.id)}
                    onCheckedChange={(c) => onToggleEnvironment(e.id, c === true)}
                  />
                  <span className="text-sm truncate">{e.name}</span>
                  <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-muted-foreground/10 shrink-0">
                    {Object.keys(e.variables ?? {}).length} vars
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
