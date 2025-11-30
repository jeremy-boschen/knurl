import type {
  CollectionTreeSlice,
  CollectionsSlice,
  CredentialsCacheSlice,
  DialogsSlice,
  RequestTabsSlice,
  SettingsSlice,
  SidebarSlice,
  UtilitySheetsSlice,
} from "@/types"

export type Application = CollectionsSlice &
  RequestTabsSlice &
  SidebarSlice &
  SettingsSlice &
  CredentialsCacheSlice &
  UtilitySheetsSlice &
  DialogsSlice &
  CollectionTreeSlice
