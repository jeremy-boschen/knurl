import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { HeadersList } from "./headers-list"

describe("HeadersList", () => {
  it("formats special header values", () => {
    const dateSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("Jan 02, 2025, 10:00 AM")
    render(
      <HeadersList
        headers={{
          "content-length": "1024",
          Date: "2025-01-02T18:00:00.000Z",
          ETag: 'W/"abcd"',
          "Content-Type": "application/json; charset=utf-8",
          "cache-control": "max-age=60, public",
          "x-request-id": "abc-123",
        }}
      />,
    )

    const lengthRow = getByDataId("headers-list:row:content-length")
    expect(lengthRow).toHaveTextContent("B")
    expect(lengthRow).toHaveTextContent("1024")

    const dateRow = getByDataId("headers-list:row:Date")
    expect(dateRow).toHaveTextContent("Jan 02, 2025, 10:00 AM")

    const etagRow = getByDataId("headers-list:row:ETag")
    expect(within(etagRow).getByText(/weak/i)).toBeInTheDocument()

    const contentTypeRow = getByDataId("headers-list:row:Content-Type")
    expect(contentTypeRow).toHaveTextContent("application/json")
    expect(contentTypeRow).toHaveTextContent("charset=utf-8")

    const cacheRow = getByDataId("headers-list:row:cache-control")
    expect(within(cacheRow).getByText("max-age=60")).toBeInTheDocument()
    expect(within(cacheRow).getByText("public")).toBeInTheDocument()

    const customRow = getByDataId("headers-list:row:x-request-id")
    expect(customRow).toHaveTextContent("abc-123")
    dateSpy.mockRestore()
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}
