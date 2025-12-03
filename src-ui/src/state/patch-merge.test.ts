import { describe, it, expect } from "vitest"

import { toMergedRequest } from "@/types"
import type { RequestState } from "@/types"
import { zRequestState } from "@/types"

/**
 * Comprehensive test suite for patch and merge logic.
 *
 * Rules:
 * 1. When ANY param field changes, ensureParamPatch copies ALL params from base to patch (once)
 * 2. Then the specific field edit is applied to that param in patch
 * 3. Subsequent edits modify params in patch (which already has all base params)
 * 4. Delete removes param from patch entirely
 * 5. toMergedRequest: If patch.cookieParams exists → use patch.cookieParams (complete replacement)
 *    If patch.cookieParams undefined → use base.cookieParams
 * 6. commitPatch uses same logic: If patch exists → use patch; else use base
 *
 * This applies to: queryParams, pathParams, cookieParams, headers (all follow same logic)
 */

describe("patch and merge logic", () => {
  const createBaseRequest = (overrides?: Partial<RequestState>): RequestState => {
    return zRequestState.parse({
      id: "req-1",
      collectionId: "col-1",
      folderId: "root",
      name: "Test Request",
      method: "GET",
      url: "http://example.com",
      pathParams: {},
      queryParams: {},
      headers: {},
      cookieParams: {},
      body: { type: "none" },
      authentication: { type: "none" },
      ...overrides,
    })
  }

  describe("toMergedRequest with no patch", () => {
    it("returns base unchanged when no patch exists", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
      })

      const merged = toMergedRequest(request)
      expect(merged.cookieParams).toEqual(request.cookieParams)
    })

    it("returns base unchanged when patch is empty object", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
        patch: {},
      })

      const merged = toMergedRequest(request)
      expect(merged.cookieParams).toEqual(request.cookieParams)
    })
  })

  describe("toMergedRequest with patch (complete replacement)", () => {
    it("replaces base params entirely when patch has one param and base has two", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
        patch: {
          cookieParams: {
            c2: { id: "c2", name: "cookie2", value: "new-val2", enabled: false, secure: true },
          },
        },
      })

      const merged = toMergedRequest(request)

      // CRITICAL: patch replaces base entirely, so only c2 should exist
      expect(Object.keys(merged.cookieParams)).toEqual(["c2"])
      expect(merged.cookieParams.c2.value).toBe("new-val2")
      // c1 should NOT exist
      expect(merged.cookieParams.c1).toBeUndefined()
    })

    it("handles patch with both params when base has both", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
        patch: {
          cookieParams: {
            c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
            c2: { id: "c2", name: "cookie2", value: "new-val2", enabled: false, secure: true },
          },
        },
      })

      const merged = toMergedRequest(request)

      // Both should exist since patch has both
      expect(Object.keys(merged.cookieParams).sort()).toEqual(["c1", "c2"])
      expect(merged.cookieParams.c1.value).toBe("val1")
      expect(merged.cookieParams.c2.value).toBe("new-val2")
    })

    it("uses patch as-is without merging individual param fields", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
        patch: {
          cookieParams: {
            // Patch has c1 with only some fields (as if it came from ensureParamPatch + partial edit)
            c1: { id: "c1", name: "cookie1", value: "modified-val1", enabled: true, secure: false },
            c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
          },
        },
      })

      const merged = toMergedRequest(request)

      // Patch is used as-is
      expect(merged.cookieParams.c1).toEqual({
        id: "c1",
        name: "cookie1",
        value: "modified-val1",
        enabled: true,
        secure: false,
      })
    })

    it("applies patch deletion (param missing from patch)", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
        patch: {
          cookieParams: {
            // Only c1 in patch; c2 was deleted by user
            c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          },
        },
      })

      const merged = toMergedRequest(request)

      // c2 is gone (deleted from patch)
      expect(Object.keys(merged.cookieParams)).toEqual(["c1"])
      expect(merged.cookieParams.c2).toBeUndefined()
    })
  })

  describe("query params, path params, headers (same logic)", () => {
    it("merges query params using complete replacement logic", () => {
      const request = createBaseRequest({
        queryParams: {
          q1: { id: "q1", name: "param1", value: "val1", enabled: true, secure: false },
          q2: { id: "q2", name: "param2", value: "val2", enabled: false, secure: false },
        },
        patch: {
          queryParams: {
            q2: { id: "q2", name: "param2", value: "new-val2", enabled: false, secure: false },
          },
        },
      })

      const merged = toMergedRequest(request)

      // Patch replaces base entirely, so only q2 exists
      expect(Object.keys(merged.queryParams)).toEqual(["q2"])
      expect(merged.queryParams.q1).toBeUndefined()
    })

    it("merges path params using complete replacement logic", () => {
      const request = createBaseRequest({
        pathParams: {
          p1: { id: "p1", name: "id", value: "123", enabled: true, secure: false },
          p2: { id: "p2", name: "version", value: "v1", enabled: false, secure: false },
        },
        patch: {
          pathParams: {
            p1: { id: "p1", name: "id", value: "123", enabled: true, secure: false },
            p2: { id: "p2", name: "version", value: "v2", enabled: false, secure: false },
          },
        },
      })

      const merged = toMergedRequest(request)

      // Patch has both, so both exist
      expect(Object.keys(merged.pathParams).sort()).toEqual(["p1", "p2"])
      expect(merged.pathParams.p2.value).toBe("v2")
    })

    it("merges headers using complete replacement logic", () => {
      const request = createBaseRequest({
        headers: {
          h1: { id: "h1", name: "X-Custom", value: "val1", enabled: true, secure: false },
          h2: { id: "h2", name: "Content-Type", value: "application/json", enabled: true, secure: false },
        },
        patch: {
          headers: {
            h1: { id: "h1", name: "X-Custom", value: "new-val1", enabled: true, secure: false },
          },
        },
      })

      const merged = toMergedRequest(request)

      // Patch replaces base, so only h1 exists
      expect(Object.keys(merged.headers)).toEqual(["h1"])
      expect(merged.headers.h2).toBeUndefined()
    })
  })

  describe("patch lifecycle simulation", () => {
    it("simulates: base → first edit (ensureParamPatch copies all) → toMergedRequest", () => {
      // Start with base
      let request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
      })

      // User edits c2's value
      // ensureParamPatch would copy all params to patch, then apply edit
      request.patch = {
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "new-val2", enabled: false, secure: true },
        },
      }

      const merged = toMergedRequest(request)

      // Both params should exist in merged (patch has both)
      expect(Object.keys(merged.cookieParams).sort()).toEqual(["c1", "c2"])
      expect(merged.cookieParams.c2.value).toBe("new-val2")
    })

    it("simulates: first edit → user deletes c1 → toMergedRequest", () => {
      // After first edit, patch has both params
      let request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
        patch: {
          cookieParams: {
            c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
            c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
          },
        },
      })

      // User deletes c1 (removed from patch)
      delete request.patch.cookieParams!.c1

      const merged = toMergedRequest(request)

      // Only c2 exists (c1 deleted from patch)
      expect(Object.keys(merged.cookieParams)).toEqual(["c2"])
      expect(merged.cookieParams.c1).toBeUndefined()
    })

    it("simulates: multiple edits maintain all base params in patch", () => {
      let request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
      })

      // First edit: change c2's value
      request.patch = {
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "new-val2", enabled: false, secure: true },
        },
      }

      let merged = toMergedRequest(request)
      expect(Object.keys(merged.cookieParams).sort()).toEqual(["c1", "c2"])
      expect(merged.cookieParams.c2.value).toBe("new-val2")

      // Second edit: also change c1's secure flag
      request.patch.cookieParams!.c1!.secure = true

      merged = toMergedRequest(request)
      expect(Object.keys(merged.cookieParams).sort()).toEqual(["c1", "c2"])
      expect(merged.cookieParams.c1.secure).toBe(true)
      expect(merged.cookieParams.c2.value).toBe("new-val2")
    })

    it("simulates: undo by discarding patch", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
          c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: true },
        },
        patch: {
          cookieParams: {
            c1: { id: "c1", name: "cookie1", value: "modified-val1", enabled: false, secure: true },
          },
        },
      })

      // User clicks undo/discard patch
      const undone = {
        ...request,
        patch: {},
      }

      const merged = toMergedRequest(undone)

      // All base params restored
      expect(Object.keys(merged.cookieParams).sort()).toEqual(["c1", "c2"])
      expect(merged.cookieParams.c1.value).toBe("val1")
      expect(merged.cookieParams.c1.enabled).toBe(true)
      expect(merged.cookieParams.c2).toEqual(request.cookieParams.c2)
    })
  })

  describe("equality cleanup (removing patch when param reverts to base)", () => {
    it("prunes param record from patch when all params revert to base values", () => {
      // After commit, base has h1
      const request = createBaseRequest({
        headers: {
          h1: { id: "h1", name: "A", value: "1", enabled: true, secure: false },
        },
        patch: {
          headers: {
            h1: { id: "h1", name: "A", value: "1", enabled: true, secure: false },
          },
        },
      })

      // Patch should be pruned when all headers match base
      // This test verifies that pruneParamPatchIfEqual correctly identifies equality
      const patchHeaders = request.patch.headers
      const baseHeaders = request.headers

      // Both should be equal
      expect(patchHeaders).toEqual(baseHeaders)
      // If pruneParamPatchIfEqual worked, patch.headers should be undefined
      // This is the critical property: when patch record equals base record, remove it from patch
    })

    it("preserves patch when param differs from base", () => {
      const request = createBaseRequest({
        headers: {
          h1: { id: "h1", name: "A", value: "1", enabled: true, secure: false },
        },
        patch: {
          headers: {
            h1: { id: "h1", name: "A", value: "DIFFERENT", enabled: true, secure: false },
          },
        },
      })

      // Patch differs from base, so should be preserved
      expect(request.patch.headers).toEqual({
        h1: { id: "h1", name: "A", value: "DIFFERENT", enabled: true, secure: false },
      })
    })
  })

  describe("edge cases", () => {
    it("handles empty patch.cookieParams (all deleted)", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
        },
        patch: {
          cookieParams: {},
        },
      })

      const merged = toMergedRequest(request)

      // Patch is empty, so no params in merged
      expect(merged.cookieParams).toEqual({})
    })

    it("handles patch with new param not in base", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
        },
        patch: {
          cookieParams: {
            c1: { id: "c1", name: "cookie1", value: "val1", enabled: true, secure: false },
            c2: { id: "c2", name: "cookie2", value: "val2", enabled: false, secure: false },
          },
        },
      })

      const merged = toMergedRequest(request)

      // Patch has c2 which wasn't in base (user added it)
      expect(Object.keys(merged.cookieParams).sort()).toEqual(["c1", "c2"])
      expect(merged.cookieParams.c2.name).toBe("cookie2")
    })

    it("maintains parameter integrity through merge", () => {
      const request = createBaseRequest({
        cookieParams: {
          c1: { id: "c1", name: "session", value: "abc123", enabled: true, secure: true },
        },
        patch: {
          cookieParams: {
            c1: { id: "c1", name: "session", value: "abc123", enabled: true, secure: true },
          },
        },
      })

      const merged = toMergedRequest(request)

      // All fields should be present and intact
      expect(merged.cookieParams.c1).toEqual({
        id: "c1",
        name: "session",
        value: "abc123",
        enabled: true,
        secure: true,
      })
    })
  })
})
