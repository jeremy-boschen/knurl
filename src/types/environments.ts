import { z } from "zod"

// Environment schema copied from lib/schema.ts

export const zEnvironmentVariable = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  secure: z.boolean(),
})

export type EnvironmentVariable = z.infer<typeof zEnvironmentVariable>

export const zEnvironment = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  variables: z.record(z.string(), zEnvironmentVariable),
})
export type Environment = z.infer<typeof zEnvironment>

export const zEnvironments = z.object({
  environments: z.record(z.string(), zEnvironment),
})
export type Environments = z.infer<typeof zEnvironments>

/**
 * Interface for environment management
 */
export interface EnvironmentsApi {
  /**
   * Add a new environment
   * @param collectionId - The collection ID to add the environment to
   * @param name - The name of the environment
   * @param description - An optional description for the environment
   * @returns The newly created environment
   */
  createEnvironment(collectionId: string, name: string, description?: string): Promise<Environment>

  /**
   * Update an existing environment
   * @param collectionId
   * @param id - Environment ID
   * @param update - Partial environment data to update
   */
  updateEnvironment(collectionId: string, id: string, update: Partial<Environment>): Promise<void>

  /**
   * Remove an environment
   * @param collectionId
   * @param id - Environment ID
   */
  deleteEnvironment(collectionId: string, id: string): Promise<void>

  /**
   * Sets the active environment for a collection
   * @param collectionId - The collection ID
   * @param environmentId - The environment ID to set as active. Use `undefined` to clear.
   */
  setActiveEnvironment(collectionId: string, environmentId: string | undefined): Promise<void>

  /**
   * Add a variable to a collection's environment
   *
   * @param collectionId
   * @param environmentId
   * @param variable
   */
  addEnvironmentVariable(
    collectionId: string,
    environmentId: string,
    variable: Partial<EnvironmentVariable>,
  ): Promise<void>

  /**
   * Add a variable to a collection's environment
   *
   * @param collectionId
   * @param environmentId
   * @param variableId
   * @param update
   */
  updateEnvironmentVariable(
    collectionId: string,
    environmentId: string,
    variableId: string,
    update: Partial<EnvironmentVariable>,
  ): Promise<void>

  /**
   * Add a variable to a collection's environment
   *
   * @param collectionId
   * @param environmentId
   * @param variableId
   */
  deleteEnvironmentVariable(collectionId: string, environmentId: string, variableId: string): Promise<void>
}
