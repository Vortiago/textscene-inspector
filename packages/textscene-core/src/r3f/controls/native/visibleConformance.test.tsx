/**
 * Conformance guard: `visible = false` hides every registered Control type.
 *
 * `ControlCanvasWalker`'s own `<ControlNodeGroup>` sets `visible={isVisible}`
 * on the outer `<group>` it emits for EVERY solved node, uniformly — three.js
 * skips an invisible object's whole subtree at render time (`Object3D.visible`),
 * so this is the one place native gets Godot's "`visible = false` hides the
 * node AND its subtree" (class_canvasitem.html) for free, the same way the DOM
 * overlay's `display: none` does (`../visibleConformance.test.tsx`, this
 * suite's DOM counterpart). A `wrapsChildren` painter (`CanvasLayer`) ALSO
 * guards its own `children`/context internally as a belt-and-braces measure
 * (its own module doc) — this test only needs to check the walker's outer
 * group, since that alone is sufficient for every type, wrapping or not.
 *
 * Driven through the REAL `TscnParser` and the REAL `ControlCanvasWalker`,
 * never a hand-built stub, so a parser/registry mismatch is caught too.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
// Side-effect import: registers all 23 Control slices' DOM + native painters.
import { controlComponentRegistry } from '../index';
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnNode } from '../../../parser/types';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function parseHiddenNode(type: string): TscnNode {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Probe" type="${type}"]\nvisible = false\n`
  );
  return scene.nodes[0];
}

function bareSolveNode(node: TscnNode): SolveNode {
  return { path: node.name, node, children: [], styleBoxes: {}, textureSize: null };
}

describe('Native Control visibility conformance', () => {
  it('renders visible=false on the walked group for every registered type when visible = false', async () => {
    const shown: string[] = [];

    for (const type of controlComponentRegistry.getAllTypeNames()) {
      const node = parseHiddenNode(type);
      const root = bareSolveNode(node);

      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );

      const group = renderer.scene
        .findAllByType('Group')
        .map((g) => g.instance as { name: string; visible: boolean })
        .find((g) => g.name === `${type}:Probe`);

      if (!group || group.visible !== false) {
        shown.push(`${type} (${group ? `visible: ${group.visible}` : 'group not found'})`);
      }
    }

    expect(shown).toEqual([]);
  });
});
