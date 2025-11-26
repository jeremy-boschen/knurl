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

type EnvironmentSelectorImplProps = {
  collectionId: string
  tabId: string
  requestTabsApi?: {
    selectEnvironment: (tabId: string, environmentId: string | undefined) => void
  }
}

function EnvironmentSelectorImpl({ collectionId, tabId, requestTabsApi }: EnvironmentSelectorImplProps) {
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
    try {
      collectionsApi().setActiveEnvironment(collection.id, id)
      requestTabsApi?.selectEnvironment(tabId, id)
    } catch (error) {
      console.error("Failed to set active environment", error)
    }
  }

  const handleManageEnvironments = () => {
    if (!collection) {
      return
    }
    try {
      sheetsApi.openSheet({
        type: "collection-settings",
        context: {
          collectionId: collection.id,
          selectedEnvironmentId: activeEnvironmentId ?? undefined,
          tab: "environments",
        },
      })
    } catch (error) {
      console.error("Failed to open environment manager", error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="link"
          className="h-auto p-0 text-sm font-normal"
          data-test-id="environment-selector:trigger-button"
        >
          <GlobeIcon className="h-4 w-4" />
          {activeEnvironment ? activeEnvironment.name : "No Environment"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-test-id="environment-selector:menu-content">
        <DropdownMenuItem
          onSelect={() => setActiveEnvironmentId(undefined)}
          data-test-id="environment-selector:no-environment-item"
        >
          <CheckIcon className={cn("mr-2 h-4 w-4", activeEnvironmentId === undefined ? "opacity-100" : "opacity-0")} />
          No Environment
        </DropdownMenuItem>
        {environments.map((env) => (
          <DropdownMenuItem
            key={env.id}
            onSelect={() => setActiveEnvironmentId(env.id)}
            data-test-id={`environment-selector:environment-item:${env.id}`}
          >
            <CheckIcon className={cn("mr-2 h-4 w-4", activeEnvironmentId === env.id ? "opacity-100" : "opacity-0")} />
            {env.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleManageEnvironments}
          data-test-id="environment-selector:manage-environments-item"
        >
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
  const tabId = tabData?.state.activeTab?.tabId
  const tabsApi = tabData?.actions.requestTabsApi

  if (!collectionId || !tabId) {
    return (
      <Button
        variant="ghost"
        disabled
        className="h-8 text-sm"
        data-test-id="environment-selector:no-environment-button"
      >
        <GlobeIcon className="h-4 w-4" />
        No Environment
      </Button>
    )
  }

  return (
    <EnvironmentSelectorImpl
      collectionId={collectionId}
      tabId={tabId}
      requestTabsApi={tabsApi}
      data-test-id="environment-selector"
    />
  )
}
