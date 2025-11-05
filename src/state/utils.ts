import { type ZodType, z } from "zod"

export function asSuspense<T>(promise: Promise<T>) {
  let status: "pending" | "success" | "error" = "pending"
  let result: T
  let error: unknown

  const suspender = promise.then(
    (r) => {
      status = "success"
      result = r
    },
    (e) => {
      status = "error"
      error = e
    },
  )

  return {
    read(): T {
      if (status === "pending") {
        throw suspender
      }
      if (status === "error") {
        throw error
      }
      return result // success
    },
  }
}

/**
 * Parse data with a Zod schema and log errors
 * @param schema
 * @param data
 */
export function zParse<T extends ZodType>(schema: T, data: z.input<T>): z.output<T> {
  try {
    return schema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      console.error(z.prettifyError(e), e)
    }
    throw e
  }
}
