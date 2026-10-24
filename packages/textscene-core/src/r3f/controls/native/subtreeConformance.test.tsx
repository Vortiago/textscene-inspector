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
import '../index';
import { controlComponentRegistry } from '../ControlComponentRegistry';
import type { TscnNode } from '../../../parser/types';
import { parseWithChild } from '../testing/probeScene';
import { joinPath } from '../../../utils/nodePath';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import type { Rect2 } from '../../../godot/math/rect2';
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

/** Every registered Control type, read once the side-effect import has registered them. */
const TYPES = controlComponentRegistry.getAllTypeNames();

/** Whether a walked tree of `type` with a probe child draws the probe's group. */
async function rendersProbeChild(type: string): Promise<boolean> {
  const node = parseWithProbeChild(type);
  const renderer = await ReactThreeTestRenderer.create(
    <ControlCanvasWalker
      tree={[toSolveNode(node, node.name)]}
      generation={0}
      viewport={VIEWPORT}
      theme={THEME}
      measurer={null}
    />
  );
  const found = renderer.scene
    .findAllByType('Group')
    .some((g) => (g.instance as { name: string }).name === PROBE_GROUP_NAME);
  await renderer.unmount();
  return found;
}

describe('Native Control subtree conformance', () => {
  it('reads the registered types, so the cases cannot pass vacuously', () => {
    expect(TYPES.length).toBeGreaterThan(50);
  });

  // One case per type, not one loop: the 61 renders took 1 to 1.3 s in one test, and a full run's
  // load stretched that past the 5 s limit.
  it.each(TYPES)('renders a Control child of a %s as part of the walked tree', async (type) => {
    expect(await rendersProbeChild(type)).toBe(true);
  });
});
