import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ReactNode } from "react"

import { DndTreeProvider, useDndTreeContext, useOptionalDndTreeContext } from "./dnd-tree-context"

describe("dnd tree context", () => {
  const providerValue = { activeId: "node-1", dropIndicator: { id: "node-2", position: "inside" as const } }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DndTreeProvider value={providerValue}>{children}</DndTreeProvider>
  )

  it("exposes the context when wrapped", () => {
    const { result } = renderHook(() => useDndTreeContext(), { wrapper })
    expect(result.current).toBe(providerValue)
  })

  it("throws a helpful error when used without provider", () => {
    expect(() => renderHook(() => useDndTreeContext())).toThrow(/DndTreeProvider/)
  })

  it("optional hook falls back to null", () => {
    const withoutProvider = renderHook(() => useOptionalDndTreeContext())
    expect(withoutProvider.result.current).toBeNull()

    const withProvider = renderHook(() => useOptionalDndTreeContext(), { wrapper })
    expect(withProvider.result.current).toBe(providerValue)
  })
})
