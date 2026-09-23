/**
 * `<AspectRatioContainer>` paints no chrome of its own, so it renders nothing
 * into the scene graph.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { AspectRatioContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function aspectSolveNode(): SolveNode {
  const node: TscnNode = {
    name: 'Aspect',
    type: 'AspectRatioContainer',
    children: [],
    properties: { name: 'Aspect' },
  };
  return { ...solveNode(), path: 'Aspect', node };
}

describe('<AspectRatioContainer>', () => {
  it('renders no scene objects — a container draws nothing of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AspectRatioContainer
        {...painterEnv()}
        solveNode={aspectSolveNode()}
        rect={{ x: 0, y: 0, w: 100, h: 40 }}
        renderOrder={0}
      />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
