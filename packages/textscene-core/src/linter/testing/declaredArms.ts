/**
 * Every arm the linter declares: each registered rule's `emits`, and the file
 * diagnostics `Linter` stamps itself, which reach no `RuleMeta.emits` but take
 * the same shape. Each carries the rule that declares it, `Linter` for a file one.
 */

import { ruleRegistry } from '../RuleRegistry.js';
import { FILE_DIAGNOSTICS } from '../fileDiagnostics.js';
import type { RuleArm } from '../ruleArms.js';

export interface DeclaredArm extends RuleArm {
  readonly rule: string;
}

export function declaredArms(): DeclaredArm[] {
  return [
    ...ruleRegistry.getRules().flatMap((r) => (r.meta.emits ?? []).map((e) => ({ rule: r.meta.name, ...e }))),
    ...Object.values(FILE_DIAGNOSTICS).map((d) => ({ rule: 'Linter', ...d })),
  ];
}
