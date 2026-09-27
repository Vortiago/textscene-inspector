/**
 * One reported diagnostic, declared once, so a parameterised factory derives
 * both the `push` in `check` and its `emits` from one arm. No guard sees the two
 * disagree, since a sibling's name satisfies the wildcard cross-check, so an
 * instance that reports a name its `emits` omits is unrepresentable.
 */

import type { Diagnostic, EmitGrounding, RuleMeta, Severity } from './types.js';
import type { TscnNode } from '../parser/types.js';

/**
 * `severity` first: `emitsScrape` pairs the two by source order, so the reverse
 * spelling mispairs (see `RuleMeta.emits`).
 */
export interface RuleArm {
  readonly severity: Severity;
  readonly ruleName: string;
  readonly grounding: EmitGrounding;
}

/**
 * Arms an instance may or may not carry, in declaration order. A record, not an
 * array: `check` keeps its own control flow and names the arm it reports.
 */
export type RuleArms<K extends string> = Readonly<Partial<Record<K, RuleArm>>>;

/** The `emits` list these arms declare: every arm this instance has. */
export function armEmits<K extends string>(arms: RuleArms<K>): NonNullable<RuleMeta['emits']> {
  return Object.values<RuleArm | undefined>(arms).filter((arm) => arm !== undefined);
}

/**
 * `arm`'s diagnostic for `node`, the one conversion from arm to report. Fields
 * are named, not spread, or the compiler lets `grounding` ship to every caller.
 * A rule passes no `location`: it reaches its subject through the tree, which
 * carries no lines, and `Linter` puts the report on the node's heading.
 */
export function armDiagnostic(
  arm: RuleArm,
  node: Pick<TscnNode, 'name' | 'type'>,
  message: string,
  location?: Diagnostic['location']
): Diagnostic {
  return {
    severity: arm.severity,
    message,
    nodeName: node.name,
    // A heading stating no type has none to report, and an empty string reads
    // in the CLI as a node with an unnameable type rather than an unknown one.
    nodeType: node.type || '<unknown>',
    ruleName: arm.ruleName,
    ...(location ? { location } : {}),
  };
}

/**
 * Append `arm`'s diagnostic for `node`, or nothing when this instance has no
 * such arm: it never declared that name, so it must not report it.
 */
export function reportArm(
  into: Diagnostic[],
  arm: RuleArm | undefined,
  node: TscnNode,
  message: string
): void {
  if (!arm) return;
  into.push(armDiagnostic(arm, node, message));
}
