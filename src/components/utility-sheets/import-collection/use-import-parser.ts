import { useEffect, useState } from "react"

import yaml from "js-yaml"
import type { core } from "zod"

import type { ExportedCollection } from "@/types"
import {
  isOpenApiDocument,
  isPostmanCollection,
  openApiToNative,
  postmanToNative,
  validateNativeDocument,
  validatePostmanDocument,
  type OpenApiToNativeOptions,
} from "./parsers"
import type { ImportFormat } from "./types"

interface ParsingResult {
  collection: ExportedCollection | null
  issues: core.$ZodIssue[] | null
  detectedFormat: "native" | "openapi" | "postman" | null
  convertedData: string
}

const initialState: ParsingResult = {
  collection: null,
  issues: null,
  detectedFormat: null,
  convertedData: "",
}

const customIssue = (message: string): core.$ZodIssue => ({
  code: "custom",
  path: [],
  message,
})

export function useImportParser(
  importData: string,
  importFormat: ImportFormat,
  openApiOptions: OpenApiToNativeOptions = {},
) {
  const [parsingResult, setParsingResult] = useState<ParsingResult>(initialState)

  useEffect(() => {
    if (!importData.trim()) {
      setParsingResult(initialState)
      return
    }

    let parsedSource: unknown
    try {
      parsedSource = yaml.load(importData) as unknown
    } catch (_e) {
      setParsingResult({
        ...initialState,
        issues: [customIssue("Invalid JSON or YAML syntax.")],
      })
      return
    }

    const format: ImportFormat =
      importFormat === "auto"
        ? isPostmanCollection(parsedSource)
          ? "postman"
          : isOpenApiDocument(parsedSource)
            ? "openapi"
            : "native"
        : importFormat
    let nativeDoc: ExportedCollection | null = null
    let converted = ""

    if (format === "openapi") {
      if (isOpenApiDocument(parsedSource)) {
        nativeDoc = openApiToNative(parsedSource, openApiOptions)
        converted = JSON.stringify(nativeDoc, null, 2)
      } else {
        setParsingResult({
          ...initialState,
          detectedFormat: format,
          issues: [customIssue("File is not a valid OpenAPI v3 document.")],
        })
        return
      }
    } else if (format === "postman") {
      const validation = validatePostmanDocument(parsedSource)
      if (validation.success) {
        nativeDoc = postmanToNative(validation.data)
        converted = JSON.stringify(nativeDoc, null, 2)
      } else {
        setParsingResult({
          ...initialState,
          detectedFormat: format,
          issues: validation.error.issues,
        })
        return
      }
    } else {
      nativeDoc = parsedSource as ExportedCollection
    }

    if (nativeDoc) {
      const validation = validateNativeDocument(nativeDoc)
      if (validation.success) {
        setParsingResult({
          collection: validation.data,
          issues: null,
          detectedFormat: format,
          convertedData: converted,
        })
      } else {
        setParsingResult({
          collection: null,
          issues: validation.error.issues,
          detectedFormat: format,
          convertedData: converted,
        })
      }
    } else {
      setParsingResult(initialState)
    }
  }, [importData, importFormat, openApiOptions])

  return parsingResult
}
