import { createStore } from "zustand"

import { type Application, createRootSlice } from "@/state/application"

export const createTestStore = () => {
  return createStore<Application>()((...a) => ({
    ...createRootSlice(...a),
  }))
}
