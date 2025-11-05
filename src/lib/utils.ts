import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Executes an array of promises and returns their resolved values.
 * If any promise is rejected, an AggregateError is thrown containing all rejection reasons.
 *
 * @param {Array<Promise<T[K]>>} promises - An array of promises to execute. The array must have the same structure as the output type.
 * @return {Promise<T>} A promise that resolves to an array containing the resolved values of the input promises,
 *                      or rejects with an AggregateError if any of the promises fail.
 */
export async function runTasks<T extends readonly unknown[]>(
  promises: [...{ [K in keyof T]: Promise<T[K]> }],
): Promise<T> {
  const results = await Promise.allSettled(promises)

  const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected")
  if (errors.length > 0) {
    // If you want to aggregate, you can throw all reasons
    throw new AggregateError(
      errors.map((e) => e.reason),
      "One or more tasks failed",
    )
  }

  // All results are successful here
  //
  // biome-ignore lint/suspicious/noExplicitAny: OK
  return results.map((r) => (r as PromiseFulfilledResult<any>).value) as unknown as T
}

export function isNotEmpty<T extends object>(obj: T | null | undefined): obj is T {
  return !!obj && Object.keys(obj).length > 0
}

export function isEmpty<T extends object>(obj: T | null | undefined): boolean {
  return obj == null || Object.keys(obj).length === 0
}

export function mixin<T extends object, M extends object>(obj: T, mixin: M): T & M {
  if (Object.getPrototypeOf(obj) === mixin) {
    return obj as T & M
  }
  return Object.assign(Object.create(mixin), obj) as T & M
}

export function cast<T>(value: unknown): T {
  return value as T
}

export function nonNull<T>(value: T, message?: string): NonNullable<T> {
  if (value == null) {
    throw new Error(message ?? "value expected to be non-null")
  }
  return value
}

/**
 * Generates a random 12-digit string using A-Za-z0-9 characters
 * @returns A random string of 12 characters
 */
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
export const generateUniqueId = (length: number = 12): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHA[b % ALPHA.length]).join("")
}

export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}

export function assertPresent<T>(value: T | null | undefined, msg?: string): asserts value is T {
  if (value == null) {
    throw new Error(msg)
  }
}
export function assertAbsent<T>(value: T | null | undefined, msg?: string): asserts value is null | undefined {
  if (value != null) {
    throw new Error(msg)
  }
}
