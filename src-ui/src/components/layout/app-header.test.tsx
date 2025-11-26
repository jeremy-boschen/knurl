import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/request/tabbar", () => ({
  RequestTabBar: () => <div data-testid="request-tab-bar" />,
}))

vi.mock("./title-bar", () => ({
  TitleBar: () => <div data-testid="title-bar" />,
}))

import { AppHeader } from "./app-header"

describe("AppHeader", () => {
  it("renders title bar and request tab bar with merged className", () => {
    const { container } = render(<AppHeader className="custom" />)
    expect(screen.getByTestId("title-bar")).toBeInTheDocument()
    expect(screen.getByTestId("request-tab-bar")).toBeInTheDocument()
    const header = container.querySelector("[data-test-id='app-header']")
    expect(header?.className).toContain("custom")
  })
})
