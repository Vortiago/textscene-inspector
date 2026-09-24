/**
 * Reach guard for `range-exp-edit-negative-min` (range.cpp:71-79): the rule
 * must run on Range and every concrete registered descendant.
 * `nodes/2d/ui/control/linter.reach.test.ts` says why this is apart from
 * `configurationWarningCoverage.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import '../../../../parser/TscnParser.js';
import '../../../../linter/index.js';

describe('range-exp-edit-negative-min reach', () => {
  it('runs on Range and every concrete registered descendant', () => {
    const heirs = nodeRegistry.getAllTypeNames().filter((t) => t === 'Range' || descendsFrom(t, 'Range'));

    // Pinned: Range plus its 7 concrete descendants.
    expect(heirs.length).toBe(8);

    const unreached = heirs.filter(
      (t) =>
        !ruleRegistry
          .getRulesForNodeType(t)
          .some((r) => r.meta.emits?.some((e) => e.ruleName === 'range-exp-edit-negative-min'))
    );
    expect(unreached).toEqual([]);
  });
});
