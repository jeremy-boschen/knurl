import { useCallback, useLayoutEffect, useRef } from "react"

// biome-ignore lint/suspicious/noExplicitAny: OK
export function useEvent<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn)
  // Keep the latest fn without changing the identity of the returned callback
  useLayoutEffect(() => {
    ref.current = fn
  })
  // biome-ignore lint/suspicious/noExplicitAny: OK
  return useCallback(((...args: any[]) => ref.current(...args)) as T, [])
}
