export type ActiveMenuItem =
  | {
      kind: "collection"
      collectionId: string
      name: string
    }
  | {
      kind: "folder"
      collectionId: string
      folderId: string
      name: string
    }
  | {
      kind: "request"
      collectionId: string
      requestId: string
      name: string
    }
  | null
