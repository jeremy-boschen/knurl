import { useMemo } from "react"

import { CheckIcon, GlobeIcon, SettingsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib"
import { useCollection, useRequestTab, utilitySheetsApi } from "@/state"

function EnvironmentSelectorImpl({ collectionId }: { collectionId: string }) {
  const sheetsApi = utilitySheetsApi()

  const {
    state: { collection },
    actions: { collectionsApi },
  } = useCollection(collectionId)

  const environments = useMemo(() => {
    if (!collection?.environments) {
      return []
    }
    return Object.values(collection.environments)
  }, [collection])

  const activeEnvironmentId = collection?.activeEnvironmentId
  const activeEnvironment = activeEnvironmentId ? collection?.environments[activeEnvironmentId] : null

  const setActiveEnvironmentId = (id: string | undefined) => {
    if (!collection) {
      return
    }
    void collectionsApi().setActiveEnvironment(collection.id, id)
  }

  const handleManageEnvironments = () => {
    if (!collection) {
      return
    }
    sheetsApi.openSheet({
      type: "collection-settings",
      context: {
        collectionId: collection.id,
        selectedEnvironmentId: activeEnvironmentId ?? undefined,
        tab: "environments",
      },
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-sm font-normal">
          <GlobeIcon className="h-4 w-4" />
          {activeEnvironment ? activeEnvironment.name : "No Environment"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => setActiveEnvironmentId(undefined)}>
          <CheckIcon className={cn("mr-2 h-4 w-4", activeEnvironmentId === undefined ? "opacity-100" : "opacity-0")} />
          No Environment
        </DropdownMenuItem>
        {environments.map((env) => (
          <DropdownMenuItem key={env.id} onSelect={() => setActiveEnvironmentId(env.id)}>
            <CheckIcon className={cn("mr-2 h-4 w-4", activeEnvironmentId === env.id ? "opacity-100" : "opacity-0")} />
            {env.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleManageEnvironments}>
          <SettingsIcon className="h-4 w-4" />
          Manage Environments
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function EnvironmentSelector() {
  const tabData = useRequestTab()

  const collectionId = tabData?.state.activeTab?.collectionId

  if (!collectionId) {
    return (
      <Button variant="ghost" disabled className="h-8 text-sm">
        <GlobeIcon className="h-4 w-4" />
        No Environment
      </Button>
    )
  }

  return <EnvironmentSelectorImpl collectionId={collectionId} />
}
