/**
 * Reach guard for `canvasitem-ancestor-clips-children` /
 * `canvasitem-ancestor-is-canvasgroup` (canvas_item.cpp:1297-1323): the rule
 * must run on every concrete registered CanvasItem descendant — both the
 * Node2D tree and the Control tree.
 *
 * See `nodes/2d/ui/control/linter.reach.test.ts` for why this exists apart
 * from `configurationWarningCoverage.test.ts`: that guard is a baked literal
 * this task cannot edit, and still lists the CanvasItem rows as
 * `unimplemented`, so it does not exercise this rule at all yet.
 */
import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import '../../../parser/TscnParser.js';
import '../../../linter/index.js';

describe('CanvasItem clip-ancestry rule reach', () => {
  it('runs on every concrete registered CanvasItem descendant, in both trees', () => {
    const heirs = nodeRegistry
      .getAllTypeNames()
      .filter((t) => t === 'CanvasItem' || descendsFrom(t, 'CanvasItem'));

    // Pinned: 108 concrete types across the Node2D and Control trees.
    expect(heirs.length).toBe(108);
    // Sanity check both trees are actually represented in that count.
    expect(heirs).toContain('Node2D');
    expect(heirs).toContain('Control');

    for (const ruleName of ['canvasitem-ancestor-clips-children', 'canvasitem-ancestor-is-canvasgroup']) {
      const unreached = heirs.filter(
        (t) => !ruleRegistry.getRulesForNodeType(t).some((r) => r.meta.emits?.some((e) => e.ruleName === ruleName))
      );
      expect(unreached, `${ruleName} never runs on: ${unreached.join(', ')}`).toEqual([]);
    }
  });
});
