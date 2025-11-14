/**
 * Environment management operations
 *
 * Handles all environment-level operations:
 * - Creating, updating, deleting environments
 * - Adding, updating, deleting environment variables
 * - Setting active environment
 */

import { merge } from "es-toolkit"
import type { StateCreator } from "zustand"

import { assert, generateUniqueId } from "@/lib/utils"
import { zParse } from "@/state/utils"
import { type Application, type Environment, type EnvironmentVariable, zEnvironmentVariable } from "@/types"
import { createEnvironment, existsInIndex, getLoadedCollection, touch } from "./core"

/**
 * Creates environment operation handlers
 */
export function createEnvironmentOps(set: ReturnType<StateCreator<Application>>, get: () => Application) {
  return {
    createEnvironment(collectionId: string, name: string, description?: string) {
      assert(existsInIndex(get, collectionId), `updateCollection called with an unknown collection.id: ${collectionId}`)

      getLoadedCollection(get, collectionId)

      const newEnvironment = createEnvironment({ name, description })

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment creation`)
        const environments = touch(draftCollection).environments
        assert(environments, `Collection ${collectionId} missing environments map during creation`)
        environments[newEnvironment.id] = newEnvironment
      })

      return newEnvironment
    },

    updateEnvironment(collectionId: string, id: string, update: Partial<Environment>) {
      assert(existsInIndex(get, collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)
      assert(
        update.id === undefined || update.id === id,
        `updateEnvironment expected update.id to be absent or equal to id:${id}. Found ${update.id}`,
      )

      const collection = getLoadedCollection(get, collectionId)

      assert(
        collection.environments?.[id],
        `updateEnvironment called with an unknown environment.id:${id} on collection ${collectionId}:${collection.name}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment update`)
        const environment = touch(draftCollection).environments?.[id]
        assert(environment, `Environment ${id} missing from collection ${collectionId} during update`)
        merge(environment, update)
      })
    },

    deleteEnvironment(collectionId: string, id: string) {
      assert(existsInIndex(get, collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)
      const collection = getLoadedCollection(get, collectionId)
      assert(
        collection.environments?.[id],
        `deleteEnvironment called with an unknown environment.id:${id} on collection ${collectionId}:${collection.name}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment delete`)
        const environments = touch(draftCollection).environments
        if (environments?.[id]) {
          delete environments[id]
        }
      })
    },

    setActiveEnvironment(collectionId: string, environmentId: string | undefined) {
      assert(
        existsInIndex(get, collectionId),
        `setActiveEnvironment called with an unknown collection.id: ${collectionId}`,
      )
      const collection = getLoadedCollection(get, collectionId)
      if (environmentId !== undefined) {
        assert(
          collection.environments?.[environmentId],
          `setActiveEnvironment called with unknown environment.id:${environmentId} on collection ${collectionId}:${collection.name}`,
        )
      }

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment activation`)
        touch(draftCollection).activeEnvironmentId = environmentId
      })
    },

    addEnvironmentVariable(collectionId: string, environmentId: string, variable: Partial<EnvironmentVariable>) {
      assert(
        existsInIndex(get, collectionId),
        `addEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )
      const collection = getLoadedCollection(get, collectionId)

      assert(
        collection.environments?.[environmentId],
        `addEnvironmentVariable called with an unknown environment.id: ${environmentId}`,
      )

      const newVariable = zParse(zEnvironmentVariable, {
        name: "",
        value: "",
        secure: false,
        ...variable,
        id: generateUniqueId(8),
      })

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during variable creation`)
        const environment = touch(draftCollection).environments?.[environmentId]
        assert(
          environment,
          `Environment ${environmentId} missing from collection ${collectionId} during variable creation`,
        )
        environment.variables[newVariable.id] = newVariable
      })

      return newVariable
    },

    updateEnvironmentVariable(
      collectionId: string,
      environmentId: string,
      variableId: string,
      update: Partial<EnvironmentVariable>,
    ) {
      assert(existsInIndex(get, collectionId), `updateEnvironmentVariable: unknown collection.id: ${collectionId}`)
      assert(
        update.id === undefined || update.id === variableId,
        `updateEnvironmentVariable expected update.id to be absent or equal to id:${variableId}. Found ${update.id}`,
      )

      const collection = getLoadedCollection(get, collectionId)
      const env = collection.environments?.[environmentId]
      assert(env, `updateEnvironmentVariable: unknown environment.id: ${environmentId}`)
      assert(
        env.variables?.[variableId],
        `updateEnvironmentVariable: unknown variable.id:${variableId} in environment ${environmentId}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during variable update`)
        const variable = touch(draftCollection).environments?.[environmentId]?.variables?.[variableId]
        assert(variable, `Variable ${variableId} missing during update`)
        merge(variable, update)
      })
    },

    deleteEnvironmentVariable(collectionId: string, environmentId: string, variableId: string) {
      assert(existsInIndex(get, collectionId), `deleteEnvironmentVariable: unknown collection.id: ${collectionId}`)
      const collection = getLoadedCollection(get, collectionId)
      const env = collection.environments?.[environmentId]
      assert(env, `deleteEnvironmentVariable: unknown environment.id: ${environmentId}`)
      assert(env.variables?.[variableId], `deleteEnvironmentVariable: unknown variable.id: ${variableId}`)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during variable delete`)
        const environment = touch(draftCollection).environments?.[environmentId]
        if (environment?.variables?.[variableId]) {
          delete environment.variables[variableId]
        }
      })
    },
  }
}
