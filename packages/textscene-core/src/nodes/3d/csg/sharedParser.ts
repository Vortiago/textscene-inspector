/**
 * Shared tail of every CSG primitive parser: the `material` copy plus the
 * parsed-but-ignored `operation` (ADR-0004 warn). Pure TS — the render
 * scaffold lives separately in CsgPrimitive.tsx so the parser closure stays
 * React-free.
 */

import { warn } from '../../../logger';
import { parseOptionalInt } from '../../../parser/valueParsers';

/**
 * Copy `material` and `operation` onto a CSG parse result. `primitiveNoun`
 * names the base shape in the warn text (e.g. 'box'), so a subtraction that
 * renders "wrong" (a hole shows as a solid) isn't silent.
 */
export function finishCsgParse(
  result: { material?: string; operation?: number },
  properties: Record<string, string>,
  nodeType: string,
  primitiveNoun: string
): void {
  if (properties.material) {
    result.material = properties.material;
  }

  const operation = parseOptionalInt(properties.operation);
  if (operation !== undefined) {
    result.operation = operation;
    if (operation !== 0) {
      warn(
        `[${nodeType}] operation=${operation} (non-union) is ignored — ` +
          `rendering the base ${primitiveNoun} primitive (ADR-0004).`
      );
    }
  }
}
