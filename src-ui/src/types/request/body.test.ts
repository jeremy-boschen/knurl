import { describe, expect, it } from "vitest"

import { detectRequestBodyGrammar, zFormField, zRequestBodyData } from "./body"

describe("request body schemas", () => {
  it("applies defaults for form fields", () => {
    const field = zFormField.parse({ id: "f1" })
    expect(field).toMatchObject({ key: "", value: "", enabled: true, secure: false, kind: "text" })
  })

  it("uses defaults for request body data", () => {
    const data = zRequestBodyData.parse({})
    expect(data.type).toBe("none")
  })
})

describe("detectRequestBodyGrammar", () => {
  it("detects json bodies", () => {
    expect(detectRequestBodyGrammar('{"ok":true}')).toBe("json")
  })

  it("detects xml and graphql bodies", () => {
    expect(detectRequestBodyGrammar("<?xml version='1.0'?><note></note>")).toBe("xml")
    expect(detectRequestBodyGrammar("mutation create { id }" )).toBe("graphql")
  })

  it("falls back to text when unknown", () => {
    expect(detectRequestBodyGrammar(" ")).toBeUndefined()
    expect(detectRequestBodyGrammar("plain body" )).toBe("text")
  })
})
