/**
 * Reach guard for `control-tooltip-ignored-by-mouse-filter` (control.cpp:246-256):
 * the rule runs on every concrete registered Control descendant. It loads the full
 * registries, as `configurationWarningCoverage.test.ts` does.
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

    // Pinned, so a new registered Control subclass fails here and "every" cannot change unseen.
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
