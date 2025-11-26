import { z } from "zod"

import { deleteAppData, isAppError, loadAppData, saveAppData } from "@/bindings/knurl"

interface FileStorage<S> {
  load: (fileName: string) => Promise<S | null>
  save: (fileName: string, data: S) => Promise<void>
  delete: (fileName: string) => Promise<void>
}

export const zFileHeaderSchema = z.object({
  version: z.number(),
  updated: z.iso.datetime(),
})

export function ZodFileStorage<S extends z.ZodTypeAny>(schema: S) {
  return z.object({
    header: zFileHeaderSchema,
    content: schema,
  })
}

// Wrapper storage type for initial file content parsing
const zStorageFileSchema = ZodFileStorage(z.unknown())

export interface MigrateContext {
  fileName: string
  version: number
  content: unknown
}
export interface StorageOptions<S> {
  version: number
  schema: z.ZodSchema<S>
  migrate?: (context: MigrateContext) => Promise<S>
  writeable?: boolean
}

/**
 * createStorage<S> - Validated FileStorage implementation based on a Zod schema
 *
 * @param options
 */
export function createStorage<Schema>(options: StorageOptions<Schema>): FileStorage<Schema> {
  const { version, schema, migrate, writeable = true } = options

  const tryLoad = async (fileName: string) => {
    try {
      return await loadAppData(fileName)
    } catch (e) {
      console.error(`createStorage: Failed to load file ${fileName}`, e)
      if (isAppError(e, ["FileNotFound", "IoError"])) {
        // Allow zustand to use the initial state defined in the slice
        return null
      }
      throw e
    }
  }

  const api = {
    load: async (fileName: string) => {
      // 1. Load and parse the file, allowing content to be unknown until we confirm whether migration is necessary
      //
      const fileData = await tryLoad(fileName)
      if (fileData == null) {
        // Allow initial state
        return null
      }

      const parsedFile = zStorageFileSchema.safeParse(fileData)
      if (!parsedFile.success) {
        console.error(`Failed to parse file ${fileName}:`, z.prettifyError(parsedFile.error))
        // Allow initial state
        return null
      }

      let { header, content } = parsedFile.data

      if (migrate && header.version !== version) {
        console.debug(`Migrating file ${fileName} content version ${header.version} to version ${version}`)
        try {
          content = await migrate({
            content,
            version: header.version,
            fileName,
          })
        } catch (e) {
          console.error(`Migration threw for ${fileName}:`, e)
          throw e
        }
      }

      // 2. Parse the content against the output schema
      //
      let parsedState: z.ZodSafeParseResult<Schema>
      try {
        parsedState = schema.safeParse(content)
      } catch (e) {
        console.error(`Schema.safeParse threw for ${fileName}:`, e)
        throw e
      }
      if (!parsedState.success) {
        console.error(`Failed to parse file ${fileName} content:\n${z.prettifyError(parsedState.error)}`)
        // Allow initial state
        return null
      }

      // If we migrated any data, save it back to storage
      if (migrate && header.version !== version) {
        console.debug(`Saving migrated file ${fileName} content`)
        // Fire & Forget
        void api.save(fileName, parsedState.data)
      }

      return parsedState.data
    },

    save: async (fileName: string, content: Schema) => {
      if (!writeable) {
        return Promise.resolve()
      }

      return await saveAppData(fileName, {
        header: {
          version,
          updated: new Date().toISOString(),
        },
        content,
      })
    },

    delete: async (fileName: string) => {
      if (!writeable) {
        return Promise.resolve()
      }

      return await deleteAppData(fileName)
    },
  }

  return api
}
