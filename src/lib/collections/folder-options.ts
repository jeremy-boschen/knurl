import type { CollectionCache } from "@/types"
import { RootCollectionFolderId } from "@/types"

export type FolderOption = {
  id: string
  path: string
  depth: number
}

export function buildFolderOptions(collection: CollectionCache): FolderOption[] {
  const result: FolderOption[] = []

  const traverse = (folderId: string, ancestry: string[]) => {
    const node = collection.folders[folderId]
    if (!node) {
      return
    }
    const label = folderId === RootCollectionFolderId ? "Root" : node.name
    const pathSegments = [...ancestry, label]
    result.push({ id: folderId, path: pathSegments.join(" / "), depth: pathSegments.length - 1 })
    for (const childId of node.childFolderIds) {
      traverse(childId, [...ancestry, label])
    }
  }

  traverse(RootCollectionFolderId, [])
  return result
}
