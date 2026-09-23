/**
 * Conformance guard: a Control child of every registered type survives the real
 * `TscnParser` and `ControlCanvasWalker` and reaches the rendered scene.
 */
// The walker places a normal painter's children as siblings. A `wrapsChildren`
// type receives them as React `children`, and one that forgets `{children}`
// drops its subtree. `wrapsChildren.driftguard.test.ts` guards only the flag.
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
// Side-effect import: registers every Control slice's native painter.
import { controlComponentRegistry } from '../index';
import type { TscnNode } from '../../../parser/types';
import { parseWithChild } from '../testing/probeScene';
import { joinPath } from '../../../utils/nodePath';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { solveNode } from './testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const PROBE_GROUP_NAME = 'Control:__probe__';

/** `type` as root, carrying one plain `Control` child named `__probe__`. */
const parseWithProbeChild = (type: string): TscnNode => parseWithChild(type, 'Control', '__probe__');

function toSolveNode(node: TscnNode, path: string): SolveNode {
  return {
    ...solveNode(),
    path,
    node,
    children: node.children.map((child) => toSolveNode(child, joinPath(path, child.name))),
  };
}

describe('Native Control subtree conformance', () => {
  it('renders a Control child of every registered type as part of the walked tree', async () => {
    const dropped: string[] = [];

    for (const type of controlComponentRegistry.getAllTypeNames()) {
      const node = parseWithProbeChild(type);
      const root = toSolveNode(node, node.name);

      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );

      const found = renderer.scene
        .findAllByType('Group')
        .some((g) => (g.instance as { name: string }).name === PROBE_GROUP_NAME);
      if (!found) dropped.push(type);
    }

    expect(dropped).toEqual([]);
  });
});
