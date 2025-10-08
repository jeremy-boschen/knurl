import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ExportedCollection } from "@/types"

import * as parsers from "./parsers"
import { useImportParser } from "./use-import-parser"

describe("useImportParser", () => {
  it("passes OpenAPI conversion options through to the converter", async () => {
    const spec = {
      openapi: "3.1.0",
      info: { title: "Spec", version: "1.0.0" },
      paths: {},
    }

    const converted: ExportedCollection = {
      format: "native",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      collection: {
        id: "col",
        name: "Converted",
        updated: new Date().toISOString(),
        encryption: { algorithm: "aes-gcm" },
        environments: {},
        requests: {},
        authentication: { type: "none" },
      },
    }

    const spy = vi.spyOn(parsers, "openApiToNative").mockReturnValue(converted)

    const options = { groupByTags: false }
    const { result } = renderHook(
      (props: { data: string; format: "openapi"; options: { groupByTags: boolean } }) =>
        useImportParser(props.data, props.format, props.options),
      {
        initialProps: {
          data: JSON.stringify(spec),
          format: "openapi" as const,
          options,
        },
      },
    )

    await waitFor(() => {
      expect(result.current.collection?.collection.name).toBe("Converted")
    })

    expect(spy).toHaveBeenCalledWith(spec, { groupByTags: false })
    spy.mockRestore()
  })
})

describe("useImportParser with Postman collections", () => {
  const postmanDoc = {
    info: {
      name: "API Suite",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name: "Ping",
        request: {
          method: "GET",
          url: {
            raw: "https://example.com/ping",
          },
        },
      },
    ],
  }

  it("auto-detects and converts Postman collections", async () => {
    const { result } = renderHook(() => useImportParser(JSON.stringify(postmanDoc), "auto", {}))

    await waitFor(() => {
      expect(result.current.detectedFormat).toBe("postman")
    })

    expect(result.current.collection?.collection.name).toBe("API Suite")
    expect(result.current.convertedData).toContain('"format": "native"')
  })
})
