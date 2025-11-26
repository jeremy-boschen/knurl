import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DataTable, DataTableCell, DataTableRow } from "./data-table"

describe("DataTable", () => {
  it("places header rows into thead and applies column template widths", () => {
    const { container } = render(
      <DataTable columnTemplate="75px 75px 1fr">
        <DataTableRow variant="header">
          <DataTableCell type="header">Method</DataTableCell>
          <DataTableCell type="header">URL</DataTableCell>
        </DataTableRow>
        <DataTableRow>
          <DataTableCell type="cell">GET</DataTableCell>
          <DataTableCell type="cell">https://api.knurl.dev</DataTableCell>
        </DataTableRow>
      </DataTable>,
    )

    const headerRow = container.querySelector("thead tr")
    const bodyRow = container.querySelector("tbody tr")
    expect(headerRow).not.toBeNull()
    expect(bodyRow).not.toBeNull()

    expect(screen.getByRole("columnheader", { name: /method/i })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: /https:\/\/api.knurl.dev/i })).toBeInTheDocument()

    const columns = container.querySelectorAll("colgroup col")
    expect(columns).toHaveLength(3)
    expect(columns[0]).toHaveStyle({ width: "75px" })
    expect(columns[1]).toHaveStyle({ width: "75px" })
    expect(columns[2]).toHaveStyle({ width: "1fr" })
  })

  it("renders header cells as <th> elements", () => {
    render(
      <table>
        <thead>
          <DataTableRow variant="header">
            <DataTableCell type="header">Status</DataTableCell>
          </DataTableRow>
        </thead>
      </table>,
    )

    const header = screen.getByRole("columnheader", { name: /status/i })
    expect(header.tagName).toBe("TH")
  })

  it("renders body cells as <td> elements", () => {
    render(
      <table>
        <tbody>
          <DataTableRow>
            <DataTableCell type="cell">OK</DataTableCell>
          </DataTableRow>
        </tbody>
      </table>,
    )

    const cell = screen.getByRole("cell", { name: "OK" })
    expect(cell.tagName).toBe("TD")
  })
})
