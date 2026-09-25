/**
 * Shared tail of every CSG primitive parser: the `CSGShape3D` half plus the `material` path copy,
 * which only a `CSGPrimitive3D` has. A combiner imports the shape half from `shapeParser.ts` on
 * its own. Pure TS, so the parser closure stays React-free.
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
