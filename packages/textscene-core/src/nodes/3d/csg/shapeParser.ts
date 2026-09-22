/**
 * The `CSGShape3D` half of every CSG parse — `operation` and `cast_shadow`, the
 * properties a CSGCombiner3D shares with the primitives.
 *
 * Its own module, not a second export beside `finishCsgParse`: the parity guard
 * scrapes a parser's property reads FILE by file and follows every helper it
 * hands the property bag to, so a combiner importing from a file that also reads
 * the material slot would be credited with a key its type does not have
 * (`csg_shape.h:194-202` — a combiner is a CSGShape3D, not a CSGPrimitive3D).
 *
 * Pure TS, so the parser closure stays React-free; the render scaffold lives
 * separately in CsgPrimitive.tsx.
 */

import { parseOptionalInt } from '../../../parser/valueParsers';

/**
 * Copy every `CSGShape3D` property onto a CSG parse result — split out so a type
 * without `material` can take all of it and nothing else, instead of re-reading
 * these properties and silently dropping whichever one is added here next.
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
