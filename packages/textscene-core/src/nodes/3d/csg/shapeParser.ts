/**
 * The `CSGShape3D` half of every CSG parse: `operation` and `cast_shadow`, the properties a
 * CSGCombiner3D shares with the primitives. Pure TS, so the parser closure stays React-free, and
 * the render scaffold lives in CsgPrimitive.tsx.
 */

// Its own module, not an export beside `finishCsgParse`: the parity guard scrapes property reads
// file by file, so a combiner importing from a file that reads the material slot would be credited
// with a key its type lacks (`csg_shape.h:194-202`: a combiner is not a CSGPrimitive3D).

import { parseOptionalInt } from '../../../parser/valueParsers';

/**
 * Copy every `CSGShape3D` property onto a CSG parse result, so a type without `material` takes
 * all of it and nothing else. A non-union `operation` does not warn: it is applied (ADR-0027), so
 * a warning would fire on every correctly rendered subtraction.
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
