/**
 * `<CenterContainer>` render contract: CenterContainer draws no chrome
 * of its own in Godot (it only centres children, `nativeSolver.ts`), so the
 * native painter must render nothing — no mesh, no line, no group of its own.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { CenterContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';

function solveNode(): SolveNode {
  const node: TscnNode = { name: 'C', type: 'CenterContainer', children: [], properties: { name: 'C' } };
  return { path: 'C', node, children: [], styleBoxes: {}, textureSize: null };
}

describe('<CenterContainer>', () => {
  it('renders nothing — CenterContainer has no chrome of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CenterContainer {...painterEnv()} solveNode={solveNode()} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
