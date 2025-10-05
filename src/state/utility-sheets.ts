import type { StateCreator } from "zustand"

import { generateUniqueId } from "@/lib/utils"
import type {
  ApplicationState,
  UtilitySheet,
  UtilitySheetInput,
  UtilitySheetsState,
  UtilitySheetsStateApi,
  UtilitySheetsStateSlice,
} from "@/types"
import { zUtilitySheet } from "@/types"

function toInput(sheet: UtilitySheet): UtilitySheetInput {
  const { id: _id, ...rest } = sheet
  return rest
}

export const utilitySheetsSliceCreator: StateCreator<
  ApplicationState,
  [["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  UtilitySheetsStateSlice
> = (set, get, _storeApi) => {
  const popStack = (state: UtilitySheetsState) => {
    if (state.stack.length === 0) {
      state.lastDismissed = null
      return null
    }

    const removed = state.stack.pop() ?? null
    state.lastDismissed = removed
    return removed
  }

  const getActive = (state: UtilitySheetsState) => {
    return state.stack.length > 0 ? state.stack[state.stack.length - 1] : null
  }

  const utilitySheetsApi: UtilitySheetsStateApi = {
    openSheet(sheetInput: UtilitySheetInput) {
      const parsed = zUtilitySheet.parse(sheetInput)
      const next: UtilitySheet = {
        ...parsed,
        id: generateUniqueId(),
      }

      set((app) => {
        app.utilitySheetsState.stack.push(next)
        app.utilitySheetsState.lastDismissed = null
      })
    },

    closeSheet() {
      set((app) => {
        popStack(app.utilitySheetsState)
      })
    },

    popSheet() {
      set((app) => {
        popStack(app.utilitySheetsState)
      })
    },

    reopenLastSheet() {
      const { lastDismissed } = get().utilitySheetsState
      if (!lastDismissed) {
        return
      }
      utilitySheetsApi.openSheet(toInput(lastDismissed))
    },

    getActiveSheet() {
      return getActive(get().utilitySheetsState)
    },

    getStack() {
      return [...get().utilitySheetsState.stack]
    },
  }

  return {
    utilitySheetsState: {
      stack: [],
      lastDismissed: null,
    },
    utilitySheetsApi,
  }
}
