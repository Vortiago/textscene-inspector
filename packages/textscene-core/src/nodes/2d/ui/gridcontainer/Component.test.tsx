/**
 * `<GridContainer>` paints nothing, as a Container has no chrome, so a stray
 * quad or outline fails here.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { GridContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function gridSolveNode(): SolveNode {
  const node: TscnNode = {
    name: 'Grid',
    type: 'GridContainer',
    children: [],
    properties: { name: 'Grid' },
  };
  return { ...solveNode(), path: 'Grid', node };
}

describe('<GridContainer>', () => {
  it('renders no scene objects — a container draws nothing of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GridContainer {...painterEnv()} solveNode={gridSolveNode()} rect={{ x: 0, y: 0, w: 100, h: 40 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
