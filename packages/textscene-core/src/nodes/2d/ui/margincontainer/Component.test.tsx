/**
 * Tests that `<MarginContainer>` renders nothing: no mesh, line or group. Godot's MarginContainer
 * draws no chrome and only insets its children (`nativeSolver.ts`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { MarginContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

function solveNode(): SolveNode {
  const node: TscnNode = { name: 'M', type: 'MarginContainer', children: [], properties: { name: 'M' } };
  return { ...emptySolveNode(), path: 'M', node };
}

describe('<MarginContainer>', () => {
  it('renders nothing — MarginContainer has no chrome of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MarginContainer {...painterEnv()} solveNode={solveNode()} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
