/**
 * The shared **Range advisory** combinator: a warning, never an error, when one
 * numeric property leaves a plausible band. It owns presence, parse, NaN guard and
 * direction, so each rule is a table of threshold arms that reports through one
 * warning **Rule arm** (CONTEXT.md, "Range advisory").
 */

import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';
import { isValidProperties } from './linterUtils.js';
import { reportArm, type RuleArm } from './ruleArms.js';
import { parseGodotFloat } from './validators/commonValidators.js';

/** The rule arm a table reports through. ADR-0032 grounds a hint in the warning tier. */
export type WarningArm = RuleArm & { readonly severity: 'warning' };

interface ArmBase {
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
 * Report a **Diagnostic** through `arm` for every threshold arm the node's
 * properties trip. Returns `[]` when the node carries no valid properties. Skips
 * absent or non-numeric properties silently.
 */
export function rangeAdvisories(node: TscnNode, table: RangeAdvisoryTable, arm: WarningArm): Diagnostic[] {
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  const diagnostics: Diagnostic[] = [];
  for (const [property, ranges] of Object.entries(table)) {
    const raw = props[property];
    if (raw === undefined) continue;
    // `parseGodotFloat`, not `parseFloat`: `inf` is a value above every bound,
    // not an unreadable property. `nan` reads as NaN and trips nothing, since
    // every comparison against it is false.
    const value = parseGodotFloat(raw);
    if (value === null) continue;

    for (const range of ranges) {
      const tripped =
        'over' in range
          ? value > range.over
          : value < range.under && (range.floor === undefined || value > range.floor);
      if (tripped) reportArm(diagnostics, arm, node, range.message(value));
    }
  }
  return diagnostics;
}
