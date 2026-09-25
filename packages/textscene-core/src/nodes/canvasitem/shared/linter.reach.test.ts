/**
 * `canvasitem-ancestor-clips-children` and `canvasitem-ancestor-is-canvasgroup`
 * (canvas_item.cpp:1297-1323) run on every concrete registered CanvasItem descendant, in both the
 * Node2D tree and the Control tree. `nodes/2d/ui/control/linter.reach.test.ts` says why this guard
 * stands apart from `configurationWarningCoverage.test.ts`.
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
