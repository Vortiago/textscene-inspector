/**
 * `<VFlowContainer>`: a Container paints no chrome, so this pins that it renders
 * nothing into the scene graph and a stray quad or outline shows up here first.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { VFlowContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function flowSolveNode(): SolveNode {
  const node: TscnNode = {
    name: 'VFlow',
    type: 'VFlowContainer',
    children: [],
    properties: { name: 'VFlow' },
  };
  return { ...solveNode(), path: 'VFlow', node };
}

describe('<VFlowContainer>', () => {
  it('renders no scene objects — a container draws nothing of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VFlowContainer {...painterEnv()} solveNode={flowSolveNode()} rect={{ x: 0, y: 0, w: 100, h: 40 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
