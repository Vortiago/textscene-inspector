/**
 * The `CSGShape3D` half of every CSG parse, `operation`, shared by CSGCombiner3D and the
 * primitives, whose render scaffold is CsgPrimitive.tsx. A React-free module of its own, not
 * beside `finishCsgParse`: the parity guard scrapes property reads per file, and would credit a
 * combiner, not a CSGPrimitive3D (`csg_shape.h:194-202`), with `material`.
 */

import { parseOptionalInt } from '../../../parser/valueParsers';
import type { CSGShapeFields } from './types';

/**
 * Copy every `CSGShape3D` property onto a CSG parse result, so a type without `material` takes
 * all of it and nothing else. A non-union `operation` does not warn: it is applied (ADR-0027), so
 * a warning would fire on every correctly rendered subtraction.
 */
export function finishCsgShapeParse(result: CSGShapeFields, properties: Record<string, string>): void {
  const operation = parseOptionalInt(properties.operation);
  if (operation !== undefined) {
    result.operation = operation;
  }
}
