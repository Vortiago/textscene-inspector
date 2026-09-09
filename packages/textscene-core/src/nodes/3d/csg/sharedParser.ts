/**
 * Shared tail of every CSG PRIMITIVE parser: the `CSGShape3D` half plus the
 * `material` path copy, which only a `CSGPrimitive3D` has. The shape half lives
 * in `shapeParser.ts`, which a combiner imports on its own — see the note there.
 *
 * Pure TS, so the parser closure stays React-free; the render scaffold lives
 * separately in CsgPrimitive.tsx.
 */

import { finishCsgShapeParse } from './shapeParser';

export { finishCsgShapeParse };

/** `finishCsgShapeParse` plus `material` (a path string), which only a `CSGPrimitive3D` has. */
export function finishCsgParse(
  result: { materialPath?: string; operation?: number; castShadow?: number },
  properties: Record<string, string>
): void {
  if (properties.material) {
    result.materialPath = properties.material;
  }

  finishCsgShapeParse(result, properties);
}
