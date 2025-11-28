import { closestCenter, type CollisionDetection, pointerWithin, rectIntersection } from "@dnd-kit/core"

/**
 * Creates a custom collision detection strategy for the collection tree DnD.
 * Prioritizes pointer detection, then rect intersection, then closest center.
 */
export function createCollisionDetectionStrategy(): CollisionDetection {
  return (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }

    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length > 0) {
      return rectCollisions
    }

    return closestCenter(args)
  }
}
