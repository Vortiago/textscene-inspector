/**
 * `visible = false` hides every registered Control type. The walker's outer `<group>` carries
 * `visible` for each solved node, and three.js skips an invisible subtree, which gives Godot's rule
 * (class_canvasitem.html) for every type. It runs through the real parser and walker, so a registry mismatch fails too.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
// Side-effect import: registers every Control slice's native painter.
import { controlComponentRegistry } from '../index';
import type { TscnNode } from '../../../parser/types';
import { parseHiddenNode } from '../testing/probeScene';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { solveNode } from './testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function bareSolveNode(node: TscnNode): SolveNode {
  return { ...solveNode(), path: node.name, node };
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
