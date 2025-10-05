import { useState } from "react"

import { GlobeIcon, LockIcon } from "lucide-react"

import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import EnvironmentManager from "@/components/utility-sheets/environment-manager"
import { Button } from "@/components/ui/button"
import { useCollection } from "@/state"
import CollectionAuthPanel from "./collection-auth-panel"

type Props = {
  collectionId: string
  tab?: "environments" | "authentication"
  selectedEnvironmentId?: string
}

export default function CollectionSettingsSheet({ collectionId, tab = "environments", selectedEnvironmentId }: Props) {
  const {
    state: { collection },
  } = useCollection(collectionId)
  const [activeTab, setActiveTab] = useState<"environments" | "authentication">(tab)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SheetHeader className="border-b px-6 pt-6 pb-3">
        <SheetTitle className="flex items-center gap-2 text-xl">
          <LockIcon className="h-5 w-5" />
          Collection Settings
        </SheetTitle>
        <SheetDescription>Manage environments and authentication defaults for {collection.name}.</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col overflow-hidden">
        <nav className="flex flex-wrap gap-2 border-b px-6 py-4" aria-label="Collection settings sections">
          <Button
            variant={activeTab === "environments" ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setActiveTab("environments")}
            aria-pressed={activeTab === "environments"}
            size="sm"
          >
            <GlobeIcon className="mr-1 h-4 w-4" /> Environments
          </Button>
          <Button
            variant={activeTab === "authentication" ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setActiveTab("authentication")}
            aria-pressed={activeTab === "authentication"}
            size="sm"
          >
            <LockIcon className="mr-1 h-4 w-4" /> Authentication
          </Button>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "environments" && (
            <EnvironmentManager collectionId={collectionId} selectedEnvironmentId={selectedEnvironmentId} />
          )}
          {activeTab === "authentication" && <CollectionAuthPanel collectionId={collectionId} />}
        </div>
      </div>
    </div>
  )
}
