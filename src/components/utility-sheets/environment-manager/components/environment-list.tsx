import { Button } from "@/components/ui/button"
import { Clickable } from "@/components/ui/knurl/clickable"
import { cn } from "@/lib/utils"
import { useEnvironments } from "@/state"
import type { Environment } from "@/types"
import type { EnvironmentActionHandler } from "./index"
import { Layers2Icon, PlusIcon, Trash2Icon } from "lucide-react"

type EnvironmentListProps = {
  collectionId: string
  selectedId: string | undefined
  onAction: EnvironmentActionHandler
}

export function EnvironmentList({ collectionId, selectedId, onAction }: EnvironmentListProps) {
  const {
    state: { collection, environments },
    actions: { environmentsApi },
  } = useEnvironments(collectionId)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-muted-foreground">Environments</h3>
        <Button
          onClick={() => environmentsApi.createEnvironment(collection.id, "Untitled Environment")}
          size="sm"
          variant="ghost"
          title="Add environment"
          className="text-primary hover:text-primary"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      {Object.values(environments).map((e) => (
        <EnvironmentCard key={e.id} environment={e} isSelected={selectedId === e.id} onAction={onAction} />
      ))}
    </div>
  )
}
function EnvironmentCard({
  environment,
  isSelected,
  onAction,
}: {
  environment: Environment
  isSelected: boolean
  onAction: EnvironmentActionHandler
}) {
  return (
    <Clickable
      role="treeitem"
      className={cn(
        "group/env relative cursor-pointer rounded-lg border transition-colors hover:border-primary/50",
        isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:bg-accent/50",
      )}
      onClick={() => onAction(environment, "select")}
    >
      <div className="flex items-start justify-between gap-2 p-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium">{environment.name}</h4>
          {environment.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={environment.description}>
              {environment.description}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              onAction(environment, "duplicate")
            }}
            title="Duplicate environment"
            aria-label="Duplicate environment"
          >
            <Layers2Icon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onAction(environment, "delete")
            }}
            title="Delete environment"
            aria-label="Delete environment"
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Clickable>
  )
}
