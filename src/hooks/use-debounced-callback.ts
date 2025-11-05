import { useEffect, useMemo, useRef } from "react"

/**
 * Creates a debounced version of a callback function that delays its execution.
 *
 * @param callback The function to debounce.
 * @param delay The debounce delay in milliseconds.
 * @returns A memoized function that you can call.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): (...args: A) => void {
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  })

  return useMemo(() => debounce((...args: A) => callbackRef.current(...args), delay), [delay])
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  let timer: number | undefined
  return (...args: A) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      fn(...args)
    }, delay)
  }
}
