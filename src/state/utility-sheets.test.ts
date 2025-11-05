import {beforeEach, describe, expect, it} from "vitest"
import {useApplication} from "@/state/application"
import {resetApplicationStore} from "@/test/zustand"

const settingsSheet = {type: "settings"} as const
const importSheet = {type: "import"} as const

describe("utility sheets slice", () => {
  beforeEach(() => {
    resetApplicationStore()
  })

  it("pushes, closes, and reopens sheets", () => {
    const {utilitySheetsApi} = useApplication.getState()

    utilitySheetsApi.openSheet(settingsSheet)
    expect(utilitySheetsApi.getStack()).toHaveLength(1)
    expect(utilitySheetsApi.getActiveSheet()?.type).toBe("settings")

    utilitySheetsApi.openSheet(importSheet)
    expect(utilitySheetsApi.getStack()).toHaveLength(2)
    const dismissedBeforeClose = useApplication.getState().utilitySheetsState.lastDismissed
    expect(dismissedBeforeClose).toBeNull()

    utilitySheetsApi.closeSheet()
    expect(utilitySheetsApi.getStack()).toHaveLength(1)
    expect(useApplication.getState().utilitySheetsState.lastDismissed?.type).toBe("import")

    utilitySheetsApi.reopenLastSheet()
    expect(utilitySheetsApi.getStack()).toHaveLength(2)
    expect(utilitySheetsApi.getActiveSheet()?.type).toBe("import")

    utilitySheetsApi.popSheet()
    expect(utilitySheetsApi.getStack()).toHaveLength(1)
  })

  it("gracefully ignores reopen when nothing dismissed", () => {
    const {utilitySheetsApi} = useApplication.getState()
    utilitySheetsApi.reopenLastSheet()
    expect(utilitySheetsApi.getStack()).toHaveLength(0)
    expect(useApplication.getState().utilitySheetsState.lastDismissed).toBeNull()
  })

  it("closeSheet on empty stack keeps state clean", () => {
    const {utilitySheetsApi} = useApplication.getState()
    utilitySheetsApi.closeSheet()
    expect(utilitySheetsApi.getStack()).toHaveLength(0)
    expect(useApplication.getState().utilitySheetsState.lastDismissed).toBeNull()
  })
})
