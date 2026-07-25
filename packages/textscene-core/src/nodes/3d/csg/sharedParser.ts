/**
 * Shared tail of every CSG primitive parser: the `material` copy plus `operation`.
 *
 * Pure TS, so the parser closure stays React-free; the render scaffold lives separately
 * in CsgPrimitive.tsx.
 */

import { parseOptionalInt } from '../../../parser/valueParsers';

/**
 * Copy `material` and `operation` onto a CSG parse result.
 *
 * A non-union `operation` used to warn here, because it was parsed and then dropped. It
 * is applied now (ADR-0026), so the warn would fire on every correctly rendered
 * subtraction: 33 times on scenes/demos/3d/csg/csg.tscn alone, burying real problems.
 *
 * `nodeType` and `primitiveNoun` are kept in the signature because every call site reads
 * as documentation of which slice is delegating here, and the degradation paths in
 * CsgRootMesh report by node path when a boolean genuinely fails.
 */
export function finishCsgParse(
  result: { material?: string; operation?: number },
  properties: Record<string, string>,
  _nodeType: string,
  _primitiveNoun: string
): void {
  if (properties.material) {
    result.material = properties.material;
  }

  const operation = parseOptionalInt(properties.operation);
  if (operation !== undefined) {
    result.operation = operation;
  }
}
