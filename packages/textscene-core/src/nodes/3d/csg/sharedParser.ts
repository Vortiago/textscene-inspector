/**
 * Shared tail of every CSG primitive parser: the `material` path copy plus `operation`.
 *
 * Pure TS, so the parser closure stays React-free; the render scaffold lives separately
 * in CsgPrimitive.tsx.
 */

import { parseOptionalInt } from '../../../parser/valueParsers';

/**
 * Copy `material` (a path string), `operation` and `cast_shadow` onto a CSG parse result.
 *
 * A non-union `operation` used to warn here, because it was parsed and then dropped. It
 * is applied now (ADR-0027), so the warn would fire on every correctly rendered
 * subtraction, burying real problems in a scene that uses booleans at all.
 *
 */
export function finishCsgParse(
  result: { materialPath?: string; operation?: number; castShadow?: number },
  properties: Record<string, string>
): void {
  if (properties.material) {
    result.materialPath = properties.material;
  }

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
