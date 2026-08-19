/**
 * One reported diagnostic, declared once.
 *
 * A dimension- or kind-parameterized factory used to spell each arm's enabling
 * condition TWICE — around the `push` in `check`, and again around the spread
 * in `emits`. No guard can see those two disagree: the emits cross-checks match
 * an interpolated `${prefix}-concave-shape` as a wildcard, so a name a SIBLING
 * instance still declares satisfies them. `ShapeCast2D` could emit
 * `shapecast2d-concave-shape` while its own `emits` omitted it and all 24
 * assertions stayed green, measured.
 *
 * So the arm is declared once and both halves are derived from it. The gate is
 * whether the arm EXISTS for this instance, which is a single expression, and
 * an instance whose `check` reports a name its `emits` omits is unrepresentable
 * rather than merely unlikely.
 *
 * Arms are held in a record whose values may be absent, not an array: `check`
 * keeps its own control flow — an else-if chain over one resolved resource is
 * not a list of independent predicates — and names the arm it is reporting.
 */

import type { Diagnostic, EmitGrounding, RuleMeta, Severity } from './types.js';
import type { TscnNode } from '../parser/types.js';

/**
 * `severity` first, deliberately: `emitsScrape` pairs the two by source order,
 * so the reverse spelling silently mispairs (see `RuleMeta.emits`).
 */
export interface RuleArm {
  readonly severity: Severity;
  readonly ruleName: string;
  readonly grounding: EmitGrounding;
}

/** Arms an instance may or may not carry, in the order they are declared. */
export type RuleArms<K extends string> = Readonly<Partial<Record<K, RuleArm>>>;

/** The `emits` list these arms declare — every arm this instance actually has. */
export function armEmits<K extends string>(arms: RuleArms<K>): NonNullable<RuleMeta['emits']> {
  return Object.values<RuleArm | undefined>(arms).filter((arm) => arm !== undefined);
}

/**
 * Append `arm`'s diagnostic for `node`, or nothing when this instance has no
 * such arm.
 *
 * Absent means the instance never declared it, so reporting anyway is exactly
 * the divergence this module exists to prevent — the silence is the point.
 */
export function reportArm(
  into: Diagnostic[],
  arm: RuleArm | undefined,
  node: TscnNode,
  message: string
): void {
  if (!arm) return;
  into.push({
    severity: arm.severity,
    message,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: arm.ruleName,
  });
}
