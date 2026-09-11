/**
 * `<FlowContainer>` — a Container paints no chrome of its own; this pins
 * that it renders nothing into the scene graph, so a later regression that
 * accidentally adds a stray quad/outline shows up here first.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { FlowContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function flowSolveNode(): SolveNode {
  const node: TscnNode = {
    name: 'Flow',
    type: 'FlowContainer',
    children: [],
    properties: { name: 'Flow' },
  };
  return { ...solveNode(), path: 'Flow', node };
}

describe('<FlowContainer>', () => {
  it('renders no scene objects — a container draws nothing of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FlowContainer {...painterEnv()} solveNode={flowSolveNode()} rect={{ x: 0, y: 0, w: 100, h: 40 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
