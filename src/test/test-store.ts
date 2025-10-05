import { createStore } from "zustand"

import { createRootSlice, type ApplicationState } from "@/state/application"

export const createTestStore = () => {
  return createStore<ApplicationState>()((...a) => ({
    ...createRootSlice(...a),
  }))
}
