import { describe, it, expect, vi } from "vitest"
import { render, waitFor } from "@testing-library/react"
import React from "react"

import App from "./App"

vi.mock("@/hooks/use-interval", () => ({
  useInterval: vi.fn(),
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
