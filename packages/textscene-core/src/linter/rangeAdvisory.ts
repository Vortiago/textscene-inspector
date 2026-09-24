/**
 * The shared **Range advisory** combinator: a warning, never an error, when one
 * numeric property leaves a plausible band. It owns presence, parse, NaN guard and
 * direction, so each rule is a table of **arms**. Error and cross-field checks stay
 * hand-written (CONTEXT.md, "Range advisory").
 */

import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';
import { isValidProperties } from './linterUtils.js';
import { parseGodotFloat } from './validators/commonValidators.js';

interface ArmBase {
  /** Rule name carried on the emitted diagnostic (may be shared across a property's arms). */
  ruleName: string;
  /** Build the warning message from the parsed numeric value. */
  message: (value: number) => string;
  /**
   * `file:line` of the `ADD_PROPERTY`'s `PROPERTY_HINT_RANGE`, since ADR-0032
   * grounds a warning in the inspector hint. `rangeAdvisoryGrounding.test.ts`
   * checks it, as `boundGrounding` checks a validator bound. Class-reference
   * prose is advice to a designer, not a citation.
   */
  cite: string;
}

/** Warn when the parsed value is strictly greater than `over`. */
type OverArm = ArmBase & { over: number };

/**
 * Warn when the parsed value is strictly less than `under`. An optional `floor`
 * suppresses the warning at or below that value, such as a "very small angle"
 * advisory that ignores a non-positive angle: `{ under: 1, floor: 0 }`.
 */
type UnderArm = ArmBase & { under: number; floor?: number };

/** One threshold of a property's range advisory: a too-high or too-low bound. */
export type RangeArm = OverArm | UnderArm;

/** Per-property arms: `{ property: [arm, ...] }`. One arm per direction. */
export type RangeAdvisoryTable = Record<string, RangeArm[]>;

/**
 * Emit a `'warning'` **Diagnostic** for every arm the node's properties trip.
 * Returns `[]` when the node carries no valid properties; skips absent or
 * non-numeric properties silently.
 */
export function rangeAdvisories(node: TscnNode, table: RangeAdvisoryTable): Diagnostic[] {
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  const diagnostics: Diagnostic[] = [];
  for (const [property, arms] of Object.entries(table)) {
    const raw = props[property];
    if (raw === undefined) continue;
    // `parseGodotFloat`, not `parseFloat`: `inf` is a value above every bound,
    // not an unreadable property. `nan` reads as NaN and trips nothing, since
    // every comparison against it is false.
    const value = parseGodotFloat(raw);
    if (value === null) continue;

    for (const arm of arms) {
      const tripped =
        'over' in arm
          ? value > arm.over
          : value < arm.under && (arm.floor === undefined || value > arm.floor);
      if (tripped) {
        diagnostics.push({
          severity: 'warning',
          message: arm.message(value),
          nodeName: node.name,
          nodeType: node.type,
          ruleName: arm.ruleName,
        });
      }
    }
  }
  return diagnostics;
}
