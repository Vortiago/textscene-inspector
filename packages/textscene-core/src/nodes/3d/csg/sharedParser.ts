/**
 * Shared tail of every CSG parser: the `CSGShape3D` half (`operation`,
 * `cast_shadow`) and, for the primitives only, the `material` path copy.
 *
 * Pure TS, so the parser closure stays React-free; the render scaffold lives separately
 * in CsgPrimitive.tsx.
 */

import { parseOptionalInt } from '../../../parser/valueParsers';

/**
 * Copy every `CSGShape3D` property onto a CSG parse result — the half a
 * CSGCombiner3D shares with the primitives, split out so a type without
 * `material` can take all of it and nothing else, instead of re-reading these
 * properties and silently dropping whichever one is added here next.
 *
 * A non-union `operation` used to warn here, because it was parsed and then dropped. It
 * is applied now (ADR-0027), so the warn would fire on every correctly rendered
 * subtraction, burying real problems in a scene that uses booleans at all.
 */
export function finishCsgShapeParse(
  result: { operation?: number; castShadow?: number },
  properties: Record<string, string>
): void {
  const operation = parseOptionalInt(properties.operation);
  if (operation !== undefined) {
    result.operation = operation;
  }

  // `CSGShape3D : GeometryInstance3D` (`modules/csg/csg_shape.h:47`).
  const castShadow = parseOptionalInt(properties.cast_shadow);
  if (castShadow !== undefined) {
    result.castShadow = castShadow;
  }
}

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
