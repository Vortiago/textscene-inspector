/**
 * A **Rule arm**: one diagnostic a rule can report, declared once, so `check`
 * reports through it and `armEmits` derives `emits` from it. A rule therefore
 * cannot report a name or a severity its `emits` omits. The ESLint rule-arm guard
 * refuses a diagnostic built any other way.
 */

import type { Diagnostic, RuleArm, RuleMeta } from './types.js';
import type { TscnNode } from '../parser/types.js';

export type { RuleArm } from './types.js';

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
