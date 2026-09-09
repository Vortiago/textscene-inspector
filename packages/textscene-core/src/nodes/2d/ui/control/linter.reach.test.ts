/**
 * Reach guard for `control-tooltip-ignored-by-mouse-filter`
 * (control.cpp:246-256): the rule must run on every concrete registered
 * Control descendant, not merely be wired under the abstract `'Control'` key.
 *
 * `configurationWarningCoverage.test.ts` is the process-wide version of this
 * check, but it is a baked literal this task cannot edit and still lists the
 * Control row as `unimplemented`, so it does not exercise this rule at all
 * yet. This file is the same check, scoped to one rule, using the full
 * registries the way that guard does (`nodeRegistry` + the parser/linter
 * barrels) rather than this slice's own isolated imports.
 */
import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import '../../../../parser/TscnParser.js';
import '../../../../linter/index.js';

describe('control-tooltip-ignored-by-mouse-filter reach', () => {
  it('runs on every concrete registered Control descendant', () => {
    const heirs = nodeRegistry
      .getAllTypeNames()
      .filter((t) => t === 'Control' || descendsFrom(t, 'Control'));

    // Pinned so a future registered Control subclass fails loudly here rather
    // than silently widening (or narrowing) what "every" means.
    expect(heirs.length).toBe(61);

    const unreached = heirs.filter(
      (t) =>
        !ruleRegistry
          .getRulesForNodeType(t)
          .some((r) => r.meta.emits?.some((e) => e.ruleName === 'control-tooltip-ignored-by-mouse-filter'))
    );
    expect(unreached).toEqual([]);
  });
});
