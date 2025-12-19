import { describe, it, expect, vi } from "vitest"
import { render, waitFor } from "@testing-library/react"
import React from "react"

import App from "./App"

vi.mock("@/hooks/use-interval", () => ({
  useInterval: vi.fn(),
}))

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: vi.fn(() => Promise.resolve(() => {})),
    onMoved: vi.fn(() => Promise.resolve(() => {})),
    onResized: vi.fn(() => Promise.resolve(() => {})),
    isMinimized: vi.fn(() => Promise.resolve(false)),
    isMaximized: vi.fn(() => Promise.resolve(false)),
    outerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
    outerSize: vi.fn(() => Promise.resolve({ width: 1280, height: 800 })),
  }),
}))

// Smoke test: ensure top-level App renders without throwing runtime reference errors
describe("App smoke", () => {
  it("renders App without crashing", async () => {
    const { container } = render(<App />)
    await waitFor(() => {
      expect(container).toBeTruthy()
    })
  })
})
