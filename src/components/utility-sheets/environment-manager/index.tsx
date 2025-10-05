import { useEffect, useState } from "react"

import { InfoIcon, LoaderIcon, SettingsIcon } from "lucide-react"

import DeleteDialog from "@/components/shared/delete-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCollection, useEnvironments } from "@/state"
import type { CollectionState } from "@/types"
import { type Environment, type EnvironmentAction, EnvironmentEditor, EnvironmentList } from "./components"

type EnvironmentManagerProps = {
  collectionId: string
  selectedEnvironmentId: string | undefined
}

type EnvironmentProps = {
  action: EnvironmentAction
  collection: CollectionState
  environment: Environment
}

export default function EnvironmentManager({ collectionId, selectedEnvironmentId }: EnvironmentManagerProps) {
  const {
    state: { collection },
    actions: { collectionsApi },
  } = useCollection(collectionId)
  const {
    actions: { environmentsApi },
  } = useEnvironments(collectionId)
  const [state, setState] = useState<EnvironmentProps | null>(null)

  useEffect(() => {
    return () => {
      void collectionsApi().saveCollection(collectionId)
    }
  }, [collectionId, collectionsApi])

  useEffect(() => {
    // Don't do anything if we already have a selected environment or the collection isn't loaded
    if (state || !collection) {
      return
    }

    const environments = Object.values(collection.environments)
    if (environments.length > 0) {
      // Prioritize the explicitly passed selectedEnvironmentId, otherwise fallback to the first environment
      const environmentToSelect = selectedEnvironmentId
        ? collection.environments[selectedEnvironmentId]
        : environments[0]

      if (environmentToSelect) {
        setState({
          action: "select",
          collection,
          environment: environmentToSelect,
        })
      }
    }
  }, [collection, selectedEnvironmentId, state])

  const handleEnvironmentAction = async (environment: Environment, action: EnvironmentAction) => {
    switch (action) {
      case "select":
      case "rename":
        setState({
          action,
          collection,
          environment,
        })
        break
      case "delete":
        setState({
          action,
          collection,
          environment,
        })
        break
      case "duplicate": {
        const newEnv = await environmentsApi.createEnvironment(collection.id, `${environment.name} Copy`)
        if (!newEnv) {
          // TODO: Handle error with a toast
          return
        }

        // Copy description
        if (environment.description) {
          await environmentsApi.updateEnvironment(collection.id, newEnv.id, {
            description: environment.description,
          })
        }

        // Copy variables
        const sourceVariables = Object.values(environment.variables ?? {})
        for (const variable of sourceVariables) {
          await environmentsApi.addEnvironmentVariable(collection.id, newEnv.id, {
            name: variable.name,
            value: variable.value,
            secure: variable.secure,
          })
        }

        // Select the new environment for editing
        setState({
          action: "select",
          collection,
          environment: newEnv,
        })
        break
      }
    }
  }

  // Handle the case where the collection data hasn't been synced to the dialog's proxy store yet.
  if (!collection) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderIcon className="w-8 h-8" />
      </div>
    )
  }

  return (
    <>
      {state?.action === "delete" && (
        <DeleteDialog
          open={true}
          title="Delete Environment"
          description={`Delete ${state.collection.name} environment ${state.environment.name}`}
          context={state}
          onDelete={({ collection, environment }: EnvironmentProps) =>
            collectionsApi().deleteEnvironment(collection.id, environment.id)
          }
          onCancel={(_: EnvironmentProps) => setState(null)}
        />
      )}

      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 pt-4">
          <Alert className="mb-3">
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Environments define named variable sets for this collection. Reference variables with
              <code className="mx-1">{"{{name}}"}</code> in URLs, params, headers, and bodies. Only enabled variables
              substitute; unresolved placeholders remain.
            </AlertDescription>
          </Alert>
        </div>
        <div className="grid flex-1 grid-cols-[18rem_1fr] overflow-hidden">
          <div className="min-h-0 overflow-y-auto border-r px-4 py-3">
            <EnvironmentList
              collectionId={collectionId}
              selectedId={state?.environment.id}
              onAction={handleEnvironmentAction}
            />
          </div>

          <div className="min-h-0 flex flex-col px-4 py-3">
            {state?.environment ? (
              <EnvironmentEditor
                collectionId={collectionId}
                environmentId={state.environment.id}
                action={state.action}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="space-y-4 text-center">
                  <div className="mx-auto w-fit rounded-full bg-muted/30 p-4">
                    <SettingsIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">No Environment Selected</p>
                    <p className="mt-2 text-sm">Select an environment from the list to view and edit variables.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
