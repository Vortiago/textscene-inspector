/**
 * The shared **Range advisory** combinator: warns when a single numeric property
 * falls outside a plausible `[low, high]` band. It owns the mechanics every
 * threshold check used to hand-repeat — presence check, `parseFloat`, NaN guard,
 * and the direction comparison — so each rule is a declarative table of **arms**
 * rather than branching code.
 *
 * A range advisory is ALWAYS a warning: an out-of-band value is suspicious, never
 * objectively invalid. Error-severity checks (a zero/negative `zoom`) and
 * cross-field consistency checks (`limit_right` below `limit_left`) are a
 * different family and stay hand-written — see CONTEXT.md, "Range advisory".
 */

import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';
import { isValidProperties } from './linterUtils.js';

interface ArmBase {
  /** Rule name carried on the emitted diagnostic (may be shared across a property's arms). */
  ruleName: string;
  /** Build the warning message from the parsed numeric value. */
  message: (value: number) => string;
  /**
   * `file:line` in the Godot source that states this threshold — the
   * `ADD_PROPERTY`'s `PROPERTY_HINT_RANGE`, since an arm is always a warning and
   * ADR-0032 grounds warnings in the inspector hint.
   *
   * Required, and checked by `rangeAdvisoryGrounding.test.ts`. An arm is a
   * value-based diagnostic exactly like a validator bound, but it lived outside
   * `boundGrounding`'s sweep entirely, so a threshold could be invented here
   * while the bound ratchet read zero. Class-reference prose is not a citation:
   * "try a value between 0.1 and 0.3" is advice to a level designer, not a
   * statement about what the engine accepts.
   */
  cite: string;
}

/** Warn when the parsed value is strictly greater than `over`. */
type OverArm = ArmBase & { over: number };

/**
 * Warn when the parsed value is strictly less than `under`. An optional `floor`
 * suppresses the warning at/below that value (e.g. a "very small angle" advisory
 * that should ignore a non-positive angle: `{ under: 1, floor: 0 }`).
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
    const value = parseFloat(raw);
    if (Number.isNaN(value)) continue;

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
