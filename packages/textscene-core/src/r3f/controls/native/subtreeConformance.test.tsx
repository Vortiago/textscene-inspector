/**
 * Conformance guard: a Control child of every registered type survives the
 * real walk (`ControlCanvasWalker`) and reaches the rendered scene.
 *
 * Native's contract splits child placement two ways
 * (`NativeControlComponentProps`'s own doc comment): a normal painter draws
 * fixed chrome and the walker places its Control children as SIBLINGS,
 * bypassing the painter entirely; only a `wrapsChildren` type (`CanvasLayer`,
 * `ScrollContainer`) receives them as REAL React `children` and must render
 * that prop itself. `wrapsChildren.driftguard.test.ts` guards the FLAG on the
 * registration; this guards the RUNTIME behaviour the flag promises — a
 * wrapping painter that declares the flag but forgets to render `{children}`
 * in its own JSX silently drops its whole subtree, exactly the class of bug
 * that hit `CanvasLayer` for a whole commit (that module's own doc).
 *
 * Driven through the REAL `TscnParser` and the REAL `ControlCanvasWalker` —
 * never a hand-built `SolveNode` fixture for the type under test — so a
 * parser/registry/walker mismatch is caught too, not just a hand-wired stub.
 *
 * The DOM counterpart is ../subtreeConformance.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
// Side-effect import: registers all 23 Control slices' DOM + native painters.
import { controlComponentRegistry } from '../index';
import type { TscnNode } from '../../../parser/types';
import { parseWithChild } from '../testing/probeScene';
import { joinPath } from '../../../utils/nodePath';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const PROBE_GROUP_NAME = 'Control:__probe__';

/** `type` as root, carrying one plain `Control` child named `__probe__`. */
const parseWithProbeChild = (type: string): TscnNode => parseWithChild(type, 'Control', '__probe__');

function toSolveNode(node: TscnNode, path: string): SolveNode {
  return {
    path,
    node,
    children: node.children.map((child) => toSolveNode(child, joinPath(path, child.name))),
    styleBoxes: {},
    textureSize: null,
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
