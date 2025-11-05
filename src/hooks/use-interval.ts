import { useEffect, useRef } from "react"

/**
 * Calls your async callback in sequence, spacing each run by `delay` ms
 */
export function useInterval(callback: () => void | Promise<void>, delay: number) {
  const saved = useRef<() => void | Promise<void>>(null)

  useEffect(() => {
    saved.current = callback
  }, [callback])

  useEffect(() => {
    if ((delay ?? 0) <= 0) {
      return
    }

    let active = true
    let timer: number

    async function tick() {
      if (saved.current) {
        try {
          await saved.current()
        } catch (err) {
          console.error("useInterval error:", err)
        }
      }

      if (active) {
        timer = window.setTimeout(tick, delay)
      }
    }

    // kick it off
    window.setTimeout(tick, delay)

    return () => {
      active = false
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [delay])
}
