import { describe, it, expect } from "vitest"
import { naturalSort } from "./sort-utils"
import { normalizeCollection } from "@/state/collections-lib"
import type { Collection } from "@/types"
import fs from "fs"
import path from "path"

// Load the fixture manually since it's in the root test/fixtures directory
const fixtureContent = fs.readFileSync(
  path.resolve(process.cwd(), "test/fixtures/test-collection-real-z0JSA3Hj26ph.json"),
  "utf-8"
)
const testCollectionFile = JSON.parse(fixtureContent)

describe("Real collection sorting - z0JSA3Hj26ph", () => {
  it("correctly sorts requests in root folder using natural sort", () => {
    const fixture = testCollectionFile as unknown as { content: Collection; header: unknown }
    const collection = fixture.content

    console.log("\n=== BEFORE NORMALIZATION ===")
    const rootBefore = collection.folders["root"]
    const namesBefore = rootBefore.requestIds
      .map((id) => collection.requests[id]?.name)
      .filter((name) => name !== undefined)
    console.log("Root folder request order:", namesBefore)

    // Now normalize (this should apply natural sort)
    const normalized = normalizeCollection(collection)

    console.log("\n=== AFTER NORMALIZATION ===")
    const rootAfter = normalized.folders["root"]
    const namesAfter = rootAfter.requestIds
      .map((id) => normalized.requests[id]?.name)
      .filter((name) => name !== undefined)
    console.log("Root folder request order:", namesAfter)

    // Root folder only has r3, r4, r5 in this fixture (r2 and Untitled are in other folders)
    // Just verify they're in natural sort order
    const expected = ["r3", "r4", "r5"]
    expect(namesAfter).toEqual(expected)
  })

  it("sorts requests correctly in f1 folder (which has Untitled Requests)", () => {
    const fixture = testCollectionFile as unknown as { content: Collection; header: unknown }
    const collection = fixture.content

    const normalized = normalizeCollection(collection)

    // f1 folder has ID XlzjBA930SH8
    const f1Folder = normalized.folders["XlzjBA930SH8"]
    const namesInF1 = f1Folder.requestIds
      .map((id) => normalized.requests[id]?.name)
      .filter((name) => name !== undefined)

    console.log("\nf1 folder request order:", namesInF1)

    // Should have requests sorted: r1 should come before Untitled Request
    // The folder has: Untitled Request, Untitled Request, r1
    // After sorting should be: r1, Untitled Request, Untitled Request
    expect(namesInF1[0]).toBe("r1")
    expect(namesInF1[1]).toBe("Untitled Request")
    expect(namesInF1[2]).toBe("Untitled Request")
  })

  it("never puts Untitled Request at the top when other requests exist", () => {
    const fixture = testCollectionFile as unknown as { content: Collection; header: unknown }
    const collection = fixture.content

    const normalized = normalizeCollection(collection)

    // Check all folders
    for (const [folderId, folder] of Object.entries(normalized.folders)) {
      const names = folder.requestIds
        .map((id) => normalized.requests[id]?.name)
        .filter((name) => name !== undefined)

      if (names.length > 1) {
        // If there are multiple requests, "Untitled Request" should NOT be first
        if (names.includes("Untitled Request")) {
          const untitledIndex = names.indexOf("Untitled Request")
          const hasOtherRequests = names.some(
            (name) => name !== "Untitled Request" && name !== ""
          )

          if (hasOtherRequests) {
            // Check that "Untitled Request" comes after other requests alphabetically
            const otherRequests = names.filter((name) => name !== "Untitled Request" && name !== "")
            for (const other of otherRequests) {
              const comparison = naturalSort(other, "Untitled Request")
              expect(
                comparison,
                `In folder ${folderId}: "${other}" should come before "Untitled Request" (comparison=${comparison})`
              ).toBeLessThan(0)
            }
          }
        }
      }

      console.log(`Folder ${folderId} (${folder.name}):`, names)
    }
  })
})
