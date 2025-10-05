import { useRef } from "react"

import { PlusIcon, ShieldCheckIcon, ShieldIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/knurl/input"
import { Label } from "@/components/ui/label"
import { Toggle } from "@/components/ui/toggle"
import { useEnvironment } from "@/state"
import type { EnvironmentVariable } from "@/types"
import type { EnvironmentAction } from "./index"

type Props = {
  collectionId: string
  environmentId: string
  action: EnvironmentAction
}

export function EnvironmentEditor({ collectionId, environmentId, action: _action }: Props) {
  const {
    state: { collection, environment },
    actions: { environmentsApi },
  } = useEnvironment(collectionId, environmentId)

  const nameRef = useRef<HTMLInputElement>(null)

  async function addVariable() {
    // Fire & Forget
    void environmentsApi.addEnvironmentVariable(collection.id, environment.id, {})
  }

  async function updateVariable(variableId: string, update: Partial<EnvironmentVariable>) {
    await environmentsApi.updateEnvironmentVariable(collection.id, environment.id, variableId, update)
  }

  async function removeVariable(variableId: string) {
    await environmentsApi.deleteEnvironmentVariable(collection.id, environment.id, variableId)
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="space-y-3">
        <h2 className="font-semibold text-muted-foreground">General</h2>
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <Label htmlFor={`${environment.id}-name`}>Name</Label>
            <Input
              ref={nameRef}
              id={`${environment.id}-name`}
              value={environment.name}
              onChange={async (e) =>
                await environmentsApi.updateEnvironment(collection.id, environment.id, {
                  name: e.currentTarget.value,
                })
              }
              tabIndex={0}
              placeholder="e.g., Development"
            />
          </div>

          <div className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <Label htmlFor={`${environment.id}-desc`}>Description</Label>
            <Input
              id={`${environment.id}-desc`}
              value={environment.description ?? ""}
              onChange={(e) =>
                environmentsApi.updateEnvironment(collection.id, environment.id, {
                  description: e.currentTarget.value,
                })
              }
              placeholder="Optional description"
            />
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-2">
        <div className="flex items-center justify-start gap-2">
          <h2 className="font-semibold text-muted-foreground">Variables</h2>
          <Badge variant="outline" className="text-xs">
            {Object.values(environment.variables ?? {}).length}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={addVariable}
            title="Add variable"
            className="text-primary hover:text-primary"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-1">
          {Object.values(environment.variables).map((variable) => (
            <div key={variable.id} className="grid grid-cols-[2fr_3fr_auto_auto] items-center gap-2 py-0 first:pt-0">
              <div>
                <Input
                  type="text"
                  placeholder="Name"
                  value={variable.name}
                  onChange={(e) => updateVariable(variable.id, { name: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <Input
                  type={variable.secure ? "password" : "text"}
                  placeholder="Value"
                  value={variable.value}
                  onChange={(e) => updateVariable(variable.id, { value: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <Toggle
                  size="sm"
                  variant="default"
                  title="Encrypt value in storage"
                  pressed={variable.secure}
                  className="font-mono"
                  onPressedChange={(secure) => updateVariable(variable.id, { secure })}
                >
                  {variable.secure ? <ShieldCheckIcon className="h-4 w-4" /> : <ShieldIcon className="h-4 w-4" />}
                </Toggle>
              </div>
              <div>
                <Button size="sm" variant="destructive" onClick={() => removeVariable(variable.id)}>
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
