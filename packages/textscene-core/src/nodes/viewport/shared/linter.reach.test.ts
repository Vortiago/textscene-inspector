/**
 * Reach guard for `viewport-size-too-small` (viewport.cpp:3706-3714): the
 * rule must be WIRED to every concrete registered Viewport descendant — both
 * SubViewport and the whole Window family — even though the check body
 * itself stays silent on SubViewport (see linter.ts's docblock).
 *
 * See `nodes/2d/ui/control/linter.reach.test.ts` for why this exists apart
 * from `configurationWarningCoverage.test.ts`: that guard is a baked literal
 * this task cannot edit, and still lists the Viewport row as `unimplemented`,
 * so it does not exercise this rule at all yet.
 */
import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import '../../../parser/TscnParser.js';
import '../../../linter/index.js';

describe('viewport-size-too-small reach', () => {
  it('is wired to every concrete registered Viewport descendant', () => {
    const heirs = nodeRegistry
      .getAllTypeNames()
      .filter((t) => t === 'Viewport' || descendsFrom(t, 'Viewport'));

    // Pinned: SubViewport plus the 8-member Window family, 9 total.
    expect(heirs.length).toBe(9);
    expect(heirs).toContain('SubViewport');
    expect(heirs).toContain('Window');

    const unreached = heirs.filter(
      (t) =>
        !ruleRegistry
          .getRulesForNodeType(t)
          .some((r) => r.meta.emits?.some((e) => e.ruleName === 'viewport-size-too-small'))
    );
    expect(unreached).toEqual([]);
  });
});
