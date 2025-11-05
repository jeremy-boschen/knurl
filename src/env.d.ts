/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_VALIDATE_COLLECTION_INDEX?: string
  // add your VITE_* vars here
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
